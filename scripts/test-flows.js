(async() => {
    try {
        const base = 'http://localhost:3000';
        const master = { name: 'Master Admin', password: 'Admin@1234' };

        const loginRes = await fetch(base + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(master),
        });

        const setCookie = loginRes.headers.get('set-cookie');
        console.log('login status', loginRes.status);
        if (!setCookie) {
            console.error('No set-cookie returned');
            console.error(await loginRes.text());
            process.exit(1);
        }

        const cookie = setCookie.split(';')[0];
        console.log('Got cookie:', cookie);

        // Create a counter admin
        const newUser = { name: 'Counter One', password: 'Counter@123' };
        const createRes = await fetch(base + '/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify(newUser),
        });
        console.log('create user status', createRes.status);
        console.log('create user body:', await createRes.text());

        // Create two receipts for counter 1 (heading '1')
        const receiptPayload = (code, itemKey, qty) => ({ heading: '1', entries: [{ itemKey, code, qty }] });

        for (const payload of[receiptPayload('A01', 'andar', 1), receiptPayload('A02', 'andar', 2)]) {
            const r = await fetch(base + '/api/receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify(payload)
            });
            console.log('create receipt status', r.status);
            console.log('body:', await r.text());
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();