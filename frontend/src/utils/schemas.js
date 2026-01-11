import { z } from 'zod';

// Common schemas
const TimestampSchema = z.string().datetime().optional();
const UUIDSchema = z.string().uuid().optional();

// Authentication schemas
export const LoginResponseSchema = z.object({
    access_token: z.string(),
    token_type: z.string().default('bearer'),
    user: z.object({
        id: z.number(),
        email: z.string().email(),
        username: z.string(),
        role: z.enum(['admin', 'user', 'vendor']).optional(),
    }).optional(),
});

// Alias for consistency
export const AuthResponseSchema = LoginResponseSchema;

// Productos schemas
export const ProductoSchema = z.object({
    id: z.number(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
    precio: z.number().positive(),
    stock: z.number().nonnegative(),
    categoria_id: z.number().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const ProductosListSchema = z.array(ProductoSchema);

// Clientes schemas
export const ClienteSchema = z.object({
    id: z.number(),
    nombre: z.string(),
    email: z.string().email().optional(),
    telefono: z.string().optional(),
    direccion: z.string().optional(),
    ciudad: z.string().optional(),
    estado: z.string().optional(),
    codigo_postal: z.string().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const ClientesListSchema = z.array(ClienteSchema);

// Pedidos schemas
export const PedidoSchema = z.object({
    id: z.number(),
    numero: z.string(),
    cliente_id: z.number(),
    estado: z.enum(['pendiente', 'procesando', 'completado', 'cancelado']).optional(),
    total: z.number().nonnegative(),
    fecha_pedido: TimestampSchema,
    fecha_entrega: z.string().datetime().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const PedidosListSchema = z.array(PedidoSchema);

// Usuarios schemas
export const UsuarioSchema = z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().email(),
    nombre_completo: z.string().optional(),
    role: z.enum(['admin', 'user', 'vendor']).optional(),
    activo: z.boolean().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const UsuariosListSchema = z.array(UsuarioSchema);

// Reportes schemas
export const ReporteSchema = z.object({
    id: z.number().optional(),
    nombre: z.string(),
    fecha_inicio: z.string().date(),
    fecha_fin: z.string().date(),
    tipo: z.enum(['vendido', 'inventario', 'clientes', 'productos', 'rendimiento', 'comparativo']),
    datos: z.array(z.record(z.unknown())).optional(),
    total: z.number().optional(),
    created_at: TimestampSchema,
});

export const ReportesListSchema = z.array(ReporteSchema);

// Templates schemas
export const TemplateSchema = z.object({
    id: z.number(),
    nombre: z.string(),
    tipo: z.enum(['email', 'sms', 'notificacion']).optional(),
    contenido: z.string(),
    variables: z.array(z.string()).optional(),
    activo: z.boolean().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const TemplatesListSchema = z.array(TemplateSchema);

// Ofertas schemas
export const OfertaSchema = z.object({
    id: z.number(),
    nombre: z.string(),
    descripcion: z.string().optional(),
    descuento: z.number().min(0).max(100),
    fecha_inicio: z.string().date(),
    fecha_fin: z.string().date(),
    activa: z.boolean().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const OfertasListSchema = z.array(OfertaSchema);

// Listas de Precios schemas
export const ListaPreciosSchema = z.object({
    id: z.number(),
    nombre: z.string(),
    descripcion: z.string().optional(),
    vigencia_desde: z.string().date(),
    vigencia_hasta: z.string().date().optional(),
    activa: z.boolean().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const ListasPreciosSchema = z.array(ListaPreciosSchema);

// Categorías schemas
export const CategoriaSchema = z.object({
    id: z.number(),
    nombre: z.string(),
    descripcion: z.string().optional(),
    activa: z.boolean().optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const CategoriasSchema = z.array(CategoriaSchema);

// Hoja de Ruta schemas
export const HojaRutaSchema = z.object({
    id: z.number(),
    numero: z.string(),
    fecha: z.string().date(),
    repartidor_id: z.number(),
    estado: z.enum(['planificada', 'en_proceso', 'completada', 'cancelada']).optional(),
    pedidos: z.array(z.number()).optional(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
});

export const HojasRutaSchema = z.array(HojaRutaSchema);

// Offline Queue schemas
export const OfflineQueueItemSchema = z.object({
    id: z.string().uuid(),
    endpoint: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    data: z.record(z.unknown()).optional(),
    timestamp: z.number(),
    retries: z.number().default(0),
    status: z.enum(['pending', 'synced', 'failed']).default('pending'),
});

export const OfflineQueueSchema = z.array(OfflineQueueItemSchema);

// Generic API response wrapper
export const ApiResponseSchema = z.object({
    success: z.boolean().optional(),
    data: z.unknown(),
    message: z.string().optional(),
    error: z.string().optional(),
});

// Error response schema
export const ApiErrorSchema = z.object({
    detail: z.string().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    status: z.number().optional(),
});

// Type inference helpers (for TypeScript - commented out for JS)
// export type Producto = z.infer<typeof ProductoSchema>;
// export type Cliente = z.infer<typeof ClienteSchema>;
// etc...

// Safe parsing helper
export const parseResponse = (schema, data) => {
    try {
        return schema.parse(data);
    } catch (error) {
        console.error('Schema validation error:', error);
        throw new Error(`Invalid API response: ${error.message}`);
    }
};

// Safe parsing with fallback
export const parseResponseSafe = (schema, data, fallback = null) => {
    try {
        return schema.parse(data);
    } catch (error) {
        console.warn('Schema validation warning:', error);
        return fallback;
    }
};

// ==================== SCHEMA MAP ====================

/**
 * Map endpoint patterns to their validation schemas
 * Used by validateResponse() to auto-select the right schema
 */
export const SCHEMA_MAP = {
    // Array endpoints
    'productos': ProductosListSchema,
    'clientes': ClientesListSchema,
    'pedidos': PedidosListSchema,
    'categorias': CategoriasSchema,
    'ofertas': OfertasListSchema,
    'ofertas/activas': OfertasListSchema,
    'usuarios': UsuariosListSchema,
    'repartidores': UsuariosListSchema,
    'templates': TemplatesListSchema,
    'listas-precios': ListasPreciosListSchema,

    // Single item endpoints (patterns)
    'producto': ProductoSchema,
    'cliente': ClienteSchema,
    'pedido': PedidoSchema,
    'categoria': CategoriaSchema,
    'oferta': OfertaSchema,
    'usuario': UsuarioSchema,
    'template': TemplateSchema,
};

/**
 * Validate API response data against schema
 * @param {string} endpoint - API endpoint URL
 * @param {any} data - Response data to validate
 * @param {object} options - { strict: boolean, silent: boolean }
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
export function validateResponse(endpoint, data, options = { strict: false, silent: false }) {
    const endpointKey = extractEndpointKey(endpoint);
    const schema = SCHEMA_MAP[endpointKey];

    if (!schema) {
        // No schema defined - skip validation
        return { success: true, data };
    }

    const result = schema.safeParse(data);

    if (!result.success) {
        const errorMessage = result.error.issues
            .slice(0, 3) // Limit to first 3 errors
            .map(issue => `${issue.path.join('.')}: ${issue.message}`)
            .join(', ');

        if (!options.silent) {
            console.warn(`[Zod] Validation warning for ${endpointKey}:`, errorMessage);
        }

        // In non-strict mode, return original data with warning
        return {
            success: false,
            error: errorMessage,
            data: options.strict ? null : data
        };
    }

    return { success: true, data: result.data };
}

/**
 * Extract endpoint key from full URL path
 */
function extractEndpointKey(url) {
    let path = url.replace(/^https?:\/\/[^\/]+/, '').split('?')[0];
    path = path.replace(/^\/?(api)?\//, '');

    if (path.match(/ofertas\/activas/i)) return 'ofertas/activas';
    if (path.match(/repartidores/i)) return 'repartidores';
    if (path.match(/listas-precios/i)) return 'listas-precios';

    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2 && /^\d+$/.test(segments[segments.length - 1])) {
        const resource = segments[segments.length - 2];
        return resource.replace(/s$/, '');
    }

    return segments[0] || '';
}
