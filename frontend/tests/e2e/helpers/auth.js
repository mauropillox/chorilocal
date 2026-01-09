// Helper functions for authentication in E2E tests

export const TEST_USERS = {
    admin: {
        username: process.env.TEST_ADMIN_USER || 'admin',
        password: process.env.TEST_ADMIN_PASSWORD || 'admin420',
        role: 'admin'
    },
    vendedor: {
        username: process.env.TEST_VENDEDOR_USER || 'vendedor',
        password: process.env.TEST_VENDEDOR_PASSWORD || 'vendedor123',
        role: 'vendedor'
    }
};

/**
 * Login helper function for E2E tests
 * @param {import('@playwright/test').Page} page
 * @param {Object} user - User credentials {username, password}
 */
export async function login(page, user = TEST_USERS.admin) {
    await page.goto('/');

    // Check if we're already logged in
    const isLoggedIn = await page.locator('nav a[href*="clientes"], nav a:has-text("Clientes")')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

    if (isLoggedIn) {
        return;
    }

    // Wait for login form
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });

    // Fill login form
    await page.locator('input[type="text"]').first().fill(user.username);
    await page.locator('input[type="password"]').first().fill(user.password);

    // Submit form
    await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();

    // Wait for navigation to complete
    await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 5000 });

    // Verify logged in by checking for navigation
    await page.waitForSelector('nav a[href*="clientes"], nav a:has-text("Clientes")', { timeout: 5000 });
}

/**
 * Logout helper function
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
    // Look for logout button (usually in nav or user menu)
    const logoutButton = page.locator('button:has-text("Cerrar Sesión"), button:has-text("Salir")').first();

    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutButton.click();
        await page.waitForURL((url) => url.pathname.includes('login') || url.pathname === '/', { timeout: 3000 });
    }
}

/**
 * Get auth token from API for direct API calls
 */
export async function getAuthToken(user = TEST_USERS.admin) {
    const apiUrl = process.env.API_URL || 'http://localhost/api';

    const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${user.username}&password=${user.password}`
    });

    if (!response.ok) {
        throw new Error(`Failed to get auth token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Setup authenticated state for tests
 * @param {import('@playwright/test').Page} page
 * @param {Object} user
 */
export async function setupAuthState(page, user = TEST_USERS.admin) {
    await login(page, user);

    // Save authentication state
    const storage = await page.context().storageState();
    return storage;
}
