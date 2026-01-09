// E2E tests for critical production flows
// These would have caught the 422 stock update error

import { test, expect } from '@playwright/test';

const API_URL = 'https://api.pedidosfriosur.com/api';
const BASE_URL = 'https://www.pedidosfriosur.com';

test.describe('Critical Production Flows', () => {
    let authToken;

    test.beforeAll(async ({ request }) => {
        // Get auth token
        const response = await request.post(`${API_URL}/login`, {
            form: {
                username: 'admin',
                password: 'admin420'
            }
        });
        const data = await response.json();
        authToken = data.access_token;
    });

    test('Stock Update - PATCH endpoint accepts both formats', async ({ request }) => {
        // Create test product with unique name
        const uniqueName = `E2E_TEST_${Date.now()}`;
        const createResponse = await request.post(`${API_URL}/productos`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                nombre: uniqueName,
                precio: 100,
                stock: 100
            }
        });
        expect(createResponse.ok()).toBeTruthy();
        const product = await createResponse.json();

        // Test 1: Absolute stock update (frontend pattern)
        const absoluteResponse = await request.patch(`${API_URL}/productos/${product.id}/stock`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            data: { stock: 75 }
        });

        expect(absoluteResponse.status()).toBe(200);
        const updated = await absoluteResponse.json();
        expect(updated.stock).toBe(75);

        // Test 2: Delta update (concurrent-safe)
        const deltaResponse = await request.patch(`${API_URL}/productos/${product.id}/stock`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            data: { delta: -5 }
        });

        expect(deltaResponse.status()).toBe(200);
        const afterDelta = await deltaResponse.json();
        expect(afterDelta.stock).toBe(70);

        // Cleanup
        await request.delete(`${API_URL}/productos/${product.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    });

    test('Stock Update - Validation errors return 422', async ({ request }) => {
        // Should return 422 for empty body
        const response = await request.patch(`${API_URL}/productos/1/stock`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            data: {}
        });

        expect(response.status()).toBe(422);
        const error = await response.json();
        // Check actual API response structure: { error, code, details }
        expect(error.error || error.detail).toBeTruthy();
    });

    test('Concurrent Stock Updates - Race condition handling', async ({ request }) => {
        // Create test product with unique name
        const uniqueName = `CONCURRENT_${Date.now()}`;
        const createResponse = await request.post(`${API_URL}/productos`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                nombre: uniqueName,
                precio: 100,
                stock: 100
            }
        });
        const product = await createResponse.json();

        // Launch 5 concurrent delta updates
        const updates = Array(5).fill(null).map(() =>
            request.patch(`${API_URL}/productos/${product.id}/stock`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: { delta: -5 }
            })
        );

        const results = await Promise.all(updates);

        // All should succeed
        results.forEach(r => expect(r.ok()).toBeTruthy());

        // Final stock should be around 75 (100 - 5*5)
        const checkResponse = await request.get(`${API_URL}/productos/${product.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const final = await checkResponse.json();
        expect(final.stock).toBeCloseTo(75, 0);

        // Cleanup
        await request.delete(`${API_URL}/productos/${product.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    });

    test('Response Time - Under 3 seconds', async ({ request }) => {
        const start = Date.now();

        const response = await request.get(`${API_URL}/productos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const elapsed = Date.now() - start;

        expect(response.ok()).toBeTruthy();
        // Allow 3s for production (network latency + Render cold start)
        expect(elapsed).toBeLessThan(3000);
    });
});
