/**
 * Centralized hooks exports
 * 
 * Import hooks from here:
 * import { useProductosQuery, useCreateProducto } from '@/hooks'
 */

// Query hooks (React Query + Zustand hybrid)
export {
    useProductosQuery,
    useClientesQuery,
    useCategoriasQuery,
    usePedidosQuery,
    useOfertasQuery,
} from './useHybridQuery';

// Mutation hooks (with optimistic updates)
export {
    // Productos
    useCreateProducto,
    useUpdateProducto,
    useDeleteProducto,
    // Clientes
    useCreateCliente,
    useUpdateCliente,
    useDeleteCliente,
    // Pedidos
    useCreatePedido,
    useUpdatePedidoEstado,
    useDeletePedido,
} from './useMutations';
