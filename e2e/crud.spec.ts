import { test, expect } from '@playwright/test';

test.describe('CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure logged in before each test
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

  test('should create product and show success toast', async ({ page }) => {
    await page.click('a:has-text("Productos")');
    await page.waitForLoadState('networkidle');
    
    // Wait for toast: "📦 Productos cargados correctamente"
    const loadToast = page.locator('text=/📦.*cargados/i');
    await expect(loadToast).toBeVisible({ timeout: 5000 });
    
    // Click create button
    const createBtn = page.locator('button:has-text("Crear"), button:has-text("Agregar"), button:has-text("Nuevo")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Fill form
      const nameInput = page.locator('input[placeholder*="nombre"], input[placeholder*="Nombre"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Test Product ${Date.now()}`);
        
        const submitBtn = page.locator('button:has-text("Guardar"), button:has-text("Crear")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          
          // Verify success toast
          const successToast = page.locator('[class*="success"], [class*="toast"]:has-text("correctamente")');
          await expect(successToast).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should load clientes with success toast', async ({ page }) => {
    await page.click('a:has-text("Clientes")');
    await page.waitForLoadState('networkidle');
    
    // Verify success toast: "👥 Clientes cargados correctamente"
    const clientesToast = page.locator('text=/👥.*Clientes cargados/i');
    await expect(clientesToast).toBeVisible({ timeout: 5000 });
    
    // Verify table/list loaded
    const table = page.locator('table, [role="grid"], [class*="list"]').first();
    await expect(table).toBeVisible({ timeout: 5000 });
  });

  test('should load templates with success toast', async ({ page }) => {
    await page.click('a:has-text("Plantillas"), a:has-text("Templates")');
    await page.waitForLoadState('networkidle');
    
    // Verify success toast: "📋 Plantillas y datos cargados correctamente"
    const templateToast = page.locator('text=/📋.*Plantillas.*cargados/i');
    await expect(templateToast).toBeVisible({ timeout: 5000 });
  });

  test('should load usuarios with success toast', async ({ page }) => {
    await page.click('a:has-text("Usuarios")');
    await page.waitForLoadState('networkidle');
    
    // Verify success toast: "👥 Usuarios cargados correctamente"
    const userToast = page.locator('text=/👥.*Usuarios cargados/i');
    await expect(userToast).toBeVisible({ timeout: 5000 });
  });

  test('should load pedidos with success toast', async ({ page }) => {
    await page.click('a:has-text("Pedidos")');
    await page.waitForLoadState('networkidle');
    
    // Verify success toast: "📦 Clientes, productos y ofertas cargados correctamente"
    const pedidosToast = page.locator('text=/📦.*cargados/i');
    await expect(pedidosToast).toBeVisible({ timeout: 5000 });
  });
});
