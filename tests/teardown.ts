import { prisma } from "../src/utils/prisma";

export default async function teardown() {
  await prisma.$disconnect();
}
