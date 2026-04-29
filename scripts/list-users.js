const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async() => {
    try {
        const users = await prisma.user.findMany();
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error listing users:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
/* eslint-disable @typescript-eslint/no-require-imports */

(async() => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const users = await prisma.user.findMany();
        console.log(JSON.stringify(users, null, 2));
        await prisma.$disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();