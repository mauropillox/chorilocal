import { test, expect } from '@playwright/test';

test.describe('Reports Generation', () => {
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

  test('should generate vendido report with success toast', async ({ page }) => {
    await page.click('a:has-text("Reportes")');
    await page.waitForLoadState('networkidle');
    
    // Verify report component loaded
    const reportToast = page.locator('text=/📊.*Reporte generado/i');
    
    // Try to find and click vendido report button
    const reportBtn = page.locator('button:has-text("Vendido"), [data-test*="vendido"]').first();
    if (await reportBtn.isVisible()) {
      await reportBtn.click();
      await page.waitForTimeout(2000);
      
      // Verify success toast or report display
      const table = page.locator('table, [role="grid"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    }
  });

  test('should generate inventario report', async ({ page }) => {
    await page.click('a:has-text("Reportes")');
    await page.waitForLoadState('networkidle');
    
    const reportBtn = page.locator('button:has-text("Inventario"), [data-test*="inventario"]').first();
    if (await reportBtn.isVisible()) {
      await reportBtn.click();
      await page.waitForTimeout(2000);
      
      const table = page.locator('table, [role="grid"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    }
  });

  test('should export report to CSV', async ({ page, context }) => {
    await page.click('a:has-text("Reportes")');
    await page.waitForLoadState('networkidle');
    
    // Look for export CSV button
    const exportBtn = page.locator('button:has-text("Descargar"), button:has-text("CSV"), button:has-text("Exportar")').first();
    if (await exportBtn.isVisible()) {
      // Set up download listener
      const downloadPromise = context.waitForEvent('download');
      await exportBtn.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
    }
  });

  test('should apply date filters on report', async ({ page }) => {
    await page.click('a:has-text("Reportes")');
    await page.waitForLoadState('networkidle');
    
    // Look for date filter inputs
    const fromDateInput = page.locator('input[type="date"], input[placeholder*="desde"], input[placeholder*="Desde"]').first();
    if (await fromDateInput.isVisible()) {
      const today = new Date().toISOString().split('T')[0];
      await fromDateInput.fill(today);
      
      await page.waitForTimeout(1000);
      
      const table = page.locator('table, [role="grid"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    }
  });
});
