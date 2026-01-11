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
 * 
 * Toast Behavior:
 * - Shows toast when component mounts and data is ready (cache or fresh)
 * - Uses useEffect to ensure toast shows every time user enters a tab
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
    const toastShown = useRef(false);

    const query = useQuery({
        queryKey: CACHE_KEYS.productos,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
            if (res.ok) {
                const productos = Array.isArray(data) ? data : (data?.data || []);
                // Sync to Zustand store
                setProductosInStore?.(productos);
                return productos;
            }
            return [];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        ...options,
    });

    // Show toast when data is ready (either from cache or fresh fetch)
    useEffect(() => {
        if (!query.isLoading && query.data && options.showToast !== false && !toastShown.current) {
            toastSuccess('📦 Productos cargados');
            toastShown.current = true;
        }
    }, [query.isLoading, query.data, options.showToast]);

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
    const toastShown = useRef(false);

    const query = useQuery({
        queryKey: CACHE_KEYS.clientes,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`);
            if (res.ok) {
                const clientes = Array.isArray(data) ? data : (data?.data || []);
                setClientesInStore?.(clientes);
                return clientes;
            }
            return [];
        },
        staleTime: 1000 * 60 * 5,
        ...options,
    });

    useEffect(() => {
        if (!query.isLoading && query.data && options.showToast !== false && !toastShown.current) {
            toastSuccess('👥 Clientes cargados');
            toastShown.current = true;
        }
    }, [query.isLoading, query.data, options.showToast]);

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
    const toastShown = useRef(false);

    const query = useQuery({
        queryKey: CACHE_KEYS.categorias,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/categorias`);
            if (res.ok) {
                const categorias = Array.isArray(data) ? data : [];
                setCategoriasInStore?.(categorias);
                return categorias;
            }
            return [];
        },
        staleTime: 1000 * 60 * 10,
        ...options,
    });

    useEffect(() => {
        if (!query.isLoading && query.data && options.showToast !== false && !toastShown.current) {
            toastSuccess('🏷️ Categorías cargadas');
            toastShown.current = true;
        }
    }, [query.isLoading, query.data, options.showToast]);

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
    const toastShown = useRef(false);

    const query = useQuery({
        queryKey: CACHE_KEYS.pedidos,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos`);
            if (res.ok) {
                const pedidos = Array.isArray(data) ? data : [];
                setPedidosInStore?.(pedidos);
                return pedidos;
            }
            return [];
        },
        staleTime: 1000 * 60 * 2,
        ...options,
    });

    useEffect(() => {
        if (!query.isLoading && query.data && options.showToast !== false && !toastShown.current) {
            toastSuccess('📋 Pedidos cargados');
            toastShown.current = true;
        }
    }, [query.isLoading, query.data, options.showToast]);

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
    const toastShown = useRef(false);

    const query = useQuery({
        queryKey: CACHE_KEYS.ofertas,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/ofertas`);
            if (res.ok) {
                const ofertas = Array.isArray(data) ? data : [];
                setOfertasInStore?.(ofertas);
                return ofertas;
            }
            return [];
        },
        staleTime: 1000 * 60 * 5,
        ...options,
    });

    useEffect(() => {
        if (!query.isLoading && query.data && options.showToast !== false && !toastShown.current) {
            toastSuccess('💰 Ofertas cargadas');
            toastShown.current = true;
        }
    }, [query.isLoading, query.data, options.showToast]);

    return {
        ...query,
        ofertas: query.data || [],
    };
};
