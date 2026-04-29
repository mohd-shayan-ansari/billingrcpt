const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const result = await prisma.$executeRaw(Prisma.sql`
      UPDATE "Receipt"
      SET heading = 'Counter 0' || SUBSTRING(heading, 9)
      WHERE heading LIKE 'Counter _' AND LENGTH(heading) = 9
    `);
    console.log(`Updated ${result} rows.`);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
