/**
 * Hybrid React Query + Zustand hooks
 * 
 * These hooks use React Query for data fetching and caching,
 * while syncing with Zustand store for global state sharing.
 * 
 * Benefits:
 * - React Query handles fetching, refetching, staleness, background updates
 * - Zustand provides global state accessible outside React components
 * - Single source of truth for catalog data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { authFetchJson } from '../authFetch';
import { CACHE_KEYS } from '../utils/queryClient';
import { toastSuccess } from '../toast';

/**
 * Hybrid hook for productos
 * Uses React Query for fetching, syncs to Zustand for global access
 */
export const useProductosQuery = (options = {}) => {
    const queryClient = useQueryClient();
    const setProductosInStore = useAppStore(state => state.setProductos);

    const query = useQuery({
        queryKey: CACHE_KEYS.productos,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
            if (res.ok) {
                const productos = Array.isArray(data) ? data : (data?.data || []);
                // Sync to Zustand store
                setProductosInStore?.(productos);
                if (options.showToast !== false) {
                    toastSuccess('📦 Productos cargados');
                }
                return productos;
            }
            return [];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        ...options,
    });

    return {
        ...query,
        productos: query.data || [],
    };
};

/**
 * Hybrid hook for clientes
 */
export const useClientesQuery = (options = {}) => {
    const queryClient = useQueryClient();
    const setClientesInStore = useAppStore(state => state.setClientes);

    const query = useQuery({
        queryKey: CACHE_KEYS.clientes,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`);
            if (res.ok) {
                const clientes = Array.isArray(data) ? data : (data?.data || []);
                // Sync to Zustand store
                setClientesInStore?.(clientes);
                if (options.showToast !== false) {
                    toastSuccess('👥 Clientes cargados');
                }
                return clientes;
            }
            return [];
        },
        staleTime: 1000 * 60 * 5,
        ...options,
    });

    return {
        ...query,
        clientes: query.data || [],
    };
};

/**
 * Hybrid hook for categorias
 */
export const useCategoriasQuery = (options = {}) => {
    const queryClient = useQueryClient();
    const setCategoriasInStore = useAppStore(state => state.setCategorias);

    const query = useQuery({
        queryKey: CACHE_KEYS.categorias,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/categorias`);
            if (res.ok) {
                const categorias = Array.isArray(data) ? data : [];
                // Sync to Zustand store
                setCategoriasInStore?.(categorias);
                if (options.showToast !== false) {
                    toastSuccess('🏷️ Categorías cargadas');
                }
                return categorias;
            }
            return [];
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        ...options,
    });

    return {
        ...query,
        categorias: query.data || [],
    };
};

/**
 * Hybrid hook for pedidos
 */
export const usePedidosQuery = (options = {}) => {
    const queryClient = useQueryClient();
    const setPedidosInStore = useAppStore(state => state.setPedidos);

    const query = useQuery({
        queryKey: CACHE_KEYS.pedidos,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos`);
            if (res.ok) {
                const pedidos = Array.isArray(data) ? data : [];
                // Sync to Zustand store
                setPedidosInStore?.(pedidos);
                if (options.showToast !== false) {
                    toastSuccess('📋 Pedidos cargados');
                }
                return pedidos;
            }
            return [];
        },
        staleTime: 1000 * 60 * 2, // 2 minutes - more dynamic
        ...options,
    });

    return {
        ...query,
        pedidos: query.data || [],
    };
};

/**
 * Hybrid hook for ofertas
 */
export const useOfertasQuery = (options = {}) => {
    const queryClient = useQueryClient();
    const setOfertasInStore = useAppStore(state => state.setOfertas);

    const query = useQuery({
        queryKey: CACHE_KEYS.ofertas,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/ofertas`);
            if (res.ok) {
                const ofertas = Array.isArray(data) ? data : [];
                // Sync to Zustand store
                setOfertasInStore?.(ofertas);
                if (options.showToast !== false) {
                    toastSuccess('💰 Ofertas cargadas');
                }
                return ofertas;
            }
            return [];
        },
        staleTime: 1000 * 60 * 5,
        ...options,
    });

    return {
        ...query,
        ofertas: query.data || [],
    };
};
