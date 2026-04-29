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