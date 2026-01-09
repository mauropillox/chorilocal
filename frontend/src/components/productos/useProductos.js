/**
 * useProductos - Custom hook for product CRUD operations
 * Handles loading, creating, updating products
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { authFetch, authFetchJson } from '../../authFetch';
import { toastSuccess, toastError, toastWarn } from '../../toast';

export function useProductos() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [categorias, setCategorias] = useState([]);
    const [productosEnOferta, setProductosEnOferta] = useState(new Set());
    const [allTags, setAllTags] = useState([]);
    const [productosTags, setProductosTags] = useState({});

    const cargarProductos = useCallback(async () => {
        setLoading(true);
        try {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
            if (!res.ok) { setProductos([]); return; }
            setProductos(Array.isArray(data) ? data : []);
        } catch (e) {
            setProductos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const cargarCategorias = useCallback(async () => {
        try {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/categorias`);
            if (res.ok && Array.isArray(data)) {
                setCategorias(data);
            }
        } catch (e) { /* ignore */ }
    }, []);

    const cargarOfertas = useCallback(async () => {
        try {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/ofertas/activas`);
            if (res.ok && Array.isArray(data)) {
                const idsEnOferta = new Set();
                data.forEach(o => (o.productos_ids || []).forEach(id => idsEnOferta.add(id)));
                setProductosEnOferta(idsEnOferta);
            }
        } catch (e) { /* ignore */ }
    }, []);

    const cargarTags = useCallback(async () => {
        try {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/tags`);
            if (res.ok && Array.isArray(data)) {
                setAllTags(data);
            }
        } catch (e) { /* ignore */ }

        try {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos-con-tags`);
            if (res.ok && Array.isArray(data)) {
                const tagMap = {};
                data.forEach(p => {
                    if (p.tags && Array.isArray(p.tags)) {
                        tagMap[p.id] = p.tags;
                    }
                });
                setProductosTags(tagMap);
            }
        } catch (e) { /* ignore */ }
    }, []);

    const agregarProducto = useCallback(async (formData, filePreview) => {
        const { nombre, precio, stock, stockTipo, stockMinimo, imagenUrl, categoriaProducto, urlError } = formData;

        if (!nombre || !precio) {
            toastWarn("Debe ingresar el nombre y el precio del producto");
            return false;
        }
        if (imagenUrl && urlError) {
            toastWarn('URL de imagen inválida');
            return false;
        }

        setCreating(true);
        const payload = {
            nombre,
            precio: parseFloat(precio),
            stock: parseFloat(stock) || 0,
            stock_tipo: stockTipo,
            stock_minimo: parseFloat(stockMinimo) || 10,
            imagen_url: imagenUrl || null
        };

        if (categoriaProducto) {
            payload.categoria_id = parseInt(categoriaProducto);
        }

        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await cargarProductos();
                if (filePreview && filePreview.startsWith('blob:')) {
                    URL.revokeObjectURL(filePreview);
                }
                toastSuccess('Producto creado correctamente');
                setCreating(false);
                return true;
            } else {
                const err = await res.json().catch(() => ({}));
                const msg = err.detail?.detail || err.detail || err.message || 'Error al crear producto';
                toastError(msg);
                setCreating(false);
                return false;
            }
        } catch (e) {
            toastError('Error de conexión');
            setCreating(false);
            return false;
        }
    }, [cargarProductos]);

    const actualizarProducto = useCallback(async (productoId, updateData) => {
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
            });

            if (res.ok) {
                await cargarProductos();
                toastSuccess('Producto actualizado correctamente');
                return true;
            } else {
                const err = await res.json().catch(() => ({}));
                toastError(err.detail || 'Error al actualizar producto');
                return false;
            }
        } catch (e) {
            toastError('Error de conexión');
            return false;
        }
    }, [cargarProductos]);

    const actualizarStock = useCallback(async (productoId, nuevoStock, nuevoTipo) => {
        try {
            // Use PATCH endpoint for stock-only updates (more efficient)
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stock: parseFloat(nuevoStock) || 0, stock_tipo: nuevoTipo })
            });

            if (res.ok) {
                await cargarProductos();
                toastSuccess('Stock actualizado');
                return true;
            } else {
                const err = await res.json().catch(() => ({}));
                toastError(err.detail || 'Error al actualizar stock');
                return false;
            }
        } catch (e) {
            toastError('Error de conexión');
            return false;
        }
    }, [cargarProductos]);

    // Load all data on mount
    useEffect(() => {
        cargarProductos();
        cargarOfertas();
        cargarCategorias();
        cargarTags();
    }, [cargarProductos, cargarOfertas, cargarCategorias, cargarTags]);

    return {
        productos,
        loading,
        creating,
        categorias,
        productosEnOferta,
        allTags,
        productosTags,
        cargarProductos,
        agregarProducto,
        actualizarProducto,
        actualizarStock
    };
}

export default useProductos;
