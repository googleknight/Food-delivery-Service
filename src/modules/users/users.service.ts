import bcrypt from "bcrypt";
import { prisma } from "@utils/prisma";
import { cacheService } from "@utils/cache";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BusinessLogicError,
} from "@utils/errors";
import { CreateUserInput, UpdateUserInput } from "./users.schema";
import { PaginationOptions } from "@types";
import {
  parseFieldSelection,
  USER_SELECTABLE_FIELDS,
} from "@utils/fieldSelection";
import { ERROR_MESSAGES } from "@constants/messages";
import { AUTH_CONFIG } from "@constants/auth";
import { PRISMA_QUERY_MODE } from "@constants/prisma";

export async function listUsers(
  pagination: PaginationOptions,
  fieldsParam?: string,
) {
  const { skip, limit, search, sortBy, sortOrder } = pagination;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: PRISMA_QUERY_MODE.INSENSITIVE } },
          { email: { contains: search, mode: PRISMA_QUERY_MODE.INSENSITIVE } },
        ],
      }
    : {};

  const select = parseFieldSelection(
    fieldsParam,
    USER_SELECTABLE_FIELDS as unknown as string[],
  );

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      ...(select
        ? { select }
        : {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isBlocked: true,
              isBuiltInAdmin: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

export async function getUserById(id: string, fieldsParam?: string) {
  const select = parseFieldSelection(
    fieldsParam,
    USER_SELECTABLE_FIELDS as unknown as string[],
  );

  const user = await prisma.user.findUnique({
    where: { id },
    ...(select
      ? { select }
      : {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isBlocked: true,
            isBuiltInAdmin: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
  });

  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.USER.NOT_FOUND, id);
  }

  return user;
}

export async function createUser(input: CreateUserInput) {
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
      isBlocked: true,
      isBuiltInAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(ERROR_MESSAGES.USER.NOT_FOUND, id);
  }

  if (existing.isBuiltInAdmin && input.role && input.role !== "ADMIN") {
    throw new BusinessLogicError(ERROR_MESSAGES.USER.ROLE_CHANGE_FORBIDDEN);
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (emailConflict && emailConflict.id !== id) {
      throw new ConflictError(ERROR_MESSAGES.AUTH.EMAIL_EXISTS);
    }
    data.email = input.email;
  }
  if (input.password) {
    data.password = await bcrypt.hash(
      input.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );
  }
  if (input.role !== undefined) data.role = input.role;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      isBuiltInAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Invalidate cache if role changed
  cacheService.del(`user:${id}`);

  return user;
}

export async function deleteUser(id: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(ERROR_MESSAGES.USER.NOT_FOUND, id);
  }

  if (existing.isBuiltInAdmin) {
    throw new ForbiddenError(ERROR_MESSAGES.USER.DELETE_ADMIN_FORBIDDEN);
  }

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  cacheService.del(`user:${id}`);
}

export async function blockUser(id: string, isBlocked: boolean) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(ERROR_MESSAGES.USER.NOT_FOUND, id);
  }

  if (existing.isBuiltInAdmin) {
    throw new ForbiddenError(ERROR_MESSAGES.USER.BLOCK_ADMIN_FORBIDDEN);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isBlocked },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      isBuiltInAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Invalidate cache immediately
  cacheService.del(`user:${id}`);

  // If blocking, revoke all refresh tokens
  if (isBlocked) {
    await prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  return user;
}
