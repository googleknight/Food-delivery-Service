import { z } from "zod";
import { Role } from "@prisma/client";
import {
  emailSchema,
  passwordSchema,
  nameSchema,
} from "../common/validation.schema";

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.enum([Role.CUSTOMER, Role.RESTAURANT_OWNER], {
    message: "Role must be CUSTOMER or RESTAURANT_OWNER",
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  password: passwordSchema.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
