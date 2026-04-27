import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "../config";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const databaseUrl = config.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
      }),
    ),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
