const https = require('https');

async function testProductCreation() {
    // Login first
    const loginData = new URLSearchParams({
        username: 'admin',
        password: 'admin420'
    }).toString();
    
    const token = await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.pedidosfriosur.com',
            path: '/api/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': loginData.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                resolve(json.access_token);
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
    
    console.log('✅ Got token:', token.substring(0, 20) + '...');
    
    // Try to create product
    const productData = JSON.stringify({
        nombre: 'TEST_E2E',
        precio: 100,
        stock: 100
    });
    
    const createResult = await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.pedidosfriosur.com',
            path: '/api/productos',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': productData.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                console.log('Response:', data);
                resolve({ status: res.statusCode, body: data });
            });
        });
        req.on('error', reject);
        req.write(productData);
        req.end();
    });
    
    if (createResult.status === 200 || createResult.status === 201) {
        console.log('✅ Product created successfully');
    } else {
        console.log('❌ Product creation failed');
        console.log('Status:', createResult.status);
        console.log('Body:', createResult.body);
    }
}

testProductCreation().catch(console.error);
