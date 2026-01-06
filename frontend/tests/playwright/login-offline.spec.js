const { test, expect } = require('@playwright/test');

test('register, login, enqueue cliente while offline and sync when online', async ({ page, context }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

    // Ensure page loads and SW registered
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });

    // Login via UI using pre-activated test user
    await page.fill('input[aria-label="Usuario"]', 'e2e_test');
    await page.fill('input[aria-label="Contraseña"]', 'TestPass1');
    await page.click('button:has-text("Ingresar")');

    // Wait for UI to show authenticated state (nav link 'Clientes' or token in storage)
    await Promise.race([
        page.waitForSelector('text=Clientes', { timeout: 15000 }).catch(() => null),
        page.waitForFunction(() => !!localStorage.getItem('token'), { timeout: 15000 }).catch(() => null)
    ]);

    // Navigate to clientes create form
    await page.goto(`${base}/clientes?crear=1`, { waitUntil: 'networkidle', timeout: 60000 });

    // Get initial clientes count from API
    const initial = await page.evaluate(async () => {
        try {
            const res = await fetch('/api/clientes');
            const data = await res.json().catch(() => []);
            return Array.isArray(data) ? data.length : (data.total || 0);
        } catch (e) { return 0; }
    });

    // Go offline and create a cliente via the UI (this should enqueue via authFetch)
    await context.setOffline(true);
    await page.fill('input[placeholder="Nombre del cliente"]', 'Cliente E2E Offline');
    await page.click('button:has-text("Agregar Cliente")');

    // Wait briefly to allow enqueue logic to run
    await page.waitForTimeout(1200);

    // Back online and wait for sync
    await context.setOffline(false);

    // Poll the API until a new cliente appears (max 20s)
    const synced = await page.waitForFunction(async (initial) => {
        try {
            const res = await fetch('/api/clientes');
            const data = await res.json();
            const len = Array.isArray(data) ? data.length : (data.total || 0);
            return len > initial ? true : false;
        } catch (e) { return false; }
    }, initial, { timeout: 20000 });

    expect(synced).toBeTruthy();
});
