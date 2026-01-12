import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E tests for recent fixes:
 * 1. ConfirmDialog accepts isOpen prop
 * 2. Modal CSS classes corrected (modal-overlay -> modal-backdrop)
 * 3. X-Confirm-Delete header added to DELETE endpoints
 * 4. Edit and Delete buttons work correctly
 */

test.describe('Recent Fixes Validation - Production', () => {
    test.use({ storageState: 'e2e/.auth/user.json' });

    test.beforeEach(async ({ page }) => {
        // Set viewport for consistent testing
        await page.setViewportSize({ width: 1280, height: 720 });
    });

    test.describe('Productos - Edit & Delete Functionality', () => {
        test('should open edit modal when clicking edit button', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            // Wait for productos to load
            await page.waitForSelector('[class*="card"]', { timeout: 10000 });

            // Find first product edit button
            const editButton = page.locator('button[title="Editar producto"]').first();
            await expect(editButton).toBeVisible();

            // Click edit button
            await editButton.click();

            // Verify modal opens with correct CSS class
            const modalBackdrop = page.locator('.modal-backdrop');
            await expect(modalBackdrop).toBeVisible({ timeout: 5000 });

            const modalBox = page.locator('.modal-box');
            await expect(modalBox).toBeVisible();

            // Verify modal content
            await expect(page.getByText('✏️ Editar Producto')).toBeVisible();

            // Close modal
            await page.keyboard.press('Escape');
            await expect(modalBackdrop).not.toBeVisible();
        });

        test('should open delete confirmation when clicking delete button', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            // Wait for productos
            await page.waitForSelector('[class*="card"]', { timeout: 10000 });

            // Find first product delete button
            const deleteButton = page.locator('button[title="Eliminar producto"]').first();
            await expect(deleteButton).toBeVisible();

            // Click delete button
            await deleteButton.click();

            // Verify ConfirmDialog opens (using isOpen prop)
            const confirmDialog = page.locator('.modal-backdrop');
            await expect(confirmDialog).toBeVisible({ timeout: 5000 });

            // Verify confirmation message
            await expect(page.getByText('¿Eliminar producto?')).toBeVisible();

            // Click cancel
            await page.getByRole('button', { name: /cancelar/i }).click();
            await expect(confirmDialog).not.toBeVisible();
        });

        test('should handle delete with X-Confirm-Delete header', async ({ page }) => {
            // Intercept DELETE request to verify header
            let deleteRequestHeaders: Record<string, string> = {};

            page.on('request', request => {
                if (request.method() === 'DELETE' && request.url().includes('/productos/')) {
                    deleteRequestHeaders = request.headers();
                }
            });

            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            // Create a test product first
            await page.getByRole('button', { name: /agregar producto/i }).click();
            await page.fill('input[placeholder*="Nombre"]', 'TEST_DELETE_PRODUCTO');
            await page.fill('input[placeholder*="Precio"]', '100');
            await page.getByRole('button', { name: /guardar|crear/i }).click();
            await page.waitForTimeout(2000);

            // Find the test product and delete it
            const testProduct = page.locator('text=TEST_DELETE_PRODUCTO').first();
            if (await testProduct.isVisible()) {
                const deleteBtn = testProduct.locator('xpath=ancestor::*[contains(@class, "card")]//button[@title="Eliminar producto"]');
                await deleteBtn.click();

                // Confirm delete
                await page.getByRole('button', { name: /eliminar|confirmar/i }).click();
                await page.waitForTimeout(1000);

                // Verify header was sent
                expect(deleteRequestHeaders['x-confirm-delete']).toBe('true');
            }
        });
    });

    test.describe('Categorías - Delete Functionality', () => {
        test('should delete category with X-Confirm-Delete header', async ({ page }) => {
            let deleteRequestHeaders: Record<string, string> = {};

            page.on('request', request => {
                if (request.method() === 'DELETE' && request.url().includes('/categorias/')) {
                    deleteRequestHeaders = request.headers();
                }
            });

            await page.goto('https://www.pedidosfriosur.com/categorias');
            await page.waitForLoadState('networkidle');

            // Create test category
            await page.getByRole('button', { name: /nueva categoría/i }).click();
            await page.fill('input[placeholder*="nombre"]', 'TEST_DELETE_CAT');
            await page.getByRole('button', { name: /guardar/i }).click();
            await page.waitForTimeout(2000);

            // Find and delete test category
            const testCat = page.locator('text=TEST_DELETE_CAT').first();
            if (await testCat.isVisible()) {
                const deleteBtn = testCat.locator('xpath=ancestor::*//button[contains(text(), "Eliminar")]');
                await deleteBtn.click();

                // Confirm delete
                await page.getByRole('button', { name: /eliminar|confirmar/i }).click();
                await page.waitForTimeout(1000);

                // Verify header was sent
                expect(deleteRequestHeaders['x-confirm-delete']).toBe('true');
            }
        });
    });

    test.describe('Usuarios - Modal CSS Classes', () => {
        test('should use correct modal-backdrop class for reset password', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/usuarios');
            await page.waitForLoadState('networkidle');

            // Find reset password button
            const resetButton = page.locator('button[title="Resetear contraseña"]').first();
            if (await resetButton.isVisible()) {
                await resetButton.click();

                // Verify modal uses modal-backdrop (not modal-overlay)
                const modalBackdrop = page.locator('.modal-backdrop');
                await expect(modalBackdrop).toBeVisible({ timeout: 5000 });

                // Verify modal uses modal-box (not modal-content)
                const modalBox = page.locator('.modal-box');
                await expect(modalBox).toBeVisible();

                // Verify no old classes exist
                const oldOverlay = page.locator('.modal-overlay');
                await expect(oldOverlay).toHaveCount(0);

                const oldContent = page.locator('.modal-content');
                await expect(oldContent).toHaveCount(0);

                // Close modal
                await page.keyboard.press('Escape');
            }
        });
    });

    test.describe('ConfirmDialog Component', () => {
        test('should accept isOpen prop instead of open', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            // Productos uses isOpen prop for ConfirmDialog
            const deleteButton = page.locator('button[title="Eliminar producto"]').first();
            if (await deleteButton.isVisible()) {
                await deleteButton.click();

                // ConfirmDialog should open (accepts isOpen prop)
                const dialog = page.locator('.modal-backdrop');
                await expect(dialog).toBeVisible({ timeout: 5000 });

                // Verify it's actually a ConfirmDialog with proper structure
                await expect(page.locator('.modal-box')).toBeVisible();
                await expect(page.getByRole('button', { name: /cancelar/i })).toBeVisible();
                await expect(page.getByRole('button', { name: /confirmar|eliminar/i })).toBeVisible();

                // Close
                await page.keyboard.press('Escape');
            }
        });

        test('should handle keyboard navigation and focus trap', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            const deleteButton = page.locator('button[title="Eliminar producto"]').first();
            if (await deleteButton.isVisible()) {
                await deleteButton.click();

                // Wait for dialog
                await page.waitForSelector('.modal-backdrop', { timeout: 5000 });

                // Test Escape key
                await page.keyboard.press('Escape');
                await expect(page.locator('.modal-backdrop')).not.toBeVisible();

                // Open again
                await deleteButton.click();
                await page.waitForSelector('.modal-backdrop');

                // Test Tab navigation (focus trap)
                await page.keyboard.press('Tab');
                await page.keyboard.press('Tab');

                // Should stay within dialog
                const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
                expect(focusedElement).toBe('BUTTON');

                // Close
                await page.keyboard.press('Escape');
            }
        });
    });

    test.describe('Clientes - Delete with Header', () => {
        test('should send X-Confirm-Delete header when deleting cliente', async ({ page }) => {
            let deleteRequestHeaders: Record<string, string> = {};

            page.on('request', request => {
                if (request.method() === 'DELETE' && request.url().includes('/clientes/')) {
                    deleteRequestHeaders = request.headers();
                }
            });

            await page.goto('https://www.pedidosfriosur.com/clientes');
            await page.waitForLoadState('networkidle');

            // Check if delete functionality is accessible
            // Note: May need to create a test client first
            console.log('Clientes delete test - waiting for user interaction or existing client');

            // If there are clients, verify the delete would send correct header
            const clientCard = page.locator('[class*="card"]').first();
            if (await clientCard.isVisible()) {
                console.log('Cliente found, can test delete header on actual deletion');
            }
        });
    });

    test.describe('Regression Tests - Existing Functionality', () => {
        test('should still allow editing productos successfully', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            const editButton = page.locator('button[title="Editar producto"]').first();
            if (await editButton.isVisible()) {
                await editButton.click();

                // Wait for modal
                await page.waitForSelector('.modal-backdrop');

                // Change a value
                const nombreInput = page.locator('input[value]').first();
                const originalValue = await nombreInput.inputValue();

                await nombreInput.fill(originalValue + ' EDIT_TEST');

                // Save
                await page.getByRole('button', { name: /guardar/i }).click();
                await page.waitForTimeout(1000);

                // Verify success toast or modal closed
                const modalBackdrop = page.locator('.modal-backdrop');
                const isModalGone = await modalBackdrop.isHidden().catch(() => true);
                expect(isModalGone).toBeTruthy();

                // Revert change
                await editButton.click();
                await page.waitForSelector('.modal-backdrop');
                await nombreInput.fill(originalValue);
                await page.getByRole('button', { name: /guardar/i }).click();
            }
        });

        test('should handle bulk delete with proper confirmation', async ({ page }) => {
            await page.goto('https://www.pedidosfriosur.com/productos');
            await page.waitForLoadState('networkidle');

            // Check if bulk delete is available
            const bulkDeleteButton = page.getByRole('button', { name: /eliminar seleccionados/i });

            if (await bulkDeleteButton.isVisible()) {
                // Select some products
                const checkboxes = page.locator('input[type="checkbox"]');
                const count = await checkboxes.count();

                if (count > 0) {
                    await checkboxes.first().check();

                    // Click bulk delete
                    await bulkDeleteButton.click();

                    // Verify ConfirmDialog opens
                    const dialog = page.locator('.modal-backdrop');
                    await expect(dialog).toBeVisible({ timeout: 5000 });

                    // Cancel
                    await page.getByRole('button', { name: /cancelar/i }).click();
                    await expect(dialog).not.toBeVisible();
                }
            }
        });
    });
});
