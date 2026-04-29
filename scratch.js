const { PrismaClient, Prisma } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function run() {
  try {
    const adminId = (await prisma.user.findFirst()).id;
    const receiptNumber = 'Z99';
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Receipt" (
        id,
        "receiptNumber",
        heading,
        "adminId",
        timestamp,
        "andarCode",
        "andarRate",
        "andarQty",
        "andarAmount",
        "baharCode",
        "baharRate",
        "baharQty",
        "baharAmount",
        "resultCode",
        "resultRate",
        "resultQty",
        "resultAmount",
        "totalAmount",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${crypto.randomUUID()},
        ${receiptNumber},
        'Counter 1',
        ${adminId},
        CURRENT_TIMESTAMP,
        '1',
        10,
        1,
        10,
        NULL,
        NULL,
        0,
        0,
        NULL,
        NULL,
        0,
        0,
        10,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
    console.log("Success");
  } catch (e) {
    console.log("Error:", e);
  }
}
run();
