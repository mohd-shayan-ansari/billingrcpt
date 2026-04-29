const bcrypt = require('bcryptjs');
const { PrismaClient, Role } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const users = [
        { name: 'Counter 1', username: 'counter1@billing.local', password: 'pass12300' },
        { name: 'Counter 2', username: 'counter2@billing.local', password: 'pass45600' },
    ];

    for (const u of users) {
        const hash = await bcrypt.hash(u.password, 10);
        await prisma.user.upsert({
            where: { username: u.username },
            update: { name: u.name, passwordHash: hash, role: Role.COUNTER_ADMIN },
            create: { name: u.name, username: u.username, passwordHash: hash, role: Role.COUNTER_ADMIN },
        });
        console.log('Upserted', u.username);
    }

    const all = await prisma.user.findMany();
    console.log(JSON.stringify(all, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async() => {
        await prisma.$disconnect();
    });