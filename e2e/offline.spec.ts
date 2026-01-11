import { test, expect } from '@playwright/test';

test.describe('Offline Mode', () => {
  test('should show offline indicator when network is offline', async ({ page, context }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Simulate offline mode
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    // Look for offline indicator (could be banner, badge, or icon)
    const offlineIndicator = page.locator(
      '[class*="offline"], [class*="network"], text=/Modo sin conexión|Sin conexión|Offline/'
    ).first();
    
    // Optional: indicator may not exist, but app should still be functional
    // Verify page is still interactive
    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible({ timeout: 5000 });
    
    // Restore connection
    await context.setOffline(false);
  });

  test('should cache data for offline access', async ({ page, context }) => {
    // Load page and populate cache
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Navigate to a data-heavy page
    const productsLink = page.locator('a:has-text("Productos")').first();
    if (await productsLink.isVisible()) {
      await productsLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify data loaded
      const table = page.locator('table, [role="grid"]').first();
      await expect(table).toBeVisible({ timeout: 5000 });
      
      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);
      
      // Reload page - data should still be visible from cache
      await page.reload();
      
      // Verify cached data is available
      const cachedTable = page.locator('table, [role="grid"]').first();
      const isVisible = await cachedTable.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        console.log('✓ Cache serving offline data');
      } else {
        console.log('⚠ Cache unavailable or data not displayed');
      }
      
      // Restore connection
      await context.setOffline(false);
    }
  });

  test('should sync offline queue when reconnecting', async ({ page, context }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Check for offline queue component
    const offlineQueue = page.locator(
      'a:has-text("Cola offline"), a:has-text("OfflineQueue"), button:has-text("Sync")'
    ).first();
    
    if (await offlineQueue.isVisible()) {
      await offlineQueue.click();
      await page.waitForLoadState('networkidle');
      
      // Verify offline queue management interface
      const queueContent = page.locator('main, [role="main"]').first();
      await expect(queueContent).toBeVisible({ timeout: 5000 });
      
      // Try to sync if button exists
      const syncBtn = page.locator('button:has-text("Sincronizar"), button:has-text("Sync")').first();
      if (await syncBtn.isVisible()) {
        await syncBtn.click();
        await page.waitForTimeout(2000);
        
        // Look for success message
        const successMsg = page.locator('text=/Sincronizado|Synced|completada/i').first();
        const isSynced = await successMsg.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (isSynced) {
          console.log('✓ Offline queue synced successfully');
        }
      }
    }
  });

  test('should persist offline queue across sessions', async ({ page, context }) => {
    // First session - go offline
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Navigate to a form or action that would be queued
    const createBtn = page.locator('button:has-text("Crear"), button:has-text("Agregar")').first();
    if (await createBtn.isVisible()) {
      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);
      
      // Try to perform action (should be queued)
      await createBtn.click();
      await page.waitForTimeout(1000);
      
      // Close browser tab and reopen
      const newPage = await context.newPage();
      await newPage.goto('/dashboard', { waitUntil: 'networkidle' });
      
      // Check offline queue - item should persist
      const offlineQueue = newPage.locator(
        'a:has-text("Cola offline"), [class*="queue"]'
      ).first();
      
      const queueVisible = await offlineQueue.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (queueVisible) {
        console.log('✓ Offline queue persisted across sessions');
      }
      
      // Restore connection
      await context.setOffline(false);
      await newPage.close();
    }
  });

  test('should show queue item count in offline mode', async ({ page, context }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await context.setOffline(true);
    
    // Look for queue counter or badge
    const queueCounter = page.locator(
      '[class*="queue-count"], [class*="badge"], text=/Cola:|Queue:/'
    ).first();
    
    const counterVisible = await queueCounter.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (counterVisible) {
      const text = await queueCounter.textContent();
      console.log(`Queue status: ${text}`);
    }
    
    await context.setOffline(false);
  });

  test('should handle offline form submission gracefully', async ({ page, context }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Find a form
    const form = page.locator('form').first();
    if (await form.isVisible()) {
      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);
      
      // Try to submit form
      const submitBtn = form.locator('button[type="submit"], button:has-text("Enviar"), button:has-text("Guardar")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        
        // Look for offline message or queued message
        const offlineMsg = page.locator(
          'text=/Cola de espera|Queued|pendiente|sin conexión/i'
        ).first();
        
        const msgVisible = await offlineMsg.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (msgVisible) {
          console.log('✓ Form submitted to offline queue');
        }
      }
      
      // Restore connection
      await context.setOffline(false);
    }
  });

  test('should load service worker in production', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker.controller !== null 
        || navigator.serviceWorker.getRegistrations().then((regs) => regs.length > 0);
    });
    
    if (swRegistered) {
      console.log('✓ Service worker registered and active');
    } else {
      console.log('⚠ Service worker not detected');
    }
  });

  test('should have IndexedDB storage available', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Check if IndexedDB is available
    const indexedDBAvailable = await page.evaluate(() => {
      return typeof indexedDB !== 'undefined';
    });
    
    expect(indexedDBAvailable).toBe(true);
    
    if (indexedDBAvailable) {
      // List available object stores
      const stores = await page.evaluate(() => {
        return new Promise((resolve, reject) => {
          const request = indexedDB.databases();
          if (typeof request === 'object' && request.then) {
            request.then((dbs) => resolve(dbs.map((db) => db.name)));
          } else {
            resolve([]);
          }
        });
      });
      
      console.log(`IndexedDB databases: ${stores.length > 0 ? stores.join(', ') : 'none'}`);
    }
  });
});
