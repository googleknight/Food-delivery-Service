import { z } from "zod";
import { Role } from "@prisma/client";
import {
  emailSchema,
  passwordSchema,
  nameSchema,
  uuidSchema,
} from "../common/validation.schema";

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.enum(Role),
});

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(Role).optional(),
});

export const blockUserSchema = z.object({
  isBlocked: z.boolean(),
});

export const userIdParamSchema = z.object({
  id: uuidSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
