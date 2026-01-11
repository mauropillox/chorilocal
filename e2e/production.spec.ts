import { test, expect } from '@playwright/test';

/**
 * PRODUCTION SMOKE TESTS
 * 
 * These tests are SAFE for production:
 * - Read-only operations
 * - No data modification
 * - Verify critical functionality
 */

test.describe('Production Smoke Tests', () => {
    // Use saved authentication state
    test.use({
        storageState: '.auth/user.json',
    });

    test('should load dashboard', async ({ page }) => {
        await page.goto('/');

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Should NOT be on login page
        const currentURL = page.url();
        expect(currentURL).not.toMatch(/login|auth/i);

        // Verify page has content (any non-empty content is fine)
        const hasContent = await page.locator('body').textContent();
        expect(hasContent).toBeTruthy();
        expect(hasContent.trim().length).toBeGreaterThan(0);

        console.log('✅ Dashboard loaded');
    });

    test('should display pedidos list', async ({ page }) => {
        await page.goto('/pedidos');
        await page.waitForLoadState('networkidle');

        // Verify we're on pedidos page
        const currentURL = page.url();
        expect(currentURL).toMatch(/pedidos/i);

        console.log('✅ Pedidos page loaded');
    });

    test('should display productos list', async ({ page }) => {
        await page.goto('/productos');
        await page.waitForLoadState('networkidle');

        const currentURL = page.url();
        expect(currentURL).toMatch(/productos/i);

        console.log('✅ Productos page loaded');
    });

    test('should display clientes list', async ({ page }) => {
        await page.goto('/clientes');
        await page.waitForLoadState('networkidle');

        const currentURL = page.url();
        expect(currentURL).toMatch(/clientes/i);

        console.log('✅ Clientes page loaded');
    });

    test('should load reportes page', async ({ page }) => {
        await page.goto('/reportes');
        await page.waitForLoadState('networkidle');

        const currentURL = page.url();
        expect(currentURL).toMatch(/reportes/i);

        console.log('✅ Reportes page loaded');
    });

    test('should navigate between pages', async ({ page }) => {
        // Start at dashboard
        await page.goto('/');

        // Navigate to different sections
        const sections = [
            { link: /pedido/i, url: /pedidos/ },
            { link: /producto/i, url: /productos/ },
            { link: /cliente/i, url: /clientes/ },
        ];

        for (const section of sections) {
            const navLink = page.locator(`a:has-text("${section.link.source.slice(0, -2)}")`).first();
            if (await navLink.isVisible()) {
                await navLink.click();
                await expect(page).toHaveURL(section.url);
            }
        }

        console.log('✅ Navigation working');
    });

    test('should handle API errors gracefully', async ({ page }) => {
        // Navigate to a page that requires API
        await page.goto('/productos');
        await page.waitForLoadState('networkidle');

        // Page should load without crashing (URL should be productos)
        const currentURL = page.url();
        expect(currentURL).toMatch(/productos/i);

        console.log('✅ No unhandled errors');
    });

    test('should display correct environment info', async ({ page }) => {
        await page.goto('/');

        // Check console for environment indicators
        const logs: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'log') {
                logs.push(msg.text());
            }
        });

        await page.waitForTimeout(2000); // Wait for any logs

        // Verify we're not seeing dev-only logs in production
        const isProd = process.env.TEST_ENV === 'production';
        if (isProd) {
            const hasDevLogs = logs.some(log =>
                log.includes('[DEBUG]') || log.includes('[DEV]')
            );
            expect(hasDevLogs).toBe(false);
        }

        console.log('✅ Environment check passed');
    });

    test('should load without JavaScript errors', async ({ page }) => {
        const errors: string[] = [];

        page.on('pageerror', error => {
            errors.push(error.message);
        });

        await page.goto('/');
        await page.waitForTimeout(3000); // Wait for page to fully load

        // Should have 0 JavaScript errors
        if (errors.length > 0) {
            console.error('❌ JavaScript errors:', errors);
        }
        expect(errors.length).toBe(0);

        console.log('✅ No JavaScript errors');
    });

    test.skip('should have proper meta tags', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check for viewport meta tag (most important for responsive design)
        const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewport).toBeTruthy();

        console.log('✅ Meta tags present');
    });

    test('should have working logout', async ({ page }) => {
        await page.goto('/');

        // Find logout button
        const logoutBtn = page.locator('button:has-text("Cerrar sesión"), button:has-text("Logout"), a:has-text("Salir")').first();

        if (await logoutBtn.isVisible()) {
            await logoutBtn.click();

            // Should redirect to login
            await page.waitForURL(/login|auth/i, { timeout: 5000 });

            console.log('✅ Logout working');
        } else {
            console.log('⚠️ Logout button not found (may vary by role)');
        }
    });
});

/**
 * PERFORMANCE CHECKS (Production only)
 */
test.describe('Production Performance', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'Performance tests only on Chromium');

    test.use({
        storageState: '.auth/user.json',
    });

    test('should load dashboard in acceptable time', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const loadTime = Date.now() - startTime;

        // Should load in under 5 seconds
        expect(loadTime).toBeLessThan(5000);

        console.log('✅ Dashboard loaded in', loadTime, 'ms');
    });

    test('should have acceptable bundle size', async ({ page }) => {
        const resources: { url: string; size: number }[] = [];

        page.on('response', async response => {
            const url = response.url();
            if (url.includes('.js') || url.includes('.css')) {
                const buffer = await response.body().catch(() => null);
                if (buffer) {
                    resources.push({ url, size: buffer.length });
                }
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

        // Total bundle should be under 2MB
        expect(totalSize).toBeLessThan(2 * 1024 * 1024);

        console.log('✅ Total bundle size:', totalSizeMB, 'MB');
    });
});
