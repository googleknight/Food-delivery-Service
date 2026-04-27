import { prisma } from "@utils/prisma";
import { NotFoundError, ForbiddenError, ConflictError } from "@utils/errors";
import { CreateCouponInput, UpdateCouponInput } from "./coupons.schema";
import { PaginationOptions, AuthUser } from "@types";
import {
  parseFieldSelection,
  COUPON_SELECTABLE_FIELDS,
} from "@utils/fieldSelection";
import { Role } from "@prisma/client";
import { ERROR_MESSAGES } from "@constants/messages";
import { PRISMA_QUERY_MODE } from "@constants/prisma";

async function verifyRestaurantOwnership(restaurantId: string, user: AuthUser) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, ownerId: true },
  });

  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, restaurantId);
  }

  if (user.role !== Role.ADMIN && restaurant.ownerId !== user.id) {
    throw new ForbiddenError(ERROR_MESSAGES.COUPON.OWNERSHIP_REQUIRED);
  }

  return restaurant;
}

export async function listCoupons(
  restaurantId: string,
  pagination: PaginationOptions,
  fieldsParam?: string,
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, restaurantId);
  }

  const { skip, limit, search, sortBy, sortOrder } = pagination;
  const where: Record<string, unknown> = { restaurantId };

  if (search) {
    where.code = { contains: search, mode: PRISMA_QUERY_MODE.INSENSITIVE };
  }

  const select = parseFieldSelection(
    fieldsParam,
    COUPON_SELECTABLE_FIELDS as unknown as string[],
  );

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      ...(select
        ? { select }
        : {
            select: {
              id: true,
              code: true,
              discountPercent: true,
              restaurantId: true,
              isActive: true,
              maxUsageTotal: true,
              maxUsagePerCustomer: true,
              currentUsageTotal: true,
              expiresAt: true,
              createdAt: true,
            },
          }),
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.coupon.count({ where }),
  ]);

  return { coupons, total };
}

export async function createCoupon(
  restaurantId: string,
  input: CreateCouponInput,
  user: AuthUser,
) {
  await verifyRestaurantOwnership(restaurantId, user);

  // Check code uniqueness
  const existing = await prisma.coupon.findUnique({
    where: { code: input.code },
  });
  if (existing) {
    throw new ConflictError(ERROR_MESSAGES.COUPON.DUPLICATE_CODE);
  }

  return prisma.coupon.create({
    data: {
      code: input.code,
      discountPercent: input.discountPercent,
      restaurantId,
      maxUsageTotal: input.maxUsageTotal ?? null,
      maxUsagePerCustomer: input.maxUsagePerCustomer ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
      code: true,
      discountPercent: true,
      restaurantId: true,
      isActive: true,
      maxUsageTotal: true,
      maxUsagePerCustomer: true,
      currentUsageTotal: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function updateCoupon(
  restaurantId: string,
  id: string,
  input: UpdateCouponInput,
  user: AuthUser,
) {
  await verifyRestaurantOwnership(restaurantId, user);

  const coupon = await prisma.coupon.findFirst({ where: { id, restaurantId } });
  if (!coupon) {
    throw new NotFoundError(ERROR_MESSAGES.COUPON.NOT_FOUND, id);
  }

  if (input.code) {
    const existing = await prisma.coupon.findUnique({
      where: { code: input.code },
    });
    if (existing && existing.id !== id) {
      throw new ConflictError(ERROR_MESSAGES.COUPON.DUPLICATE_CODE);
    }
  }

  const data: Record<string, unknown> = {};
  if (input.code !== undefined) data.code = input.code;
  if (input.discountPercent !== undefined)
    data.discountPercent = input.discountPercent;
  if (input.maxUsageTotal !== undefined)
    data.maxUsageTotal = input.maxUsageTotal;
  if (input.maxUsagePerCustomer !== undefined)
    data.maxUsagePerCustomer = input.maxUsagePerCustomer;
  if (input.expiresAt !== undefined)
    data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.coupon.update({
    where: { id },
    data,
    select: {
      id: true,
      code: true,
      discountPercent: true,
      restaurantId: true,
      isActive: true,
      maxUsageTotal: true,
      maxUsagePerCustomer: true,
      currentUsageTotal: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function deleteCoupon(
  restaurantId: string,
  id: string,
  user: AuthUser,
) {
  await verifyRestaurantOwnership(restaurantId, user);

  const coupon = await prisma.coupon.findFirst({ where: { id, restaurantId } });
  if (!coupon) {
    throw new NotFoundError(ERROR_MESSAGES.COUPON.NOT_FOUND, id);
  }

  await prisma.coupon.delete({ where: { id } });
}
