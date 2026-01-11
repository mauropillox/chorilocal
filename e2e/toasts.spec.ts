import { test, expect } from '@playwright/test';

test.describe('Toast Success Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    const logoutBtn = page.locator('button:has-text("Cerrar sesión")');
    if (!await logoutBtn.isVisible()) {
      await page.goto('/');
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Entrar")');
      await page.waitForNavigation();
    }
  });

  const toastChecks = [
    { tab: 'Dashboard', emoji: '📊', message: 'Dashboard actualizado' },
    { tab: 'Reportes', emoji: '📊', message: 'Reporte generado' },
    { tab: 'Productos', emoji: '📦', message: 'Productos cargados' },
    { tab: 'Clientes', emoji: '👥', message: 'Clientes cargados' },
    { tab: 'Pedidos', emoji: '📦', message: 'cargados' },
    { tab: 'HojaRuta', emoji: '🗺', message: 'Hoja de ruta' },
    { tab: 'Usuarios', emoji: '👥', message: 'Usuarios cargados' },
    { tab: 'Plantillas', emoji: '📋', message: 'Plantillas' },
    { tab: 'ListasPrecios', emoji: '💰', message: 'Listas de precios' },
    { tab: 'Ofertas', emoji: '🎁', message: 'Ofertas' },
    { tab: 'Categorías', emoji: '📂', message: 'Categorías' },
    { tab: 'AdminPanel', emoji: '👤', message: 'Usuarios y roles' },
    { tab: 'OfflineQueue', emoji: '📡', message: 'Cola offline' },
  ];

  for (const check of toastChecks) {
    test(`should show ${check.emoji} toast for ${check.tab}`, async ({ page }) => {
      const tabLink = page.locator(`a:has-text("${check.tab}"), button:has-text("${check.tab}")`).first();
      
      if (await tabLink.isVisible()) {
        await tabLink.click();
        await page.waitForLoadState('networkidle');
        
        // Look for toast with emoji or message
        const toast = page.locator(`text=/${check.emoji}|${check.message}/i`);
        await expect(toast).toBeVisible({ timeout: 5000 });
      }
    });
  }

  test('should show login success toast', async ({ page }) => {
    // Logout first
    const logoutBtn = page.locator('button:has-text("Cerrar sesión")');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForNavigation();
    }
    
    // Login again
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Entrar")');
    await page.waitForNavigation();
    
    // Verify success toast
    const loginToast = page.locator('text=/🔓.*Bienvenido/i');
    await expect(loginToast).toBeVisible({ timeout: 5000 });
  });
});
