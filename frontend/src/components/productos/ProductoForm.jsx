/**
 * ProductoForm - Product creation form component
 */
import { useState, useRef, useEffect } from 'react';
import { authFetch } from '../../authFetch';
import { toastSuccess, toastError, toastWarn } from '../../toast';

export function ProductoForm({
    categorias,
    onProductoCreated,
    stockBajo = []
}) {
    const [nombre, setNombre] = useState('');
    const [precio, setPrecio] = useState('');
    const [stock, setStock] = useState('0');
    const [stockTipo, setStockTipo] = useState('unidad');
    const [stockMinimo, setStockMinimo] = useState('10');
    const [stockMinimoTipo, setStockMinimoTipo] = useState('unidad');
    const [imagenUrl, setImagenUrl] = useState('');
    const [fileUploading, setFileUploading] = useState(false);
    const [filePreview, setFilePreview] = useState(null);
    const [creating, setCreating] = useState(false);
    const [urlError, setUrlError] = useState('');
    const [categoriaProducto, setCategoriaProducto] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const fileInputRef = useRef(null);
    const nombreInputRef = useRef(null);

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (filePreview && filePreview.startsWith('blob:')) {
                URL.revokeObjectURL(filePreview);
            }
        };
    }, [filePreview]);

    const validateUrl = (v) => {
        if (!v) { setUrlError(''); return; }
        try {
            const u = new URL(v);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
            setUrlError('');
        } catch (_) { setUrlError('URL inválida'); }
    };

    const uploadFile = async (file) => {
        if (filePreview && filePreview.startsWith('blob:')) {
            URL.revokeObjectURL(filePreview);
        }
        setFilePreview(URL.createObjectURL(file));
        setFileUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: fd });
            if (!res.ok) {
                toastError('Error al subir la imagen');
                setFileUploading(false);
                return;
            }
            const data = await res.json();
            let url = data.url || data.path || '';
            if (url.startsWith('/')) url = `${import.meta.env.VITE_API_URL}${url}`;
            setImagenUrl(url);
            setUrlError('');
        } catch (err) {
            toastError('Error de conexión al subir imagen');
        } finally {
            setFileUploading(false);
        }
    };

    const handleFileChange = async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        await uploadFile(f);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadFile(e.dataTransfer.files[0]);
        }
    };

    const agregarProducto = async () => {
        if (!nombre || !precio) {
            toastWarn("Debe ingresar el nombre y el precio del producto");
            return;
        }
        if (imagenUrl && urlError) {
            toastWarn('URL de imagen inválida');
            return;
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

        const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Reset form
            setNombre('');
            setPrecio('');
            setStock('0');
            setStockTipo('unidad');
            setStockMinimo('10');
            setStockMinimoTipo('unidad');
            if (filePreview && filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
            setImagenUrl('');
            setFilePreview(null);
            setUrlError('');
            setCategoriaProducto('');
            toastSuccess('Producto creado correctamente');
            onProductoCreated?.();
        } else {
            try {
                const err = await res.json();
                const msg = (err && (err.detail?.detail || err.detail || err.message)) || 'Error al crear producto';
                toastError(msg);
            } catch (_) {
                toastError('Error al crear producto');
            }
        }
        setCreating(false);
    };

    return (
        <div className="panel">
            {stockBajo.length > 0 && (
                <div className="alert-warning mb-4" style={{ padding: '0.75rem 1rem' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="font-semibold" style={{ color: '#d97706' }}>
                                ⚠️ {stockBajo.length} productos con stock bajo
                            </span>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {stockBajo.slice(0, 2).map(p => p.nombre).join(', ')}
                                {stockBajo.length > 2 && ` y ${stockBajo.length - 2} más`}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Agregar Producto
            </h3>

            <div className="form-group">
                <label>Nombre *</label>
                <input
                    ref={nombreInputRef}
                    autoFocus
                    type="text"
                    placeholder="Nombre del producto"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && agregarProducto()}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                    <label>Precio *</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={precio}
                        onChange={e => setPrecio(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && agregarProducto()}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="form-group">
                    <label>Stock inicial</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={stock}
                        min="0"
                        step="0.5"
                        onChange={e => setStock(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && agregarProducto()}
                    />
                </div>
                <div className="form-group">
                    <label>Tipo</label>
                    <select value={stockTipo} onChange={e => setStockTipo(e.target.value)}>
                        <option value="unidad">Unidad</option>
                        <option value="kg">Kilo</option>
                        <option value="caja">Caja</option>
                        <option value="gancho">Gancho</option>
                        <option value="tira">Tira</option>
                    </select>
                </div>
            </div>

            <div className="form-group">
                <label>Stock mínimo</label>
                <input
                    type="number"
                    placeholder="10"
                    value={stockMinimo}
                    min="0"
                    step="0.5"
                    onChange={e => setStockMinimo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && agregarProducto()}
                />
            </div>

            <div className="form-group">
                <label>
                    Categoría <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(opcional)</span>
                </label>
                <select value={categoriaProducto} onChange={e => setCategoriaProducto(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label>Imagen (Drag & Drop o Click)</label>
                <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <div className="text-4xl mb-2">📤</div>
                    <div className="text-sm text-muted">
                        {fileUploading ? '⏳ Subiendo...' : 'Arrastra una imagen o haz click'}
                    </div>
                </div>
                {filePreview && (
                    <div className="mt-3 flex justify-center">
                        <img src={filePreview} alt="preview" className="product-image" />
                    </div>
                )}
            </div>

            <div className="form-group">
                <label>O URL de imagen</label>
                <input
                    type="text"
                    placeholder="https://..."
                    value={imagenUrl}
                    onChange={e => { setImagenUrl(e.target.value); validateUrl(e.target.value); }}
                />
                {urlError && <span className="text-sm text-danger">{urlError}</span>}
            </div>

            <button
                onClick={agregarProducto}
                disabled={creating || !!urlError || fileUploading}
                className="btn-success w-full"
            >
                {creating ? '⏳ Creando...' : '➕ Agregar Producto'}
            </button>
        </div>
    );
}

export default ProductoForm;
