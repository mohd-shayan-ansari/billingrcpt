const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const test = await prisma.$queryRaw(Prisma.sql`
    SELECT
      r.timestamp,
      r.timestamp AT TIME ZONE 'Asia/Kolkata' as tz_converted,
      TO_CHAR(DATE(r.timestamp AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS local_date_1,
      TO_CHAR(r.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS local_date_2
    FROM "Receipt" r
    ORDER BY r.timestamp ASC
    LIMIT 1
  `);
  console.log(test);
}
run();
