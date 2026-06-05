import { PrismaClient } from '@prisma/client';

const oldPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:Kbs87976757@db.dyrhkigsufgcbsvpvkfy.supabase.co:5432/postgres"
    }
  }
});

const newPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:KBS87976757@db.agpucrungpefevhigxqm.supabase.co:5432/postgres"
    }
  }
});

async function main() {
  console.log("Connecting to databases...");
  
  console.log("Wiping existing seeded data from new DB to prevent conflicts...");
  await newPrisma.receipt.deleteMany();
  await newPrisma.winnerDeduction.deleteMany();
  await newPrisma.winningResult.deleteMany();
  await newPrisma.user.deleteMany();
  await newPrisma.rate.deleteMany();
  
  console.log("Fetching users...");
  const users = await oldPrisma.user.findMany();
  console.log(`Migrating ${users.length} users...`);
  await newPrisma.user.createMany({ data: users });
  
  console.log("Fetching rates...");
  const rates = await oldPrisma.rate.findMany();
  console.log(`Migrating ${rates.length} rates...`);
  await newPrisma.rate.createMany({ data: rates });
  
  console.log("Fetching winner deductions...");
  const deductions = await oldPrisma.winnerDeduction.findMany();
  console.log(`Migrating ${deductions.length} deductions...`);
  await newPrisma.winnerDeduction.createMany({ data: deductions });
  
  console.log("Fetching winning results...");
  const results = await oldPrisma.winningResult.findMany();
  console.log(`Migrating ${results.length} results...`);
  await newPrisma.winningResult.createMany({ data: results });
  
  console.log("Fetching receipts (this might take a few seconds)...");
  const receipts = await oldPrisma.receipt.findMany();
  console.log(`Migrating ${receipts.length} receipts...`);
  
  const BATCH_SIZE = 1000;
  for (let i = 0; i < receipts.length; i += BATCH_SIZE) {
    const batch = receipts.slice(i, i + BATCH_SIZE);
    // TypeScript workaround for Json field compatibility between client instances
    const safeBatch = batch.map(r => ({
      ...r,
      entries: r.entries ? JSON.parse(JSON.stringify(r.entries)) : null
    }));
    await newPrisma.receipt.createMany({ data: safeBatch as any });
    console.log(`Inserted receipts ${i + 1} to ${Math.min(i + BATCH_SIZE, receipts.length)}`);
  }
  
  console.log("✅ Migration complete! Your new database has all the data.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => {
    oldPrisma.$disconnect();
    newPrisma.$disconnect();
  });
