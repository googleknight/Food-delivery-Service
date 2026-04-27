import request from "supertest";
import app from "../src/app";
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/utils/prisma";

// Counter for unique test data
let counter = 0;
function unique(prefix: string) {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export interface TestUserResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TestRestaurant {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export { app, prisma, request };

/**
 * Creates a user and returns their auth tokens + user data
 */
export async function createAndLoginUser(
  role: Role = Role.CUSTOMER,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUserResponse> {
  const email = overrides.email || `${unique("user")}@test.com`;
  const password = overrides.password || "Test@123456";
  const name = overrides.name || `Test ${role}`;

  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password, name, role });

  if (res.status !== 201) {
    throw new Error(`Failed to create user: ${JSON.stringify(res.body)}`);
  }

  return {
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

/**
 * Login as the built-in admin
 */
export async function loginAsAdmin(): Promise<TestUserResponse> {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({
      email: process.env.ADMIN_EMAIL || "admin@fooddelivery.com",
      password: process.env.ADMIN_PASSWORD || "Admin@123456",
    });

  if (res.status !== 200) {
    throw new Error(`Failed to login as admin: ${JSON.stringify(res.body)}`);
  }

  return {
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

/**
 * Create a restaurant (requires owner token)
 */
export async function createTestRestaurant(
  accessToken: string,
  overrides: Partial<{ name: string; description: string }> = {},
): Promise<TestRestaurant> {
  const res = await request(app)
    .post("/api/v1/restaurants")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: overrides.name || `Restaurant ${unique("rest")}`,
      description:
        overrides.description || "A test restaurant serving test food",
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create restaurant: ${JSON.stringify(res.body)}`);
  }

  return res.body.data;
}

/**
 * Create a meal (requires owner token)
 */
export async function createTestMeal(
  accessToken: string,
  restaurantId: string,
  overrides: Partial<{ name: string; description: string; price: number }> = {},
) {
  const res = await request(app)
    .post(`/api/v1/restaurants/${restaurantId}/meals`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: overrides.name || `Meal ${unique("meal")}`,
      description: overrides.description || "A delicious test meal",
      price: overrides.price || 12.99,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create meal: ${JSON.stringify(res.body)}`);
  }

  return res.body.data;
}

/**
 * Create a coupon (requires owner token)
 */
export async function createTestCoupon(
  accessToken: string,
  restaurantId: string,
  overrides: Partial<{
    code: string;
    discountPercent: number;
    maxUsageTotal: number | null;
    maxUsagePerCustomer: number | null;
    expiresAt: string | null;
  }> = {},
) {
  const res = await request(app)
    .post(`/api/v1/restaurants/${restaurantId}/coupons`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      code: overrides.code || unique("COUPON"),
      discountPercent: overrides.discountPercent || 10,
      maxUsageTotal: overrides.maxUsageTotal,
      maxUsagePerCustomer: overrides.maxUsagePerCustomer,
      expiresAt: overrides.expiresAt,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create coupon: ${JSON.stringify(res.body)}`);
  }

  return res.body.data;
}

/**
 * Clean up test data between tests
 */
export async function cleanupDatabase() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== "_prisma_migrations")
    .map((name) => `"public"."${name}"`)
    .join(", ");

  if (tables.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Re-seed admin after cleanup
 */
export async function seedAdmin() {
  const adminEmail = (
    process.env.ADMIN_EMAIL || "admin@fooddelivery.com"
  ).toLowerCase();

  const hashedPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "Admin@123456",
    12,
  );

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: process.env.ADMIN_NAME || "System Admin",
      role: "ADMIN",
      isBuiltInAdmin: true,
    },
  });
}
