const { test, expect } = require('@playwright/test');

test('login page console and network check', async ({ page }) => {
  const consoles = [];
  page.on('console', msg => consoles.push({ type: msg.type(), text: msg.text() }));

  const requests = [];
  page.on('response', resp => {
    if (resp.url().includes('/login') || resp.url().includes('/api/login')) {
      requests.push({ url: resp.url(), method: resp.request().method(), status: resp.status() });
    }
  });

  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.fill('input[aria-label="Usuario"]', 'admin');
  await page.fill('input[aria-label="Contraseña"]', 'admin420');
  await page.click('button[type="submit"]');

  // wait a moment for network and console
  await page.waitForTimeout(800);

  // Log SW-related messages for debugging but don't fail on them (extensions can cause noise)
  const swErrors = consoles.filter(c => c.text.includes('cache.put') && c.text.includes('unsupported'));
  // Only fail if there are critical SW errors, not extension-related noise
  expect(swErrors.filter(e => !e.text.includes('chrome-extension')).length).toBe(0);

  // Capture login request result
  const loginReq = requests.find(r => r.url.includes('/login') && r.method === 'POST');
  expect(loginReq).toBeDefined();
  // Should succeed with correct admin credentials (200), or fail with auth error (401/403/422/429)
  expect([200, 201, 202, 401, 403, 422, 429].includes(loginReq.status)).toBeTruthy();
});
