const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const [users, rates, receipts] = await Promise.all([
        prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.rate.findMany({ orderBy: { itemKey: 'asc' } }),
        prisma.receipt.findMany({ orderBy: { timestamp: 'desc' }, take: 5 }),
    ]);

    console.log(JSON.stringify({
        userCount: users.length,
        users,
        rateCount: rates.length,
        rates,
        receiptCount: receipts.length,
        recentReceipts: receipts,
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async() => {
        await prisma.$disconnect();
    });