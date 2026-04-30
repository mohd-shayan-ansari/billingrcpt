const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.receipt.deleteMany({});
  console.log("Deleted", result.count, "receipts. Database is now clean.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma["$disconnect"]());
