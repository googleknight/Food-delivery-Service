import { prisma } from "@utils/prisma";
import {
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from "@utils/errors";
import { CreateMealInput, UpdateMealInput } from "./meals.schema";
import { PaginationOptions, AuthUser } from "@types";
import {
  parseFieldSelection,
  MEAL_SELECTABLE_FIELDS,
} from "@utils/fieldSelection";
import { Role } from "@prisma/client";
import { ERROR_MESSAGES } from "@constants/messages";
import { ACTIVE_ORDER_STATUSES } from "@constants/orders";

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
    throw new ForbiddenError(ERROR_MESSAGES.RESTAURANT.OWNERSHIP_REQUIRED);
  }

  return restaurant;
}

export async function listMeals(
  restaurantId: string,
  pagination: PaginationOptions,
  user: AuthUser,
  fieldsParam?: string,
) {
  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) {
    throw new NotFoundError(ERROR_MESSAGES.RESTAURANT.NOT_FOUND, restaurantId);
  }

  const { skip, limit, search, sortBy, sortOrder } = pagination;

  const where: Record<string, unknown> = { restaurantId };

  // Customers see only available, non-blocked meals
  if (user.role === Role.CUSTOMER) {
    where.isAvailable = true;
    where.isBlocked = false;
  }

  if (search) {
    where.name = { contains: search, mode: PRISMA_QUERY_MODE.INSENSITIVE };
  }

  const select = parseFieldSelection(
    fieldsParam,
    MEAL_SELECTABLE_FIELDS as unknown as string[],
  );

  const [meals, total] = await Promise.all([
    prisma.meal.findMany({
      where,
      ...(select
        ? { select }
        : {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              restaurantId: true,
              isAvailable: true,
              isBlocked: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.meal.count({ where }),
  ]);

  return { meals, total };
}

export async function getMealById(
  restaurantId: string,
  id: string,
  fieldsParam?: string,
) {
  const select = parseFieldSelection(
    fieldsParam,
    MEAL_SELECTABLE_FIELDS as unknown as string[],
  );

  const meal = await prisma.meal.findFirst({
    where: { id, restaurantId },
    ...(select
      ? { select }
      : {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            restaurantId: true,
            isAvailable: true,
            isBlocked: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
  });

  if (!meal) {
    throw new NotFoundError(ERROR_MESSAGES.MEAL.NOT_FOUND, id);
  }

  return meal;
}

export async function createMeal(
  restaurantId: string,
  input: CreateMealInput,
  user: AuthUser,
) {
  await verifyRestaurantOwnership(restaurantId, user);

  return prisma.meal.create({
    data: {
      name: input.name,
      description: input.description,
      price: input.price,
      restaurantId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      restaurantId: true,
      isAvailable: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateMeal(
  restaurantId: string,
  id: string,
  input: UpdateMealInput,
  user: AuthUser,
) {
  await verifyRestaurantOwnership(restaurantId, user);

  const meal = await prisma.meal.findFirst({ where: { id, restaurantId } });
  if (!meal) {
    throw new NotFoundError(ERROR_MESSAGES.MEAL.NOT_FOUND, id);
  }

  return prisma.meal.update({
    where: { id },
    data: input,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      restaurantId: true,
      isAvailable: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteMeal(
  restaurantId: string,
  id: string,
  user: AuthUser,
) {
  await verifyRestaurantOwnership(restaurantId, user);

  const meal = await prisma.meal.findFirst({ where: { id, restaurantId } });
  if (!meal) {
    throw new NotFoundError(ERROR_MESSAGES.MEAL.NOT_FOUND, id);
  }

  // Check for active orders containing this meal
  const activeOrderItems = await prisma.orderItem.count({
    where: {
      mealId: id,
      order: {
        status: { in: ACTIVE_ORDER_STATUSES },
      },
    },
  });

  if (activeOrderItems > 0) {
    throw new BusinessLogicError(ERROR_MESSAGES.MEAL.ACTIVE_ORDERS);
  }

  await prisma.meal.delete({ where: { id } });
}
