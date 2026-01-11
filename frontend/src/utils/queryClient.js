import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configure QueryClient with optimal defaults
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false, // Prevent aggressive refetching
            refetchOnReconnect: 'stale', // Refetch stale queries on reconnect
            refetchOnMount: 'stale', // Only refetch if data is stale
        },
        mutations: {
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
    },
});

// Provider wrapper component
export function ReactQueryProvider({ children }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

// Cache invalidation utilities
export const cacheKeys = {
    productos: ['productos'],
    productosDetail: (id) => ['productos', id],
    clientes: ['clientes'],
    clientesDetail: (id) => ['clientes', id],
    pedidos: ['pedidos'],
    pedidosDetail: (id) => ['pedidos', id],
    usuarios: ['usuarios'],
    usuariosDetail: (id) => ['usuarios', id],
    templates: ['templates'],
    templatesDetail: (id) => ['templates', id],
    reportes: ['reportes'],
    reporteDetail: (tipo) => ['reportes', tipo],
    ofertas: ['ofertas'],
    ofertasDetail: (id) => ['ofertas', id],
    listas: ['listas'],
    listasDetail: (id) => ['listas', id],
    categorias: ['categorias'],
    categoriasDetail: (id) => ['categorias', id],
    admin: ['admin'],
    search: (query) => ['search', query],
    offline: ['offline', 'queue'],
};

// Export as CACHE_KEYS for consistency with tests
export const CACHE_KEYS = cacheKeys;
