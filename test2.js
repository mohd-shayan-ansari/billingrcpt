const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const receipts = await prisma.receipt.findMany({
    orderBy: { timestamp: 'asc' }
  });
  let byHour = {};
  for (let r of receipts) {
    let d = new Date(r.timestamp);
    let h = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    let prefix = h.substring(0, 2);
    byHour[prefix] = (byHour[prefix] || 0) + 1;
  }
  console.log('Receipts by hour (IST):', byHour);
}
run();
