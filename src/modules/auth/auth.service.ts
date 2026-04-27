import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "@utils/prisma";
import { config } from "@config";
import { UnauthorizedError, ConflictError, NotFoundError } from "@utils/errors";
import { RegisterInput, LoginInput, UpdateProfileInput } from "./auth.schema";
import { AccessTokenPayload, RefreshTokenPayload } from "@types";
import { ERROR_MESSAGES } from "@constants/messages";
import { AUTH_CONFIG } from "@constants/auth";

function signAccessToken(userId: string, email: string, role: string): string {
  const payload: AccessTokenPayload = {
    sub: userId,
    email,
    role,
    type: "access",
  };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh", jti };
  const token = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  return { token, jti };
}

function getRefreshTokenExpiry(): Date {
  const match = config.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match) {
    return new Date(
      Date.now() +
        AUTH_CONFIG.REFRESH_TOKEN_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ); // default 7 days
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + value * (multipliers[unit] || multipliers.d));
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new ConflictError(ERROR_MESSAGES.AUTH.EMAIL_EXISTS);
  }

  const hashedPassword = await bcrypt.hash(
    input.password,
    AUTH_CONFIG.BCRYPT_ROUNDS,
  );

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
      role: input.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      jti,
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
  }

  if (user.isBlocked) {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.ACCOUNT_BLOCKED);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
  }

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      jti,
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshTokenValue: string) {
  let decoded: RefreshTokenPayload;

  try {
    decoded = jwt.verify(
      refreshTokenValue,
      config.JWT_REFRESH_SECRET,
    ) as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.INVALID_TOKEN);
  }

  if (decoded.type !== "refresh") {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.INVALID_TOKEN_TYPE);
  }

  // Find the refresh token in DB
  const storedToken = await prisma.refreshToken.findUnique({
    where: { jti: decoded.jti },
    include: { user: true },
  });

  if (!storedToken || storedToken.isRevoked) {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.TOKEN_REVOKED);
  }

  if (storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.TOKEN_EXPIRED);
  }

  if (storedToken.user.isBlocked) {
    throw new UnauthorizedError(ERROR_MESSAGES.AUTH.ACCOUNT_BLOCKED);
  }

  // Rotate: revoke old, issue new
  const newRefresh = signRefreshToken(storedToken.userId);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    }),
    prisma.refreshToken.create({
      data: {
        jti: newRefresh.jti,
        userId: storedToken.userId,
        expiresAt: getRefreshTokenExpiry(),
      },
    }),
  ]);

  const accessToken = signAccessToken(
    storedToken.userId,
    storedToken.user.email,
    storedToken.user.role,
  );

  return { accessToken, refreshToken: newRefresh.token };
}

export async function logout(userId: string) {
  // Revoke all refresh tokens for this user
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.AUTH.NOT_FOUND);
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const data: Record<string, unknown> = {};

  if (input.name) data.name = input.name;
  if (input.password) {
    data.password = await bcrypt.hash(
      input.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}
