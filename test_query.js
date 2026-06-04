const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const date = '2026-06-04';
  const limitClause = Prisma.empty;
  const whereClause = Prisma.sql`WHERE TO_CHAR(DATE(r.timestamp AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') = ${date}`;
  const receipts = await prisma.$queryRaw(Prisma.sql`
    SELECT r.id, r.timestamp
    FROM "Receipt" r
    ${whereClause}
    ORDER BY r.timestamp ASC
    ${limitClause}
  `);
  console.log('Total returned:', receipts.length);
}
run();
