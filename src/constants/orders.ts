import { OrderStatus } from "@prisma/client";

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.PROCESSING,
  OrderStatus.IN_ROUTE,
];
