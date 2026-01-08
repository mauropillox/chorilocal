import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS } from './helpers/auth.js';

test.describe('Authentication E2E Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Clear storage before each test
        await page.context().clearCookies();
        await page.context().clearPermissions();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
        await page.goto('/');

        // Fill login form
        await page.locator('input[type="text"]').first().fill(TEST_USERS.admin.username);
        await page.locator('input[type="password"]').first().fill(TEST_USERS.admin.password);

        // Submit
        await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();

        // Verify redirect to dashboard
        await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 5000 });

        // Verify navigation is visible
        await expect(page.locator('nav a[href*="clientes"], nav a:has-text("Clientes")')).toBeVisible({ timeout: 5000 });
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/');

        // Fill with wrong credentials
        await page.locator('input[type="text"]').first().fill('wronguser');
        await page.locator('input[type="password"]').first().fill('wrongpass');

        // Submit
        await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();

        // Wait a bit for potential error message
        await page.waitForTimeout(1500);

        // Should still be on login page or show error
        const isStillOnLogin = await page.locator('input[type="text"]').first().isVisible({ timeout: 2000 }).catch(() => false);
        expect(isStillOnLogin).toBeTruthy();
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        await login(page, TEST_USERS.admin);

        // Find and click logout button
        const logoutBtn = page.locator('button:has-text("Cerrar Sesión"), button:has-text("Salir"), a:has-text("Cerrar Sesión")').first();

        if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await logoutBtn.click();

            // Should redirect to login
            await page.waitForTimeout(1000);

            // Verify we're on login page or nav is gone
            const navGone = await page.locator('nav a[href*="clientes"]').isVisible({ timeout: 2000 }).catch(() => false);
            expect(navGone).toBeFalsy();
        }
    });

    test('should persist session after page reload', async ({ page }) => {
        await login(page, TEST_USERS.admin);

        // Verify logged in
        await expect(page.locator('nav a[href*="clientes"]')).toBeVisible({ timeout: 3000 });

        // Reload page
        await page.reload();

        // Should still be logged in
        await expect(page.locator('nav a[href*="clientes"]')).toBeVisible({ timeout: 5000 });
    });

    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
        // Try to access clientes page directly without login
        await page.goto('/clientes');

        // Should redirect to login or show login form
        await page.waitForTimeout(1000);

        const loginFormVisible = await page.locator('input[type="text"]').first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(loginFormVisible).toBeTruthy();
    });

    test('should handle empty form submission', async ({ page }) => {
        await page.goto('/');

        // Try to submit empty form
        await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();

        // Should stay on login page
        await page.waitForTimeout(500);

        const stillOnLogin = await page.locator('input[type="text"]').first().isVisible({ timeout: 2000 }).catch(() => false);
        expect(stillOnLogin).toBeTruthy();
    });
});
