import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "@utils/prisma";
import { cacheService } from "@utils/cache";
import { UnauthorizedError } from "@utils/errors";
import { ERROR_MESSAGES } from "@constants/messages";
import { AuthUser, AuthenticatedRequest, AccessTokenPayload } from "@types";

interface CachedUser {
  id: string;
  role: string;
  isBlocked: boolean;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError(ERROR_MESSAGES.AUTH.AUTH_HEADER_INVALID);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new UnauthorizedError(ERROR_MESSAGES.AUTH.MISSING_TOKEN);
    }

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(
        token,
        config.JWT_ACCESS_SECRET,
      ) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError(ERROR_MESSAGES.AUTH.TOKEN_EXPIRED_ACCESS);
      }
      throw new UnauthorizedError(ERROR_MESSAGES.AUTH.INVALID_TOKEN_ACCESS);
    }

    if (decoded.type !== "access") {
      throw new UnauthorizedError(ERROR_MESSAGES.AUTH.INVALID_TOKEN_TYPE);
    }

    // Check cache first for user status
    const cacheKey = `user:${decoded.sub}`;
    let cachedUser = cacheService.get<CachedUser>(cacheKey);

    if (!cachedUser) {
      // Cache miss — look up in DB
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, role: true, isBlocked: true },
      });

      if (!user) {
        throw new UnauthorizedError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
      }

      cachedUser = { id: user.id, role: user.role, isBlocked: user.isBlocked };
      cacheService.set(cacheKey, cachedUser);
    }

    if (cachedUser.isBlocked) {
      throw new UnauthorizedError(ERROR_MESSAGES.AUTH.ACCOUNT_BLOCKED);
    }

    (req as AuthenticatedRequest).user = {
      id: decoded.sub,
      email: decoded.email,
      role: cachedUser.role,
    } as AuthUser;

    next();
  } catch (error) {
    next(error);
  }
}
