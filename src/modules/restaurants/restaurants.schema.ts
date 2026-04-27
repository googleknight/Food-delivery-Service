import { z } from "zod";

export const createRestaurantSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1, "Description is required").max(1000),
});

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
});

export const restaurantIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const blockRestaurantSchema = z.object({
  isBlocked: z.boolean(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
