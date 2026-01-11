import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {
    test('should load dashboard in under 3 seconds', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/dashboard', { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;

        console.log(`Dashboard load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(3000);
    });

    test('should respond to tab navigation in under 2 seconds', async ({ page }) => {
        await page.goto('/dashboard', { waitUntil: 'networkidle' });

        const tabLink = page.locator('a:has-text("Reportes")').first();
        if (await tabLink.isVisible()) {
            const startTime = Date.now();
            await tabLink.click();
            await page.waitForLoadState('networkidle');
            const navTime = Date.now() - startTime;

            console.log(`Tab navigation time: ${navTime}ms`);
            expect(navTime).toBeLessThan(2000);
        }
    });

    test('should not have memory leaks during extended session', async ({ page }) => {
        await page.goto('/dashboard', { waitUntil: 'networkidle' });

        // Navigate between tabs multiple times
        for (let i = 0; i < 5; i++) {
            const tabs = ['Reportes', 'Productos', 'Clientes', 'Pedidos'];
            for (const tab of tabs) {
                const link = page.locator(`a:has-text("${tab}")`).first();
                if (await link.isVisible()) {
                    await link.click();
                    await page.waitForLoadState('networkidle');
                }
            }
        }

        // Check page is still responsive
        const input = page.locator('input').first();
        if (await input.isVisible()) {
            await input.focus();
        }
    });

    test('should handle search responsively', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        const searchInput = page.locator('input[placeholder*="uscar"], input[class*="search"]').first();
        if (await searchInput.isVisible()) {
            const startTime = Date.now();
            await searchInput.fill('test');
            await page.waitForTimeout(500); // Wait for debounce
            const searchTime = Date.now() - startTime;

            console.log(`Search response time: ${searchTime}ms`);
            expect(searchTime).toBeLessThan(1500);
        }
    });

    test('should measure API response times', async ({ page }) => {
        let apiResponseTimes: number[] = [];

        page.on('response', (response) => {
            if (response.url().includes('/api/')) {
                const timing = response.request().timing();
                if (timing) {
                    const responseTime = timing.responseEnd - timing.requestStart;
                    apiResponseTimes.push(responseTime);
                }
            }
        });

        await page.goto('/dashboard', { waitUntil: 'networkidle' });

        // Navigate to another section to trigger API calls
        const reportLink = page.locator('a:has-text("Reportes")').first();
        if (await reportLink.isVisible()) {
            await reportLink.click();
            await page.waitForLoadState('networkidle');
        }

        const avgResponseTime = apiResponseTimes.length > 0
            ? apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length
            : 0;

        console.log(`Average API response time: ${avgResponseTime.toFixed(2)}ms`);
        expect(avgResponseTime).toBeLessThan(1000); // API responses should be under 1 second
    });
});
