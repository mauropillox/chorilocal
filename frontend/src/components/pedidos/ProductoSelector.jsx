/**
 * ProductoSelector - Reusable product selection with search and filtering
 * Extracted from Pedidos.jsx for better maintainability
 */
import React, { useMemo, forwardRef } from 'react';

const ProductoSelector = forwardRef(function ProductoSelector({
    productos,
    productosSeleccionados,
    busqueda,
    setBusqueda,
    onProductoClick,
    sortBy,
    setSortBy,
    showAll,
    setShowAll,
    loading = false,
    ofertasActivas = []
}, searchInputRef) {

    // Get IDs of products already selected
    const selectedIds = useMemo(() =>
        new Set(productosSeleccionados.map(p => p.id)),
        [productosSeleccionados]
    );

    // Get products in active offers
    const productosEnOferta = useMemo(() => {
        const ids = new Set();
        ofertasActivas.forEach(oferta => {
            oferta.productos?.forEach(p => ids.add(p.producto_id));
        });
        return ids;
    }, [ofertasActivas]);

    // Filter and sort products
    const productosFiltrados = useMemo(() => {
        let filtered = productos.filter(p =>
            p.nombre.toLowerCase().includes(busqueda.toLowerCase())
        );

        // Sort based on sortBy
        switch (sortBy) {
            case 'nombre_asc':
                filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
                break;
            case 'nombre_desc':
                filtered.sort((a, b) => b.nombre.localeCompare(a.nombre));
                break;
            case 'precio_asc':
                filtered.sort((a, b) => a.precio - b.precio);
                break;
            case 'precio_desc':
                filtered.sort((a, b) => b.precio - a.precio);
                break;
            default:
                break;
        }

        // Limit display unless showAll
        if (!showAll && filtered.length > 12) {
            return filtered.slice(0, 12);
        }
        return filtered;
    }, [productos, busqueda, sortBy, showAll]);

    const totalFiltrados = useMemo(() =>
        productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).length,
        [productos, busqueda]
    );

    return (
        <div className="producto-selector">
            <div className="producto-selector-header">
                <label className="form-label">📦 Productos</label>

                {/* Search input */}
                <div className="producto-search">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar producto... (presiona / para enfocar)"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="search-input"
                        aria-label="Buscar productos"
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            className="clear-search"
                            aria-label="Limpiar búsqueda"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Sort controls */}
                <div className="sort-controls">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                        aria-label="Ordenar productos"
                    >
                        <option value="nombre_asc">Nombre A-Z</option>
                        <option value="nombre_desc">Nombre Z-A</option>
                        <option value="precio_asc">Precio ↑</option>
                        <option value="precio_desc">Precio ↓</option>
                    </select>
                </div>
            </div>

            {/* Product grid */}
            {loading ? (
                <div className="loading-indicator">Cargando productos...</div>
            ) : (
                <>
                    <div className="producto-grid">
                        {productosFiltrados.map(producto => {
                            const isSelected = selectedIds.has(producto.id);
                            const isOnSale = productosEnOferta.has(producto.id);

                            return (
                                <button
                                    key={producto.id}
                                    onClick={() => !isSelected && onProductoClick(producto)}
                                    disabled={isSelected}
                                    className={`producto-card ${isSelected ? 'selected' : ''} ${isOnSale ? 'on-sale' : ''}`}
                                    aria-pressed={isSelected}
                                    aria-label={`${producto.nombre} - $${producto.precio}`}
                                >
                                    <span className="producto-nombre">{producto.nombre}</span>
                                    <span className="producto-precio">${producto.precio.toFixed(2)}</span>
                                    {isOnSale && <span className="oferta-badge">🏷️</span>}
                                    {isSelected && <span className="selected-badge">✓</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Show all toggle */}
                    {totalFiltrados > 12 && !showAll && (
                        <button
                            onClick={() => setShowAll(true)}
                            className="show-all-btn"
                        >
                            Ver todos ({totalFiltrados} productos)
                        </button>
                    )}
                    {showAll && totalFiltrados > 12 && (
                        <button
                            onClick={() => setShowAll(false)}
                            className="show-less-btn"
                        >
                            Mostrar menos
                        </button>
                    )}
                </>
            )}
        </div>
    );
});

export default ProductoSelector;
