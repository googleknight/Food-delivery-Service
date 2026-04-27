import { ValidationError } from "./errors";

/**
 * Sensitive fields that should never be exposed via field selection.
 */
const SENSITIVE_FIELDS = ["password"] as const;

/**
 * Parses a comma-separated `fields` query param into a Prisma `select` object.
 * Returns undefined if no fields specified (= return all fields).
 * Throws ValidationError for sensitive or invalid field names.
 */
export function parseFieldSelection(
  fieldsParam: string | undefined,
  whitelist: readonly string[],
): Record<string, boolean> | undefined {
  if (!fieldsParam || fieldsParam.trim() === "") {
    return undefined;
  }

  const requested = fieldsParam
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return undefined;
  }

  // Check for sensitive fields first
  const sensitive = requested.filter((f) =>
    (SENSITIVE_FIELDS as readonly string[]).includes(f),
  );
  if (sensitive.length > 0) {
    throw new ValidationError(
      `Cannot select sensitive fields: ${sensitive.join(", ")}`,
    );
  }

  // Check for invalid fields (not in whitelist)
  const invalid = requested.filter((f) => !whitelist.includes(f));
  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid fields: ${invalid.join(", ")}. Valid fields: ${whitelist.join(", ")}`,
    );
  }

  const select: Record<string, boolean> = {};
  for (const field of requested) {
    select[field] = true;
  }

  // Always include id for reference
  select.id = true;

  return select;
}

// ─── Per-resource field whitelists ──────────────────────────────────────────

export const USER_SELECTABLE_FIELDS = [
  "id",
  "email",
  "name",
  "role",
  "isBlocked",
  "isBuiltInAdmin",
  "createdAt",
  "updatedAt",
] as const;

export const RESTAURANT_SELECTABLE_FIELDS = [
  "id",
  "name",
  "description",
  "ownerId",
  "isBlocked",
  "createdAt",
  "updatedAt",
] as const;

export const MEAL_SELECTABLE_FIELDS = [
  "id",
  "name",
  "description",
  "price",
  "restaurantId",
  "isAvailable",
  "isBlocked",
  "createdAt",
  "updatedAt",
] as const;

export const ORDER_SELECTABLE_FIELDS = [
  "id",
  "customerId",
  "restaurantId",
  "status",
  "subtotal",
  "discountAmount",
  "tipAmount",
  "totalAmount",
  "couponId",
  "createdAt",
  "updatedAt",
] as const;

export const COUPON_SELECTABLE_FIELDS = [
  "id",
  "code",
  "discountPercent",
  "restaurantId",
  "isActive",
  "maxUsageTotal",
  "maxUsagePerCustomer",
  "currentUsageTotal",
  "expiresAt",
  "createdAt",
] as const;
