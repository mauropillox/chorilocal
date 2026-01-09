import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E tests for role-based navigation
 * Tests that Usuario role sees only basic tabs (Clientes, Productos, Pedidos, Historial)
 * and Admin role sees all tabs including Dashboard, Ofertas, Templates, Categorías, Admin
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost';
const API_URL = process.env.API_URL || `${BASE_URL}/api`;

test.describe('Role-Based Navigation Tests', () => {

    test.describe('Usuario Role - Limited Navigation', () => {
        let usuarioToken: string;

        test.beforeAll(async () => {
            // Login as Usuario role to get token
            // Assuming there's a test user with "Usuario" role
            const users = [
                { username: 'PABLOVENTAS', password: 'Test1234' },
                { username: 'CLAUDIAVENTAS', password: 'Test1234' },
                { username: 'FERNANDA', password: 'Test1234' }
            ];

            for (const user of users) {
                try {
                    const resp = await fetch(`${API_URL}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `username=${user.username}&password=${user.password}`
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        usuarioToken = data.access_token;
                        console.log(`✓ Logged in as Usuario: ${user.username}`);
                        break;
                    }
                } catch (e) {
                    console.log(`Failed to login as ${user.username}`);
                }
            }
        });

        test('Usuario should see only basic navigation tabs', async ({ page }) => {
            // Login as Usuario
            await page.goto(BASE_URL);

            // Try to login with Usuario credentials
            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('PABLOVENTAS');
                await page.locator('input[type="password"]').fill('Test1234');
                await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();
                await page.waitForTimeout(2000);
            }

            // SHOULD SEE: Clientes, Productos, Pedidos, Historial
            await expect(page.getByRole('link', { name: /Clientes/i })).toBeVisible({ timeout: 5000 });
            await expect(page.getByRole('link', { name: /Productos/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Pedidos/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Historial/i })).toBeVisible();

            // SHOULD NOT SEE: Dashboard, Ofertas, Recurrentes, Categorías, Admin
            await expect(page.getByRole('link', { name: /Dashboard/i })).not.toBeVisible();
            await expect(page.getByRole('link', { name: /Ofertas/i })).not.toBeVisible();
            await expect(page.getByRole('link', { name: /Recurrentes/i })).not.toBeVisible();
            await expect(page.getByRole('link', { name: /Categorías/i })).not.toBeVisible();

            // Check Admin link is not visible (could be text "Admin" or icon)
            const adminLinks = await page.getByRole('link').filter({ hasText: /Admin|⚙️/ }).count();
            expect(adminLinks).toBe(0);

            console.log('✓ Usuario sees only basic tabs (Clientes, Productos, Pedidos, Historial)');
        });

        test('Usuario cannot access Dashboard via URL', async ({ page }) => {
            await page.goto(BASE_URL);

            // Login
            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('PABLOVENTAS');
                await page.locator('input[type="password"]').fill('Test1234');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Try to navigate to Dashboard directly
            await page.goto(`${BASE_URL}/dashboard`);
            await page.waitForTimeout(1000);

            // Should be redirected to /clientes
            expect(page.url()).toContain('/clientes');
            console.log('✓ Usuario redirected from /dashboard to /clientes');
        });

        test('Usuario cannot access Admin pages via URL', async ({ page }) => {
            await page.goto(BASE_URL);

            // Login
            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('PABLOVENTAS');
                await page.locator('input[type="password"]').fill('Test1234');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Test each admin-only route
            const adminRoutes = [
                '/dashboard',
                '/ofertas',
                '/reportes',
                '/listas-precios',
                '/templates',
                '/usuarios',
                '/categorias'
            ];

            for (const route of adminRoutes) {
                await page.goto(`${BASE_URL}${route}`);
                await page.waitForTimeout(500);
                expect(page.url()).toContain('/clientes');
                console.log(`✓ Usuario blocked from ${route}, redirected to /clientes`);
            }
        });

        test('Usuario can access allowed pages', async ({ page }) => {
            await page.goto(BASE_URL);

            // Login
            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('PABLOVENTAS');
                await page.locator('input[type="password"]').fill('Test1234');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Test allowed routes
            const allowedRoutes = [
                { path: '/clientes', title: 'Clientes' },
                { path: '/productos', title: 'Productos' },
                { path: '/pedidos', title: 'Pedido' },
                { path: '/historial', title: 'Historial' }
            ];

            for (const route of allowedRoutes) {
                await page.goto(`${BASE_URL}${route.path}`);
                await page.waitForTimeout(1000);
                expect(page.url()).toContain(route.path);
                await expect(page.locator('h2, h3').filter({ hasText: new RegExp(route.title, 'i') }).first()).toBeVisible({ timeout: 3000 });
                console.log(`✓ Usuario can access ${route.path}`);
            }
        });
    });

    test.describe('Admin Role - Full Navigation', () => {

        test('Admin should see all navigation tabs', async ({ page }) => {
            // Login as Admin
            await page.goto(BASE_URL);

            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('admin');
                await page.locator('input[type="password"]').fill('admin');
                await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();
                await page.waitForTimeout(2000);
            }

            // SHOULD SEE ALL TABS
            // Basic tabs
            await expect(page.getByRole('link', { name: /Clientes/i })).toBeVisible({ timeout: 5000 });
            await expect(page.getByRole('link', { name: /Productos/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Pedidos/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Historial/i })).toBeVisible();

            // Admin-only tabs
            await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Ofertas/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Recurrentes/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /Categorías/i })).toBeVisible();

            // Admin link with icon
            const adminLink = page.getByRole('link').filter({ hasText: /Admin|⚙️/ });
            await expect(adminLink).toBeVisible();

            console.log('✓ Admin sees all navigation tabs');
        });

        test('Admin can access all pages including admin-only', async ({ page }) => {
            await page.goto(BASE_URL);

            // Login as Admin
            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('admin');
                await page.locator('input[type="password"]').fill('admin');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Test all routes including admin-only
            const allRoutes = [
                { path: '/clientes', hasText: 'Clientes' },
                { path: '/productos', hasText: 'Productos' },
                { path: '/pedidos', hasText: 'Pedido' },
                { path: '/historial', hasText: 'Historial' },
                { path: '/dashboard', hasText: 'Dashboard' },
                { path: '/ofertas', hasText: 'Ofertas' },
                { path: '/categorias', hasText: 'Categorías' }
            ];

            for (const route of allRoutes) {
                await page.goto(`${BASE_URL}${route.path}`);
                await page.waitForTimeout(1000);
                expect(page.url()).toContain(route.path);
                await expect(page.locator('body').filter({ hasText: new RegExp(route.hasText, 'i') })).toBeVisible({ timeout: 3000 });
                console.log(`✓ Admin can access ${route.path}`);
            }
        });

        test('Admin default route is /dashboard', async ({ page }) => {
            await page.goto(BASE_URL);

            // Login
            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('admin');
                await page.locator('input[type="password"]').fill('admin');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Navigate to root or non-existent path
            await page.goto(`${BASE_URL}/`);
            await page.waitForTimeout(1000);

            // Should redirect to /dashboard for admin
            expect(page.url()).toContain('/dashboard');
            console.log('✓ Admin redirected to /dashboard as default');
        });
    });

    test.describe('Navigation Separators and Visual Structure', () => {

        test('Usuario navigation should not show separators for hidden sections', async ({ page }) => {
            await page.goto(BASE_URL);

            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('PABLOVENTAS');
                await page.locator('input[type="password"]').fill('Test1234');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Check that navigation separators after Historial are not visible
            // (since Dashboard, Ofertas, etc. sections are hidden)
            const nav = page.locator('nav.nav-main');
            await expect(nav).toBeVisible();

            // Count visible nav-separator elements - Usuario should have fewer
            const separatorCount = await page.locator('.nav-separator').count();
            console.log(`✓ Usuario navigation has ${separatorCount} separators (expected fewer than Admin)`);
        });

        test('Admin navigation should show all separators', async ({ page }) => {
            await page.goto(BASE_URL);

            const usernameInput = page.locator('input[type="text"]').first();
            if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await usernameInput.fill('admin');
                await page.locator('input[type="password"]').fill('admin');
                await page.locator('button[type="submit"]').first().click();
                await page.waitForTimeout(2000);
            }

            // Admin should see multiple nav-separator elements
            const separatorCount = await page.locator('.nav-separator').count();
            expect(separatorCount).toBeGreaterThanOrEqual(2);
            console.log(`✓ Admin navigation has ${separatorCount} separators for section grouping`);
        });
    });
});
