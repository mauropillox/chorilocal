/**
 * Mutation hooks with Optimistic Updates
 * 
 * These hooks use useMutation from React Query with optimistic updates
 * for instant UI feedback before server response.
 * 
 * Pattern:
 * 1. onMutate: Update cache optimistically, save snapshot
 * 2. onError: Rollback to snapshot if mutation fails
 * 3. onSettled: Refetch to ensure consistency
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch, authFetchJson } from '../authFetch';
import { CACHE_KEYS } from '../utils/queryClient';
import { toastSuccess, toastError } from '../toast';
import { useAppStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL;

// ==================== PRODUCTOS ====================

/**
 * Create a new producto with optimistic update
 */
export const useCreateProducto = () => {
    const queryClient = useQueryClient();
    const setProductos = useAppStore(state => state.setProductos);

    return useMutation({
        mutationFn: async (newProducto) => {
            const res = await authFetch(`${API_URL}/productos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProducto),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al crear producto');
            }
            return res.json();
        },
        onMutate: async (newProducto) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.productos });

            // Snapshot previous value
            const previousProductos = queryClient.getQueryData(CACHE_KEYS.productos);

            // Optimistically add to list with temp ID
            const optimisticProducto = {
                ...newProducto,
                id: `temp-${Date.now()}`,
                _optimistic: true,
            };

            queryClient.setQueryData(CACHE_KEYS.productos, (old = []) => [
                ...old,
                optimisticProducto,
            ]);

            return { previousProductos };
        },
        onError: (err, newProducto, context) => {
            // Rollback on error
            queryClient.setQueryData(CACHE_KEYS.productos, context?.previousProductos);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: (data) => {
            toastSuccess('✅ Producto creado');
        },
        onSettled: () => {
            // Refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.productos });
        },
    });
};

/**
 * Update a producto with optimistic update
 */
export const useUpdateProducto = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const res = await authFetch(`${API_URL}/productos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al actualizar producto');
            }
            return res.json();
        },
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.productos });

            const previousProductos = queryClient.getQueryData(CACHE_KEYS.productos);

            // Optimistically update the producto
            queryClient.setQueryData(CACHE_KEYS.productos, (old = []) =>
                old.map(p => p.id === id ? { ...p, ...updates, _optimistic: true } : p)
            );

            return { previousProductos };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(CACHE_KEYS.productos, context?.previousProductos);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('✅ Producto actualizado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.productos });
        },
    });
};

/**
 * Delete a producto with optimistic update
 */
export const useDeleteProducto = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id) => {
            const res = await authFetch(`${API_URL}/productos/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al eliminar producto');
            }
            return { id };
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.productos });

            const previousProductos = queryClient.getQueryData(CACHE_KEYS.productos);

            // Optimistically remove from list
            queryClient.setQueryData(CACHE_KEYS.productos, (old = []) =>
                old.filter(p => p.id !== id)
            );

            return { previousProductos };
        },
        onError: (err, id, context) => {
            queryClient.setQueryData(CACHE_KEYS.productos, context?.previousProductos);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('🗑️ Producto eliminado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.productos });
        },
    });
};

// ==================== CLIENTES ====================

/**
 * Create a new cliente with optimistic update
 */
export const useCreateCliente = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newCliente) => {
            const res = await authFetch(`${API_URL}/clientes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCliente),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al crear cliente');
            }
            return res.json();
        },
        onMutate: async (newCliente) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.clientes });

            const previousClientes = queryClient.getQueryData(CACHE_KEYS.clientes);

            const optimisticCliente = {
                ...newCliente,
                id: `temp-${Date.now()}`,
                _optimistic: true,
            };

            queryClient.setQueryData(CACHE_KEYS.clientes, (old = []) => [
                ...old,
                optimisticCliente,
            ]);

            return { previousClientes };
        },
        onError: (err, newCliente, context) => {
            queryClient.setQueryData(CACHE_KEYS.clientes, context?.previousClientes);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('✅ Cliente creado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.clientes });
        },
    });
};

/**
 * Update a cliente with optimistic update
 */
export const useUpdateCliente = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const res = await authFetch(`${API_URL}/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al actualizar cliente');
            }
            return res.json();
        },
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.clientes });

            const previousClientes = queryClient.getQueryData(CACHE_KEYS.clientes);

            queryClient.setQueryData(CACHE_KEYS.clientes, (old = []) =>
                old.map(c => c.id === id ? { ...c, ...updates, _optimistic: true } : c)
            );

            return { previousClientes };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(CACHE_KEYS.clientes, context?.previousClientes);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('✅ Cliente actualizado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.clientes });
        },
    });
};

/**
 * Delete a cliente with optimistic update
 */
export const useDeleteCliente = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id) => {
            const res = await authFetch(`${API_URL}/clientes/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al eliminar cliente');
            }
            return { id };
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.clientes });

            const previousClientes = queryClient.getQueryData(CACHE_KEYS.clientes);

            queryClient.setQueryData(CACHE_KEYS.clientes, (old = []) =>
                old.filter(c => c.id !== id)
            );

            return { previousClientes };
        },
        onError: (err, id, context) => {
            queryClient.setQueryData(CACHE_KEYS.clientes, context?.previousClientes);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('🗑️ Cliente eliminado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.clientes });
        },
    });
};

// ==================== PEDIDOS ====================

/**
 * Create a new pedido with optimistic update
 */
export const useCreatePedido = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newPedido) => {
            const res = await authFetch(`${API_URL}/pedidos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPedido),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al crear pedido');
            }
            return res.json();
        },
        onMutate: async (newPedido) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.pedidos });

            const previousPedidos = queryClient.getQueryData(CACHE_KEYS.pedidos);

            const optimisticPedido = {
                ...newPedido,
                id: `temp-${Date.now()}`,
                estado: 'pendiente',
                fecha_creacion: new Date().toISOString(),
                _optimistic: true,
            };

            queryClient.setQueryData(CACHE_KEYS.pedidos, (old = []) => [
                optimisticPedido,
                ...old,
            ]);

            return { previousPedidos };
        },
        onError: (err, newPedido, context) => {
            queryClient.setQueryData(CACHE_KEYS.pedidos, context?.previousPedidos);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('📦 Pedido creado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.pedidos });
        },
    });
};

/**
 * Update pedido status with optimistic update
 */
export const useUpdatePedidoEstado = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, estado }) => {
            const res = await authFetch(`${API_URL}/pedidos/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al actualizar estado');
            }
            return res.json();
        },
        onMutate: async ({ id, estado }) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.pedidos });

            const previousPedidos = queryClient.getQueryData(CACHE_KEYS.pedidos);

            queryClient.setQueryData(CACHE_KEYS.pedidos, (old = []) =>
                old.map(p => p.id === id ? { ...p, estado, _optimistic: true } : p)
            );

            return { previousPedidos };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(CACHE_KEYS.pedidos, context?.previousPedidos);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: (data, { estado }) => {
            const icons = { pendiente: '⏳', preparando: '🔄', entregado: '✅', cancelado: '❌' };
            toastSuccess(`${icons[estado] || '📦'} Estado actualizado`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.pedidos });
        },
    });
};

/**
 * Delete a pedido with optimistic update
 */
export const useDeletePedido = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id) => {
            const res = await authFetch(`${API_URL}/pedidos/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.detail || 'Error al eliminar pedido');
            }
            return { id };
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: CACHE_KEYS.pedidos });

            const previousPedidos = queryClient.getQueryData(CACHE_KEYS.pedidos);

            queryClient.setQueryData(CACHE_KEYS.pedidos, (old = []) =>
                old.filter(p => p.id !== id)
            );

            return { previousPedidos };
        },
        onError: (err, id, context) => {
            queryClient.setQueryData(CACHE_KEYS.pedidos, context?.previousPedidos);
            toastError(`❌ ${err.message}`);
        },
        onSuccess: () => {
            toastSuccess('🗑️ Pedido eliminado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.pedidos });
        },
    });
};
