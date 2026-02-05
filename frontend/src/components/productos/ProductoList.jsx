/**
 * ProductoList - Product list with filters component
 */
import { useState, useRef } from 'react';
import { authFetch } from '../../authFetch';
import { toastSuccess, toastError } from '../../toast';
import { ProductListSkeleton } from '../Skeleton';

export function ProductoList({
    productos,
    productosFiltrados,
    categorias,
    allTags,
    productosTags,
    productosEnOferta,
    loading,
    busqueda,
    setBusqueda,
    showAll,
    setShowAll,
    filtroStockBajo,
    setFiltroStockBajo,
    filtroTipo,
    setFiltroTipo,
    categoriaFiltro,
    setCategoriaFiltro,
    tagFiltro,
    setTagFiltro,
    precioMin,
    setPrecioMin,
    precioMax,
    setPrecioMax,
    onProductoUpdated,
    onEditProducto
}) {
    const [editingImage, setEditingImage] = useState(null);
    const [editingCategoria, setEditingCategoria] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const searchInputRef = useRef(null);

    const actualizarImagenProducto = async (productoId, nuevaImagenUrl) => {
        const producto = productos.find(p => p.id === productoId);
        if (!producto) return;

        const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...producto, imagen_url: nuevaImagenUrl })
        });

        if (res.ok) {
            await onProductoUpdated?.();
            setEditingImage(null);
            if (filePreview && filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
            setFilePreview(null);
        }
    };

    const actualizarCategoriaProducto = async (productoId, nuevaCategoriaId) => {
        const producto = productos.find(p => p.id === productoId);
        if (!producto) return;

        const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...producto,
                categoria_id: nuevaCategoriaId ? parseInt(nuevaCategoriaId) : null
            })
        });

        if (res.ok) {
            await onProductoUpdated?.();
            setEditingCategoria(null);
            toastSuccess('Categoría actualizada');
        } else {
            toastError('Error al actualizar categoría');
        }
    };

    const handleFileChange = async (e, productoId) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        await uploadFile(f, productoId);
    };

    const uploadFile = async (file, productoId) => {
        if (filePreview && filePreview.startsWith('blob:')) {
            URL.revokeObjectURL(filePreview);
        }
        setFilePreview(URL.createObjectURL(file));

        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: fd });
            if (!res.ok) {
                toastError('Error al subir la imagen');
                return;
            }
            const data = await res.json();
            let url = data.url || data.path || '';
            if (url.startsWith('/')) url = `${import.meta.env.VITE_API_URL}${url}`;

            if (productoId) {
                await actualizarImagenProducto(productoId, url);
                toastSuccess('Imagen actualizada');
            }
        } catch (err) {
            toastError('Error de conexión al subir imagen');
        }
    };

    return (
        <>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Listado</h3>

            <div className="form-group">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="🔍 Buscar productos..."
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setShowAll(false); }}
                    className="w-full"
                />
            </div>

            {/* Advanced filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={filtroStockBajo}
                        onChange={e => setFiltroStockBajo(e.target.checked)}
                    />
                    Stock bajo
                </label>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="text-sm p-2 border rounded">
                    <option value="todos">Tipo: Todos</option>
                    <option value="unidad">Tipo: Unidad</option>
                    <option value="kg">Tipo: Kilogramo (kg)</option>
                    <option value="gramo">Tipo: Gramo (g)</option>
                    <option value="litro">Tipo: Litro (L)</option>
                    <option value="mililitro">Tipo: Mililitro (ml)</option>
                    <option value="caja">Tipo: Caja</option>
                    <option value="gancho">Tipo: Gancho</option>
                    <option value="tira">Tipo: Tira</option>
                    <option value="paquete">Tipo: Paquete</option>
                    <option value="bandeja">Tipo: Bandeja</option>
                    <option value="caja">Tipo: Caja</option>
                    <option value="gancho">Tipo: Gancho</option>
                    <option value="tira">Tipo: Tira</option>
                </select>
                <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="text-sm p-2 border rounded">
                    <option value="">Categoría: Todas</option>
                    {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                </select>
                <select value={tagFiltro} onChange={e => setTagFiltro(e.target.value)} className="text-sm p-2 border rounded">
                    <option value="">Tag: Todos</option>
                    <optgroup label="Conservación">
                        {allTags.filter(t => t.tipo === 'conservacion').map(tag => (
                            <option key={tag.id} value={tag.id}>{tag.nombre}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Tipo de producto">
                        {allTags.filter(t => t.tipo === 'tipo').map(tag => (
                            <option key={tag.id} value={tag.id}>{tag.nombre}</option>
                        ))}
                    </optgroup>
                </select>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                    type="number"
                    placeholder="Precio min"
                    value={precioMin}
                    onChange={e => setPrecioMin(e.target.value)}
                    className="text-sm p-2 border rounded"
                />
                <input
                    type="number"
                    placeholder="Precio max"
                    value={precioMax}
                    onChange={e => setPrecioMax(e.target.value)}
                    className="text-sm p-2 border rounded"
                />
            </div>

            {loading ? (
                <ProductListSkeleton count={5} />
            ) : productosFiltrados.length === 0 && !busqueda && !showAll ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <div className="empty-state-text">Escribe para buscar productos</div>
                    <button onClick={() => setShowAll(true)} className="btn-secondary">
                        Ver todos ({productos.length})
                    </button>
                </div>
            ) : productosFiltrados.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div className="empty-state-text">No se encontraron</div>
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                    {productosFiltrados.map(p => {
                        const bajo = (p.stock || 0) < (p.stock_minimo || 10);
                        const categoria = categorias.find(c => c.id === p?.categoria_id);
                        return (
                            <div key={p?.id} className={`card-item ${bajo ? 'stock-bajo-item' : ''}`} style={{ padding: '12px' }}>
                                <div className="flex items-start gap-3">
                                    {/* Image */}
                                    <div
                                        className="relative group cursor-pointer flex-shrink-0"
                                        onClick={() => setEditingImage(editingImage === p.id ? null : p.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && setEditingImage(editingImage === p.id ? null : p.id)}
                                        aria-label={`Cambiar imagen de ${p?.nombre || 'producto'}`}
                                        title="Click para cambiar imagen"
                                    >
                                        {p?.imagen_url ? (
                                            <img src={p.imagen_url} alt={p?.nombre || 'Producto'} className="product-image" loading="lazy" />
                                        ) : (
                                            <div className="product-image-placeholder">📦</div>
                                        )}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center rounded-lg"
                                            style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4))' }}
                                        >
                                            <span className="text-2xl mb-1" aria-hidden="true">📷</span>
                                            <span className="text-white text-xs font-medium">Cambiar</span>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                                                {p?.nombre || 'Sin nombre'}
                                            </span>
                                            {productosEnOferta.has(p?.id) && (
                                                <span style={{
                                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                    color: '#fff', fontSize: '0.6rem', padding: '2px 6px',
                                                    borderRadius: '6px', fontWeight: 700, flexShrink: 0
                                                }}>OFERTA</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 text-sm mb-2">
                                            <span className="font-bold" style={{ color: 'var(--color-success)' }}>${p?.precio || 0}</span>
                                            <span className={`${bajo ? 'text-orange-600 font-bold' : ''}`} style={{ color: bajo ? undefined : 'var(--color-text-muted)' }}>
                                                📦 {p?.stock || 0} {p?.stock_tipo || 'unidad'}
                                            </span>
                                        </div>

                                        {/* Category badge - improved styling */}
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                                            style={{
                                                backgroundColor: categoria ? `${categoria.color}15` : 'var(--color-bg-secondary)',
                                                border: `2px solid ${categoria?.color || 'var(--color-border)'}`,
                                                color: categoria?.color || 'var(--color-text-muted)',
                                                fontSize: '0.875rem',
                                                fontWeight: 600
                                            }}
                                            onClick={(e) => { e.stopPropagation(); setEditingCategoria(editingCategoria === p.id ? null : p.id); }}
                                            title="Click para cambiar categoría"
                                        >
                                            <span style={{
                                                width: '10px', height: '10px', borderRadius: '50%',
                                                backgroundColor: categoria?.color || '#9ca3af',
                                                boxShadow: categoria ? `0 0 4px ${categoria.color}60` : 'none'
                                            }} />
                                            <span>{categoria?.nombre || 'Sin categoría'}</span>
                                            <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>▼</span>
                                        </button>

                                        {/* Product tags - improved styling */}
                                        {productosTags[p.id] && productosTags[p.id].length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {productosTags[p.id].slice(0, 4).map(tag => (
                                                    <span
                                                        key={tag.id}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md"
                                                        style={{
                                                            backgroundColor: `${tag.color || '#6b7280'}18`,
                                                            color: tag.color || '#6b7280',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 500,
                                                            border: `1px solid ${tag.color || '#6b7280'}40`
                                                        }}
                                                        title={tag.nombre}
                                                    >
                                                        <span>{tag.icono || '🏷️'}</span>
                                                        <span>{tag.nombre?.replace(/^[^\s]+ /, '')}</span>
                                                    </span>
                                                ))}
                                                {productosTags[p.id].length > 4 && (
                                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                                        +{productosTags[p.id].length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Edit button */}
                                    <button
                                        onClick={() => onEditProducto?.(p)}
                                        className="btn-ghost"
                                        style={{ padding: '6px 10px', minHeight: 'auto', flexShrink: 0 }}
                                        title="Editar producto"
                                    >
                                        ✏️
                                    </button>
                                </div>

                                {/* Inline category editor */}
                                {editingCategoria === p.id && (
                                    <div className="mt-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '2px solid var(--color-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                        <div className="text-sm mb-3 font-bold" style={{ color: 'var(--color-text)' }}>📁 Seleccionar categoría:</div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => { actualizarCategoriaProducto(p.id, ''); }}
                                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${!p.categoria_id ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                                                style={{
                                                    backgroundColor: 'var(--color-bg)',
                                                    border: '2px solid var(--color-border)',
                                                    color: 'var(--color-text)'
                                                }}
                                            >
                                                Sin categoría
                                            </button>
                                            {categorias.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => actualizarCategoriaProducto(p.id, cat.id)}
                                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${p.categoria_id === cat.id ? 'ring-2 ring-offset-2' : ''}`}
                                                    style={{
                                                        backgroundColor: `${cat.color}20`,
                                                        border: `2px solid ${cat.color}`,
                                                        color: cat.color,
                                                        '--tw-ring-color': cat.color
                                                    }}
                                                >
                                                    {cat.nombre}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setEditingCategoria(null)}
                                            className="mt-3 text-sm font-medium px-3 py-1 rounded hover:bg-gray-100"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            ✕ Cerrar
                                        </button>
                                    </div>
                                )}

                                {/* Image editor */}
                                {editingImage === p.id && (
                                    <div className="mt-3 p-4 rounded-xl" style={{
                                        backgroundColor: 'var(--color-bg-secondary)',
                                        border: '2px dashed var(--color-primary)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-2xl">📷</span>
                                            <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Cambiar Imagen</span>
                                        </div>

                                        <label
                                            className="flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-200"
                                            style={{
                                                backgroundColor: 'var(--color-bg-tertiary, var(--color-bg-secondary))',
                                                border: '2px solid var(--color-border)',
                                                minHeight: '100px'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, var(--color-bg-secondary))';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary, var(--color-bg-secondary))';
                                            }}
                                        >
                                            <span className="text-3xl mb-2">📤</span>
                                            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                                Click para seleccionar imagen
                                            </span>
                                            <span className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                                JPG, PNG, GIF (máx. 5MB)
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, p.id)}
                                                className="hidden"
                                            />
                                        </label>

                                        <div className="flex justify-end mt-3">
                                            <button
                                                onClick={() => setEditingImage(null)}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                                style={{
                                                    backgroundColor: 'var(--color-bg-accent)',
                                                    color: 'var(--color-text-muted)'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, var(--color-bg-accent))'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-accent)'}
                                            >
                                                ✕ Cerrar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {(busqueda || showAll) && productosFiltrados.length > 0 && (
                <div className="mt-3 text-sm text-muted text-center">
                    Mostrando {productosFiltrados.length} de {productos.length}
                </div>
            )}
        </>
    );
}

export default ProductoList;
