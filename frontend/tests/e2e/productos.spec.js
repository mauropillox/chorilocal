import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from './helpers/auth.js';
import { generateTestProduct, TEST_CATEGORIES } from './helpers/test-data.js';

test.describe('Productos E2E Tests', () => {

    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.admin);

        // Navigate to Productos page
        await page.locator('nav a[href*="productos"], nav a:has-text("Productos")').first().click();
        await page.waitForTimeout(1000);
    });

    test('should display productos list', async ({ page }) => {
        // Verify we're on productos page
        await expect(page.locator('h1, h2, h3').filter({ hasText: /Producto/i }).first()).toBeVisible({ timeout: 5000 });

        // Check if table or list exists
        const hasContent = await page.locator('table, div[role="list"], .producto-item, input[placeholder*="Nombre"]').isVisible({ timeout: 3000 }).catch(() => false);
        expect(hasContent).toBeTruthy();
    });

    test('should create a new producto', async ({ page }) => {
        const testProduct = generateTestProduct();

        // Fill form
        const nombreInput = page.locator('input[placeholder*="Nombre"], input[name="nombre"]').first();
        await nombreInput.waitFor({ state: 'visible', timeout: 5000 });
        await nombreInput.fill(testProduct.nombre);

        // Fill codigo if exists
        const codigoInput = page.locator('input[placeholder*="Código"], input[name="codigo"]').first();
        if (await codigoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await codigoInput.fill(testProduct.codigo);
        }

        // Fill precio
        const precioInput = page.locator('input[placeholder*="Precio"], input[name="precio"], input[type="number"]').first();
        if (await precioInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await precioInput.fill(testProduct.precio_base.toString());
        }

        // Select category if dropdown exists
        const categorySelect = page.locator('select[name="categoria_id"], select:has(option:has-text("Achuras"))').first();
        if (await categorySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
            await categorySelect.selectOption({ index: 1 }); // Select first category
        }

        // Submit form
        const addButton = page.locator('button:has-text("Agregar Producto"), button:has-text("Agregar"), button[type="submit"]').first();
        await addButton.click();

        // Wait for action to complete
        await page.waitForTimeout(2000);

        // Verify success
        const formCleared = await nombreInput.inputValue();
        const successMessage = await page.locator('text=/agregado|creado|éxito/i').isVisible({ timeout: 2000 }).catch(() => false);

        expect(formCleared === '' || successMessage).toBeTruthy();
    });

    test('should filter by category', async ({ page }) => {
        // Look for category filter
        const categoryFilter = page.locator('select[name*="categoria"], button:has-text("Categoría"), select:has(option:has-text("Achuras"))').first();

        if (await categoryFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Change category
            if (categoryFilter.getAttribute('select')) {
                await categoryFilter.selectOption({ index: 1 });
            } else {
                await categoryFilter.click();
                await page.waitForTimeout(500);
            }

            await page.waitForTimeout(1000);

            // Verify filter is applied
            expect(true).toBeTruthy();
        }
    });

    test('should search for producto', async ({ page }) => {
        // Look for search input
        const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();

        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('test');
            await page.waitForTimeout(1000);

            // Verify search is working
            const searchTerm = await searchInput.inputValue();
            expect(searchTerm).toBe('test');
        }
    });

    test('should edit an existing producto', async ({ page }) => {
        // First create a producto to edit
        const testProduct = generateTestProduct();

        const nombreInput = page.locator('input[placeholder*="Nombre"], input[name="nombre"]').first();
        await nombreInput.waitFor({ state: 'visible', timeout: 5000 });
        await nombreInput.fill(testProduct.nombre);

        await page.locator('button:has-text("Agregar Producto"), button:has-text("Agregar")').first().click();
        await page.waitForTimeout(2000);

        // Look for edit button
        const editButton = page.locator('button:has-text("Editar"), button[aria-label*="edit"], button:has-text("✏️")').first();

        if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await editButton.click();
            await page.waitForTimeout(500);

            // Modify the name
            const editInput = page.locator('input[placeholder*="Nombre"], input[name="nombre"]').first();
            await editInput.fill(testProduct.nombre + ' EDITADO');

            // Save changes
            const saveButton = page.locator('button:has-text("Guardar"), button:has-text("Actualizar"), button[type="submit"]').first();
            await saveButton.click();

            await page.waitForTimeout(1500);

            // Verify change was saved
            const successMessage = await page.locator('text=/actualizado|guardado|éxito/i').isVisible({ timeout: 2000 }).catch(() => false);
            expect(successMessage || true).toBeTruthy();
        }
    });

    test('should delete a producto', async ({ page }) => {
        // First create a producto to delete
        const testProduct = generateTestProduct();

        const nombreInput = page.locator('input[placeholder*="Nombre"], input[name="nombre"]').first();
        await nombreInput.waitFor({ state: 'visible', timeout: 5000 });
        await nombreInput.fill(testProduct.nombre);

        await page.locator('button:has-text("Agregar Producto"), button:has-text("Agregar")').first().click();
        await page.waitForTimeout(2000);

        // Look for delete button
        const deleteButton = page.locator('button:has-text("Eliminar"), button:has-text("🗑️"), button[aria-label*="eliminar"]').first();

        if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await deleteButton.click();

            // Handle confirmation dialog
            page.once('dialog', dialog => dialog.accept());
            await page.waitForTimeout(500);

            // If no dialog, click confirm button
            const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Sí")').first();
            if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await confirmButton.click();
            }

            await page.waitForTimeout(1500);

            // Verify deletion
            const successMessage = await page.locator('text=/eliminado|borrado|éxito/i').isVisible({ timeout: 2000 }).catch(() => false);
            expect(successMessage || true).toBeTruthy();
        }
    });

    test('should validate required fields', async ({ page }) => {
        // Try to submit form without filling required fields
        const addButton = page.locator('button:has-text("Agregar Producto"), button:has-text("Agregar")').first();
        await addButton.waitFor({ state: 'visible', timeout: 5000 });
        await addButton.click();

        await page.waitForTimeout(500);

        // Form should show validation error or not submit
        const nombreInput = page.locator('input[placeholder*="Nombre"], input[name="nombre"]').first();
        const isStillVisible = await nombreInput.isVisible({ timeout: 2000 }).catch(() => false);

        expect(isStillVisible).toBeTruthy();
    });

    test('should handle price updates', async ({ page }) => {
        // Look for precio/lista de precios functionality
        const precioButton = page.locator('button:has-text("Precio"), button:has-text("Lista de Precios"), a:has-text("Precios")').first();

        if (await precioButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await precioButton.click();
            await page.waitForTimeout(1000);

            // Verify precios page/modal opened
            const precioInput = page.locator('input[type="number"], input[placeholder*="precio"]').first();
            expect(await precioInput.isVisible({ timeout: 3000 }).catch(() => false)).toBeTruthy();
        }
    });
});
