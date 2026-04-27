import { z } from "zod";

export const createMealSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1, "Description is required").max(1000),
  price: z.coerce
    .number()
    .positive("Price must be positive")
    .multipleOf(0.01, "Price must have at most 2 decimal places"),
});

export const updateMealSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  price: z.coerce.number().positive().multipleOf(0.01).optional(),
  isAvailable: z.boolean().optional(),
});

export const mealParamsSchema = z.object({
  restaurantId: z.string().uuid(),
  id: z.string().uuid(),
});

export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().uuid(),
});

export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
