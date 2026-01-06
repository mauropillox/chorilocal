/**
 * useProductFilters - Custom hook for product filtering and search state
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = 'productos_filters';

export function useProductFilters(productos, productosTags) {
    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state
    const [busqueda, setBusqueda] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [filtroStockBajo, setFiltroStockBajo] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [precioMin, setPrecioMin] = useState('');
    const [precioMax, setPrecioMax] = useState('');
    const [categoriaFiltro, setCategoriaFiltro] = useState('');
    const [tagFiltro, setTagFiltro] = useState('');
    const [vistaStock, setVistaStock] = useState(false);

    // Pagination for stock view
    const [stockPage, setStockPage] = useState(1);
    const [stockItemsPerPage, setStockItemsPerPage] = useState(15);

    // Restore persisted filters from localStorage
    useEffect(() => {
        try {
            const savedFilters = localStorage.getItem(STORAGE_KEY);
            if (savedFilters) {
                const filters = JSON.parse(savedFilters);
                if (filters.filtroStockBajo !== undefined) setFiltroStockBajo(filters.filtroStockBajo);
                if (filters.filtroTipo) setFiltroTipo(filters.filtroTipo);
                if (filters.showAll !== undefined) setShowAll(filters.showAll);
                if (filters.vistaStock !== undefined) setVistaStock(filters.vistaStock);
            }
        } catch (e) { /* ignore */ }
    }, []);

    // Persist filters to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            filtroStockBajo,
            filtroTipo,
            showAll,
            vistaStock
        }));
    }, [filtroStockBajo, filtroTipo, showAll, vistaStock]);

    // Handle URL search params (for deep linking from dashboard)
    useEffect(() => {
        const buscarParam = searchParams.get('buscar');
        const stockBajoParam = searchParams.get('stockBajo');
        const crearParam = searchParams.get('crear');

        if (buscarParam) {
            setBusqueda(buscarParam);
            setShowAll(true);
            setSearchParams({});
        }
        if (stockBajoParam === '1') {
            setFiltroStockBajo(true);
            setShowAll(true);
            setSearchParams({});
        }
    }, [searchParams, setSearchParams]);

    // Computed: filtered products
    const productosFiltrados = useMemo(() => {
        if (!busqueda.trim() && !showAll) return [];

        const q = busqueda.trim().toLowerCase();
        let list = q ? productos.filter(p => p.nombre.toLowerCase().includes(q)) : productos.slice();

        // Stock bajo filter
        if (filtroStockBajo) {
            list = list.filter(p => (p.stock || 0) < (p.stock_minimo || 10));
        }

        // Tipo filter
        if (filtroTipo && filtroTipo !== 'todos') {
            list = list.filter(p => (p.stock_tipo || 'unidad') === filtroTipo);
        }

        // Categoria filter
        if (categoriaFiltro) {
            list = list.filter(p => p.categoria_id === parseInt(categoriaFiltro));
        }

        // Tag filter
        if (tagFiltro && productosTags) {
            const tagId = parseInt(tagFiltro);
            list = list.filter(p => productosTags[p.id]?.some(t => t.id === tagId));
        }

        // Precio min/max
        if (precioMin) {
            const min = parseFloat(precioMin);
            if (!Number.isNaN(min)) list = list.filter(p => (p.precio || 0) >= min);
        }
        if (precioMax) {
            const max = parseFloat(precioMax);
            if (!Number.isNaN(max)) list = list.filter(p => (p.precio || 0) <= max);
        }

        return list;
    }, [busqueda, showAll, productos, filtroStockBajo, filtroTipo, categoriaFiltro, tagFiltro, precioMin, precioMax, productosTags]);

    // Computed: stock bajo count
    const stockBajoCount = useMemo(() => {
        return productos.filter(p => (p.stock || 0) < (p.stock_minimo || 10)).length;
    }, [productos]);

    // Stock bajo products
    const productosStockBajo = useMemo(() => {
        return productos.filter(p => (p.stock || 0) < (p.stock_minimo || 10));
    }, [productos]);

    // Reset filters
    const resetFilters = useCallback(() => {
        setBusqueda('');
        setShowAll(false);
        setFiltroStockBajo(false);
        setFiltroTipo('todos');
        setPrecioMin('');
        setPrecioMax('');
        setCategoriaFiltro('');
        setTagFiltro('');
    }, []);

    return {
        // State
        busqueda,
        showAll,
        filtroStockBajo,
        filtroTipo,
        precioMin,
        precioMax,
        categoriaFiltro,
        tagFiltro,
        vistaStock,
        stockPage,
        stockItemsPerPage,

        // Setters
        setBusqueda,
        setShowAll,
        setFiltroStockBajo,
        setFiltroTipo,
        setPrecioMin,
        setPrecioMax,
        setCategoriaFiltro,
        setTagFiltro,
        setVistaStock,
        setStockPage,
        setStockItemsPerPage,

        // Computed
        productosFiltrados,
        stockBajoCount,
        productosStockBajo,

        // Actions
        resetFilters
    };
}

export default useProductFilters;
