import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/utils/prisma";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@fooddelivery.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.ADMIN_NAME || "System Admin";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
  });

  if (existingAdmin) {
    console.log(`Built-in admin already exists: ${adminEmail}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.create({
    data: {
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      name: adminName,
      role: Role.ADMIN,
      isBuiltInAdmin: true,
    },
  });

  console.log(`Built-in admin created: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
