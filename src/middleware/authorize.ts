import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError } from "@utils/errors";
import { AuthenticatedRequest } from "@types";
import { ERROR_MESSAGES } from "@constants/messages";

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return next(new ForbiddenError(ERROR_MESSAGES.AUTH.AUTH_REQUIRED));
    }

    if (!allowedRoles.includes(user.role as Role)) {
      return next(
        new ForbiddenError(ERROR_MESSAGES.AUTH.ROLE_NOT_AUTHORIZED(user.role)),
      );
    }

    next();
  };
}
