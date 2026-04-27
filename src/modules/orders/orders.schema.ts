import { z } from "zod";

export const createOrderSchema = z.object({
  restaurantId: z.string().uuid("Invalid restaurant ID"),
  items: z
    .array(
      z.object({
        mealId: z.string().uuid("Invalid meal ID"),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
      }),
    )
    .min(1, "Order must contain at least one meal")
    .refine(
      (items) => new Set(items.map((i) => i.mealId)).size === items.length,
      {
        message:
          "Duplicate meal IDs are not allowed; combine quantities instead",
      },
    ),
  couponCode: z.string().optional(),
  tipAmount: z.coerce.number().min(0, "Tip cannot be negative").default(0),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(
    ["CANCELED", "PROCESSING", "IN_ROUTE", "DELIVERED", "RECEIVED"],
    {
      message: "Invalid order status",
    },
  ),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
