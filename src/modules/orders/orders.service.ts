import { OrderStatus, Role, Prisma } from "@prisma/client";
const { Decimal } = Prisma;
import { prisma } from "@utils/prisma";
import {
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
  ValidationError,
} from "@utils/errors";
import { CreateOrderInput, UpdateOrderStatusInput } from "./orders.schema";
import { PaginationOptions, AuthUser } from "@types";
import { ERROR_MESSAGES } from "@constants/messages";
import {
  parseFieldSelection,
  ORDER_SELECTABLE_FIELDS,
} from "@utils/fieldSelection";

// ─── Order Status State Machine ──────────────────────────────────────────────

interface Transition {
  status: OrderStatus;
  allowedRoles: Role[];
}

const VALID_TRANSITIONS: Record<OrderStatus, Transition[]> = {
  PLACED: [
    {
      status: OrderStatus.CANCELED,
      allowedRoles: [Role.CUSTOMER, Role.RESTAURANT_OWNER],
    },
    { status: OrderStatus.PROCESSING, allowedRoles: [Role.RESTAURANT_OWNER] },
  ],
  PROCESSING: [
    { status: OrderStatus.CANCELED, allowedRoles: [Role.RESTAURANT_OWNER] },
    { status: OrderStatus.IN_ROUTE, allowedRoles: [Role.RESTAURANT_OWNER] },
  ],
  IN_ROUTE: [
    { status: OrderStatus.DELIVERED, allowedRoles: [Role.RESTAURANT_OWNER] },
  ],
  DELIVERED: [{ status: OrderStatus.RECEIVED, allowedRoles: [Role.CUSTOMER] }],
  CANCELED: [],
  RECEIVED: [],
};

// ─── Create Order ────────────────────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify restaurant exists and is not blocked
    const restaurant = await tx.restaurant.findUnique({
      where: { id: input.restaurantId },
    });

    if (!restaurant || restaurant.isBlocked) {
      throw new NotFoundError(
        ERROR_MESSAGES.RESTAURANT.NOT_FOUND,
        input.restaurantId,
      );
    }

    // 2. Fetch all meals and verify they belong to this restaurant
    const mealIds = input.items.map((item) => item.mealId);
    const meals = await tx.meal.findMany({
      where: {
        id: { in: mealIds },
        restaurantId: input.restaurantId,
        isAvailable: true,
        isBlocked: false,
      },
    });

    if (meals.length !== mealIds.length) {
      const foundIds = meals.map((m) => m.id);
      const missing = mealIds.filter((id) => !foundIds.includes(id));
      throw new ValidationError(
        `${ERROR_MESSAGES.MEAL.UNAVAILABLE}: ${missing.join(", ")}`,
      );
    }

    // 3. Calculate order totals
    const mealPriceMap = new Map(meals.map((m) => [m.id, m.price]));

    const orderItems = input.items.map((item) => {
      const unitPrice = mealPriceMap.get(item.mealId)!;
      const itemTotal = new Decimal(unitPrice.toString()).mul(item.quantity);
      return {
        mealId: item.mealId,
        quantity: item.quantity,
        unitPrice,
        itemTotal,
      };
    });

    const subtotal = orderItems.reduce(
      (sum, item) => sum.add(item.itemTotal),
      new Decimal(0),
    );

    // 4. Handle coupon
    let discountAmount = new Decimal(0);
    let couponId: string | null = null;

    if (input.couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: input.couponCode.toUpperCase() },
      });

      if (!coupon) {
        throw new ValidationError(ERROR_MESSAGES.COUPON.INVALID);
      }

      if (!coupon.isActive) {
        throw new BusinessLogicError(ERROR_MESSAGES.COUPON.INACTIVE);
      }

      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new BusinessLogicError(ERROR_MESSAGES.COUPON.EXPIRED);
      }

      if (coupon.restaurantId !== input.restaurantId) {
        throw new ValidationError(
          ERROR_MESSAGES.COUPON.NOT_VALID_FOR_RESTAURANT,
        );
      }

      // Check total usage limit
      if (
        coupon.maxUsageTotal !== null &&
        coupon.currentUsageTotal >= coupon.maxUsageTotal
      ) {
        throw new BusinessLogicError(ERROR_MESSAGES.COUPON.MAX_USAGE_REACHED);
      }

      // Check per-customer usage limit
      if (coupon.maxUsagePerCustomer !== null) {
        const customerUsages = await tx.couponUsage.count({
          where: { couponId: coupon.id, customerId: user.id },
        });
        if (customerUsages >= coupon.maxUsagePerCustomer) {
          throw new BusinessLogicError(
            ERROR_MESSAGES.COUPON.CUSTOMER_LIMIT_REACHED,
          );
        }
      }

      discountAmount = subtotal.mul(coupon.discountPercent).div(100);
      couponId = coupon.id;
    }

    const tipAmount = new Decimal(input.tipAmount || 0);
    const totalAmount = subtotal.sub(discountAmount).add(tipAmount);

    // 5. Create order + items + status history + coupon usage atomically
    const order = await tx.order.create({
      data: {
        customerId: user.id,
        restaurantId: input.restaurantId,
        status: OrderStatus.PLACED,
        subtotal,
        discountAmount,
        tipAmount,
        totalAmount,
        couponId,
        items: {
          create: orderItems,
        },
        statusHistory: {
          create: {
            status: OrderStatus.PLACED,
            changedById: user.id,
          },
        },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        subtotal: true,
        discountAmount: true,
        tipAmount: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        restaurant: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            itemTotal: true,
            meal: { select: { id: true, name: true } },
          },
        },
        statusHistory: {
          select: {
            id: true,
            status: true,
            changedAt: true,
            changedBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { changedAt: "asc" as const },
        },
        coupon: { select: { id: true, code: true, discountPercent: true } },
      },
    });

    // 6. Track coupon usage
    if (couponId) {
      await tx.couponUsage.create({
        data: {
          couponId,
          customerId: user.id,
          orderId: order.id,
        },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: { currentUsageTotal: { increment: 1 } },
      });
    }

    return order;
  });
}

// ─── Update Order Status ─────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  input: UpdateOrderStatusInput,
  user: AuthUser,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { ownerId: true } } },
    });

    if (!order) {
      throw new NotFoundError(ERROR_MESSAGES.ORDER.NOT_FOUND, orderId);
    }

    // Verify access: customer sees own orders, owner sees restaurant orders, admin sees all
    if (user.role === Role.CUSTOMER && order.customerId !== user.id) {
      throw new ForbiddenError(ERROR_MESSAGES.ORDER.UPDATE_OWN_ONLY);
    }

    if (
      user.role === Role.RESTAURANT_OWNER &&
      order.restaurant.ownerId !== user.id
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.RESTAURANT.ORDER_UPDATE_DENIED);
    }

    // Validate transition
    const validTransitions = VALID_TRANSITIONS[order.status];
    const transition = validTransitions.find((t) => t.status === input.status);

    if (!transition) {
      throw new BusinessLogicError(
        ERROR_MESSAGES.ORDER.INVALID_TRANSITION(order.status, input.status),
      );
    }

    // Admin can perform any valid transition; others need role check
    if (
      user.role !== Role.ADMIN &&
      !transition.allowedRoles.includes(user.role as Role)
    ) {
      throw new ForbiddenError(
        ERROR_MESSAGES.ORDER.ROLE_TRANSITION_DENIED(
          user.role,
          order.status,
          input.status,
        ),
      );
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: input.status as OrderStatus,
        statusHistory: {
          create: {
            status: input.status as OrderStatus,
            changedById: user.id,
          },
        },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        subtotal: true,
        discountAmount: true,
        tipAmount: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        restaurant: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            itemTotal: true,
            meal: { select: { id: true, name: true } },
          },
        },
        statusHistory: {
          select: {
            id: true,
            status: true,
            changedAt: true,
            changedBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { changedAt: "asc" as const },
        },
        coupon: { select: { id: true, code: true, discountPercent: true } },
      },
    });

    return updatedOrder;
  });
}

// ─── List Orders ─────────────────────────────────────────────────────────────

export async function listOrders(
  pagination: PaginationOptions,
  user: AuthUser,
  fieldsParam?: string,
  statusFilter?: string,
) {
  const { skip, limit, sortBy, sortOrder } = pagination;

  const where: Prisma.OrderWhereInput = {};

  if (user.role === Role.CUSTOMER) {
    where.customerId = user.id;
  } else if (user.role === Role.RESTAURANT_OWNER) {
    where.restaurant = { ownerId: user.id };
  }
  // Admin sees all

  // Status filter
  if (statusFilter) {
    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(statusFilter as OrderStatus)) {
      throw new ValidationError(
        `Invalid status filter: ${statusFilter}. Valid values: ${validStatuses.join(", ")}`,
      );
    }
    where.status = statusFilter as OrderStatus;
  }

  const fieldSelect = parseFieldSelection(
    fieldsParam,
    ORDER_SELECTABLE_FIELDS as unknown as string[],
  );

  const query: Prisma.OrderFindManyArgs = {
    where,
    skip,
    take: limit,
    orderBy: { [sortBy as string]: sortOrder },
  };

  if (fieldSelect) {
    query.select = fieldSelect;
  } else {
    query.select = {
      id: true,
      customerId: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      tipAmount: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      restaurant: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          itemTotal: true,
          meal: { select: { id: true, name: true } },
        },
      },
      statusHistory: {
        select: {
          id: true,
          status: true,
          changedAt: true,
          changedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { changedAt: "asc" as const },
      },
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany(query),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

// ─── Get Order By ID ─────────────────────────────────────────────────────────

export async function getOrderById(orderId: string, user: AuthUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      tipAmount: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      restaurant: { select: { id: true, name: true, ownerId: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          itemTotal: true,
          meal: { select: { id: true, name: true } },
        },
      },
      statusHistory: {
        select: {
          id: true,
          status: true,
          changedAt: true,
          changedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { changedAt: "asc" as const },
      },
      coupon: { select: { id: true, code: true, discountPercent: true } },
    },
  });

  if (!order) {
    throw new NotFoundError(ERROR_MESSAGES.ORDER.NOT_FOUND, orderId);
  }

  // Access control
  if (user.role === Role.CUSTOMER && order.customerId !== user.id) {
    throw new ForbiddenError(ERROR_MESSAGES.ORDER.OWN_ORDERS_ONLY);
  }

  if (
    user.role === Role.RESTAURANT_OWNER &&
    order.restaurant.ownerId !== user.id
  ) {
    throw new ForbiddenError(ERROR_MESSAGES.RESTAURANT.ORDER_ACCESS_DENIED);
  }

  // Strip internal fields used only for access control
  const { id: restaurantId, name: restaurantName } = order.restaurant;
  return { ...order, restaurant: { id: restaurantId, name: restaurantName } };
}
