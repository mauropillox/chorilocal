import { test as setup, expect } from '@playwright/test';
import path from 'path';

/**
 * Authentication setup for E2E tests
 * This runs once before all tests to authenticate
 */

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page, request }) => {
    const isProd = process.env.TEST_ENV === 'production';
    const baseURL = isProd
        ? process.env.PROD_URL || 'https://www.pedidosfriosur.com'
        : 'http://localhost:5173';

    // Use test credentials
    const credentials = isProd
        ? {
            username: process.env.PROD_TEST_USER || 'admin',
            password: process.env.PROD_TEST_PASSWORD || 'admin420',
        }
        : {
            username: 'admin',
            password: 'admin123',
        };

    console.log('🔐 Authenticating:', credentials.username, 'on', baseURL);
    console.log('📝 Env vars:', {
        TEST_ENV: process.env.TEST_ENV,
        PROD_TEST_USER: process.env.PROD_TEST_USER ? '✅ SET' : '❌ NOT SET',
        PROD_TEST_PASSWORD: process.env.PROD_TEST_PASSWORD ? '✅ SET' : '❌ NOT SET',
    });

    await page.goto(baseURL);

    // Wait a bit for page to load
    await page.waitForTimeout(2000);

    // Take screenshot to see what we're getting
    await page.screenshot({ path: 'test-results/prod-page-loaded.png', fullPage: true });
    console.log('📸 Screenshot saved to test-results/prod-page-loaded.png');

    // Check if already logged in (might redirect to dashboard)
    const currentURL = page.url();
    console.log('📍 Current URL after navigation:', currentURL);

    if (!currentURL.includes('login') && !currentURL.includes('auth')) {
        console.log('✅ Already logged in! Saving auth state...');
        await page.context().storageState({ path: authFile });
        return;
    }

    // Wait for login page to load
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });

    // Fill login form (matching auth.spec.ts selectors)
    await page.fill('input[type="email"]', credentials.username);
    await page.fill('input[type="password"]', credentials.password);
    await page.click('button:has-text("Entrar")');

    // Wait for successful login (navigation to dashboard)
    await page.waitForURL(/dashboard|pedidos|productos|home/i, { timeout: 30000 });

    // Verify we're logged in by checking URL is NOT login/auth
    const finalURL = page.url();
    expect(finalURL).not.toMatch(/login|auth/i);

    // Save authentication state
    await page.context().storageState({ path: authFile });

    console.log('✅ Authentication successful, logged in to:', finalURL);
});
