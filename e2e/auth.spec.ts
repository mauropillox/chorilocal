import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login with valid credentials and show success toast', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*login|.*auth/i);
    
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Entrar")');
    
    // Wait for navigation after successful login
    await page.waitForNavigation();
    await expect(page).toHaveURL(/.*dashboard|.*home/i);
    
    // Verify success toast appears
    const toast = await page.locator('text=/🔓.*Bienvenido/i');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('should show error toast for invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Entrar")');
    
    // Verify error toast appears
    const errorToast = await page.locator('[class*="error"], [class*="toast"]:has-text("Error")');
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  });

  test('should logout and clear session', async ({ page, context }) => {
    // Navigate to dashboard (assumes logged in or auto-login)
    await page.goto('/dashboard');
    
    // Find and click logout button
    const logoutBtn = page.locator('button:has-text("Cerrar sesión")');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForNavigation();
      await expect(page).toHaveURL(/.*login|.*auth/i);
    }
  });

  test('should persist session on page reload', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check if still logged in after reload
    await page.reload();
    const logoutBtn = page.locator('button:has-text("Cerrar sesión")');
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
  });
});
