import { test, expect } from '@playwright/test';

test.describe('Navigation and UI', () => {
  test('should navigate between main tabs', async ({ page }) => {
    await page.goto('/dashboard');
    
    const tabs = ['Dashboard', 'Reportes', 'Productos', 'Clientes', 'Pedidos', 'Usuarios'];
    
    for (const tab of tabs) {
      const tabLink = page.locator(`a:has-text("${tab}")`, { ignoreCase: true });
      if (await tabLink.isVisible()) {
        await tabLink.click();
        await page.waitForLoadState('networkidle');
        
        // Verify navigation happened
        const content = page.locator('main, [role="main"], .content').first();
        await expect(content).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should show sidebar menu on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard');
    
    const sidebar = page.locator('aside, nav[class*="sidebar"], [class*="nav"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should toggle mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    const menuBtn = page.locator('button[class*="menu"], button[class*="hamburger"], [aria-label*="menu"]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      
      const menu = page.locator('nav, [role="navigation"]').first();
      await expect(menu).toBeVisible({ timeout: 3000 });
    }
  });

  test('should search globally', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('input[placeholder*="uscar"], input[class*="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // Verify search results or loading state
      const results = page.locator('[class*="result"], [class*="search"]');
      await expect(results.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/dashboard');
    
    const themeBtn = page.locator('button[aria-label*="dark"], button[aria-label*="theme"], button[title*="dark"]').first();
    if (await themeBtn.isVisible()) {
      const htmlBefore = await page.locator('html').getAttribute('class');
      await themeBtn.click();
      await page.waitForTimeout(500);
      const htmlAfter = await page.locator('html').getAttribute('class');
      
      // Verify theme changed
      expect(htmlBefore).not.toBe(htmlAfter);
    }
  });

  test('should show responsive layout on tablets', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    
    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible();
  });
});
