// Test data generators for E2E tests

export function generateTestClient() {
    const timestamp = Date.now();
    return {
        nombre: `Cliente Test ${timestamp}`,
        telefono: `555-${timestamp.toString().slice(-4)}`,
        direccion: `Calle Test ${timestamp}`,
        cuit: `20-${timestamp.toString().slice(-8)}-0`,
        email: `test${timestamp}@example.com`
    };
}

export function generateTestProduct() {
    const timestamp = Date.now();
    return {
        nombre: `Producto Test ${timestamp}`,
        codigo: `TEST-${timestamp}`,
        descripcion: `Descripción del producto de prueba ${timestamp}`,
        categoria_id: 1,
        precio_base: Math.floor(Math.random() * 10000) + 1000
    };
}

export function generateTestPedido() {
    const timestamp = Date.now();
    return {
        cliente_id: 1, // Assume cliente exists
        fecha_entrega: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        observaciones: `Pedido de prueba E2E ${timestamp}`
    };
}

export const TEST_CATEGORIES = [
    'Achuras',
    'Carnes',
    'Cerdo',
    'Embutidos',
    'Otros',
    'Pescado',
    'Pollo',
    'Quesos',
    'Varios',
    'Verduras'
];

export const TEST_ESTADOS_PEDIDO = [
    'Pendiente',
    'Confirmado',
    'En Preparación',
    'Listo',
    'Entregado',
    'Cancelado'
];

/**
 * Wait for element and perform action with retry
 */
export async function waitAndClick(page, selector, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 5000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            await page.waitForSelector(selector, { timeout });
            await page.click(selector);
            return;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Fill form field with retry
 */
export async function waitAndFill(page, selector, value, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 5000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            await page.waitForSelector(selector, { timeout });
            await page.fill(selector, value);
            return;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Wait for navigation with timeout
 */
export async function waitForNavigation(page, urlPattern, timeout = 5000) {
    await page.waitForURL(urlPattern, { timeout });
}
