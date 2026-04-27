import { z } from "zod";

export const createCouponSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(50)
    .transform((v) => v.toUpperCase()),
  discountPercent: z.coerce
    .number()
    .min(0.01, "Discount must be at least 0.01%")
    .max(100, "Discount cannot exceed 100%"),
  maxUsageTotal: z.coerce.number().int().positive().nullable().optional(),
  maxUsagePerCustomer: z.coerce.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateCouponSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  discountPercent: z.coerce.number().min(0.01).max(100).optional(),
  maxUsageTotal: z.coerce.number().int().positive().nullable().optional(),
  maxUsagePerCustomer: z.coerce.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const couponParamsSchema = z.object({
  restaurantId: z.string().uuid(),
  id: z.string().uuid(),
});

export const couponRestaurantParamSchema = z.object({
  restaurantId: z.string().uuid(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
