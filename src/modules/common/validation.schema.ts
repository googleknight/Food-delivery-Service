import { z } from "zod";

/**
 * Password Requirements:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character (@$!%*?&)
 */
export const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const emailSchema = z
  .email("Invalid email format")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    passwordRegex,
    "Password must contain at least one uppercase, one lowercase, one number, and one special character",
  );

export const nameSchema = z.string().min(1, "Name is required").max(100);

// For common reusable IDs
export const uuidSchema = z.uuid("Invalid UUID format");
