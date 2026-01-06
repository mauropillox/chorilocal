const { test, expect } = require('@playwright/test');

test('service worker provides offline page', async ({ page, context }) => {
    // Visit the app while online to allow SW registration
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Give the service worker a moment to register
    await page.waitForTimeout(500);

    // Emulate offline and reload; the SW should serve cached index.html
    await context.setOffline(true);
    await page.goto('http://localhost:5173', { waitUntil: 'load' });

    const body = await page.content();
    expect(body).toContain('id="root"');
});
