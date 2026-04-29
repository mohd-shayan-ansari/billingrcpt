import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const masterUsername = "admin@billing.local";
  const masterPassword = "Admin@1234";
  const passwordHash = await bcrypt.hash(masterPassword, 10);

  await prisma.user.upsert({
    where: { username: masterUsername },
    update: {
      name: "Master Admin",
      passwordHash,
      role: Role.MASTER_ADMIN,
    },
    create: {
      name: "Master Admin",
      username: masterUsername,
      passwordHash,
      role: Role.MASTER_ADMIN,
    },
  });

  const defaults = [
    { itemKey: "andar", label: "Andar", rate: 12 },
    { itemKey: "bahar", label: "Bahar", rate: 55 },
    { itemKey: "result", label: "Result", rate: 110 },
  ];

  for (const rate of defaults) {
    await prisma.rate.upsert({
      where: { itemKey: rate.itemKey },
      update: { label: rate.label, rate: rate.rate },
      create: rate,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });