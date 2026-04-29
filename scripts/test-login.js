const fetch = global.fetch || require('node-fetch');

async function test(nameOrUsername, password) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nameOrUsername, password }),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
}

(async() => {
    // Test using username (email)
    await test('counter1@billing.local', 'pass12300');
    await test('admin@billing.local', 'Admin@1234');
})();