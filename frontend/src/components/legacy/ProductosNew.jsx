/**
 * Productos.jsx - Main product management component (Refactored)
 * 
 * This is the orchestrator component that composes:
 * - useProductos: CRUD operations and data loading
 * - useProductFilters: Filtering and search state
 * - ProductoForm: Product creation form
 * - ProductoList: Product list with filters
 * - ProductoStockManager: Stock management grid
 * - ProductoEditModal: Full product editing modal
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { authFetch } from '../authFetch';
import { toastSuccess, toastError } from '../toast';

// Import modular components
import {
    useProductos,
    useProductFilters,
    ProductoForm,
    ProductoList,
    ProductoStockManager,
    ProductoEditModal
} from './productos';

export default function Productos() {
    // Core data hook
    const {
        productos,
        loading,
        categorias,
        productosEnOferta,
        allTags,
        productosTags,
        cargarProductos
    } = useProductos();

    // Filters hook
    const {
        busqueda,
        showAll,
        filtroStockBajo,
        filtroTipo,
        precioMin,
        precioMax,
        categoriaFiltro,
        tagFiltro,
        vistaStock,
        setBusqueda,
        setShowAll,
        setFiltroStockBajo,
        setFiltroTipo,
        setPrecioMin,
        setPrecioMax,
        setCategoriaFiltro,
        setTagFiltro,
        setVistaStock,
        productosFiltrados,
        productosStockBajo
    } = useProductFilters(productos, productosTags);

    // Edit modal state
    const [editingProducto, setEditingProducto] = useState(null);

    // Export functions
    const exportarCSV = async () => {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/export/csv`);
        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'productos.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }
    };

    const exportarExcel = async () => {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/export/xlsx`);
        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'productos.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toastSuccess('Excel exportado correctamente');
        } else {
            toastError('Error al exportar Excel');
        }
    };

    return (
        <div style={{ color: 'var(--color-text)' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    📦 Productos
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setVistaStock(!vistaStock)}
                        className={vistaStock ? "btn-primary" : "btn-secondary"}
                    >
                        🔄 {vistaStock ? "Normal" : "Gestor Stock"}
                    </button>
                    <button onClick={exportarCSV} className="btn-secondary">📥 CSV</button>
                    <button onClick={exportarExcel} className="btn-secondary">📊 Excel</button>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="two-column-layout">
                {/* LEFT: Form */}
                <ProductoForm
                    categorias={categorias}
                    onProductoCreated={cargarProductos}
                    stockBajo={productosStockBajo}
                />

                {/* RIGHT: List or Stock Manager */}
                <div className="panel">
                    {vistaStock ? (
                        <ProductoStockManager
                            productos={productos}
                            loading={loading}
                            onStockUpdated={cargarProductos}
                        />
                    ) : (
                        <ProductoList
                            productos={productos}
                            productosFiltrados={productosFiltrados}
                            categorias={categorias}
                            allTags={allTags}
                            productosTags={productosTags}
                            productosEnOferta={productosEnOferta}
                            loading={loading}
                            busqueda={busqueda}
                            setBusqueda={setBusqueda}
                            showAll={showAll}
                            setShowAll={setShowAll}
                            filtroStockBajo={filtroStockBajo}
                            setFiltroStockBajo={setFiltroStockBajo}
                            filtroTipo={filtroTipo}
                            setFiltroTipo={setFiltroTipo}
                            categoriaFiltro={categoriaFiltro}
                            setCategoriaFiltro={setCategoriaFiltro}
                            tagFiltro={tagFiltro}
                            setTagFiltro={setTagFiltro}
                            precioMin={precioMin}
                            setPrecioMin={setPrecioMin}
                            precioMax={precioMax}
                            setPrecioMax={setPrecioMax}
                            onProductoUpdated={cargarProductos}
                            onEditProducto={setEditingProducto}
                        />
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingProducto && (
                <ProductoEditModal
                    producto={editingProducto}
                    categorias={categorias}
                    onClose={() => setEditingProducto(null)}
                    onSaved={cargarProductos}
                />
            )}
        </div>
    );
}
