import { prisma } from "@utils/prisma";
import {
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from "@utils/errors";
import {
  CreateRestaurantInput,
  UpdateRestaurantInput,
} from "./restaurants.schema";
import { PaginationOptions, AuthUser } from "@types";
import {
  parseFieldSelection,
  RESTAURANT_SELECTABLE_FIELDS,
} from "@utils/fieldSelection";
import { Role } from "@prisma/client";
import { ERROR_MESSAGES } from "@constants/messages";
import { ACTIVE_ORDER_STATUSES } from "@constants/orders";
import { PRISMA_QUERY_MODE } from "@constants/prisma";

export async function listRestaurants(
  pagination: PaginationOptions,
  user: AuthUser,
  fieldsParam?: string,
) {
  const { skip, limit, search, sortBy, sortOrder } = pagination;

  const where: Record<string, unknown> = {};

  // Customers see only unblocked restaurants
  if (user.role === Role.CUSTOMER) {
    where.isBlocked = false;
  }
  // Owners see all (their own + unblocked)
  if (user.role === Role.RESTAURANT_OWNER) {
    where.OR = [{ ownerId: user.id }, { isBlocked: false }];
  }
  // Admins see all

  if (search) {
    where.name = { contains: search, mode: PRISMA_QUERY_MODE.INSENSITIVE };
  }

  const select = parseFieldSelection(
    fieldsParam,
    RESTAURANT_SELECTABLE_FIELDS as unknown as string[],
  );

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      ...(select
        ? { select }
        : {
            select: {
              id: true,
              name: true,
              description: true,
              ownerId: true,
              isBlocked: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.restaurant.count({ where }),
  ]);

  return { restaurants, total };
}

export async function getRestaurantById(
  id: string,
  user: AuthUser,
  fieldsParam?: string,
) {
  const select = parseFieldSelection(
    fieldsParam,
    RESTAURANT_SELECTABLE_FIELDS as unknown as string[],
  );

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    ...(select
      ? { select }
      : {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
            isBlocked: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
  });

  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, id);
  }

  // Customers can't see blocked restaurants
  if (
    user.role === Role.CUSTOMER &&
    (restaurant as unknown as { isBlocked: boolean }).isBlocked
  ) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, id);
  }

  return restaurant;
}

export async function createRestaurant(
  input: CreateRestaurantInput,
  ownerId: string,
) {
  return prisma.restaurant.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      ownerId: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateRestaurant(
  id: string,
  input: UpdateRestaurantInput,
  user: AuthUser,
) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, id);
  }

  // Ownership check for non-admins
  if (user.role !== Role.ADMIN && restaurant.ownerId !== user.id) {
    throw new ForbiddenError(ERROR_MESSAGES.RESTAURANT.UPDATE_OWN_ONLY);
  }

  return prisma.restaurant.update({
    where: { id },
    data: input,
    select: {
      id: true,
      name: true,
      description: true,
      ownerId: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteRestaurant(id: string, user: AuthUser) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, id);
  }

  if (user.role !== Role.ADMIN && restaurant.ownerId !== user.id) {
    throw new ForbiddenError(ERROR_MESSAGES.RESTAURANT.DELETE_OWN_ONLY);
  }

  // Check for active orders
  const activeOrders = await prisma.order.count({
    where: {
      restaurantId: id,
      status: { in: ACTIVE_ORDER_STATUSES },
    },
  });

  if (activeOrders > 0) {
    throw new BusinessLogicError(ERROR_MESSAGES.RESTAURANT.ACTIVE_ORDERS);
  }

  await prisma.restaurant.delete({ where: { id } });
}

export async function blockRestaurant(id: string, isBlocked: boolean) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, id);
  }

  return prisma.restaurant.update({
    where: { id },
    data: { isBlocked },
    select: {
      id: true,
      name: true,
      description: true,
      ownerId: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
