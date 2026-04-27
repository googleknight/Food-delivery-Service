import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";

export default async function setup() {
  // 1. Load base .env to get DATABASE_URL_TEST if it exists
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });

  // 2. Load test env (overrides base .env)
  dotenv.config({
    path: path.resolve(process.cwd(), ".env.test"),
    override: true,
  });

  // 3. Prioritize DATABASE_URL_TEST if it exists
  if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  }

  // Set fallback if still not set
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/food_delivery_test";

  try {
    // Reset, migrate, and seed test database
    execSync("npx prisma migrate reset --force", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "pipe",
    });

    console.log("✅ Test database ready");
  } catch (error) {
    console.error("❌ Failed to setup test database:", error);
    throw error;
  }
}
