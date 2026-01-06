/**
 * ProductoEditModal - Full product editing modal
 */
import { useState, useEffect } from 'react';
import { authFetch } from '../../authFetch';
import { toastSuccess, toastError } from '../../toast';

export function ProductoEditModal({
    producto,
    categorias,
    onClose,
    onSaved
}) {
    const [editForm, setEditForm] = useState({
        nombre: '',
        precio: '',
        stock: '',
        stock_minimo: '',
        stock_tipo: 'unidad',
        categoria_id: '',
        imagen_url: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (producto) {
            setEditForm({
                nombre: producto.nombre || '',
                precio: String(producto.precio || ''),
                stock: String(producto.stock || '0'),
                stock_minimo: String(producto.stock_minimo || '10'),
                stock_tipo: producto.stock_tipo || 'unidad',
                categoria_id: producto.categoria_id || '',
                imagen_url: producto.imagen_url || ''
            });
        }
    }, [producto]);

    const guardarEdicion = async () => {
        if (!producto) return;
        if (!editForm.nombre.trim()) {
            toastError('El nombre es requerido');
            return;
        }
        if (!editForm.precio || parseFloat(editForm.precio) < 0) {
            toastError('Precio inválido');
            return;
        }

        setSaving(true);
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${producto.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: editForm.nombre.trim(),
                    precio: parseFloat(editForm.precio),
                    stock: parseFloat(editForm.stock) || 0,
                    stock_minimo: parseFloat(editForm.stock_minimo) || 10,
                    stock_tipo: editForm.stock_tipo,
                    categoria_id: editForm.categoria_id ? parseInt(editForm.categoria_id) : null,
                    imagen_url: editForm.imagen_url || null
                })
            });

            if (res.ok) {
                toastSuccess('Producto actualizado correctamente');
                onSaved?.();
                onClose?.();
            } else {
                const err = await res.json().catch(() => ({}));
                toastError(err.detail || 'Error al actualizar producto');
            }
        } catch (e) {
            toastError('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    if (!producto) return null;

    return (
        <div className="modal-overlay" onClick={() => !saving && onClose?.()}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
                    ✏️ Editar Producto
                </h3>

                <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                            Nombre *
                        </label>
                        <input
                            type="text"
                            value={editForm.nombre}
                            onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                            className="w-full p-2 border rounded"
                            placeholder="Nombre del producto"
                        />
                    </div>

                    {/* Precio y Stock en fila */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                Precio *
                            </label>
                            <input
                                type="number"
                                value={editForm.precio}
                                onChange={(e) => setEditForm({ ...editForm, precio: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                Stock
                            </label>
                            <input
                                type="number"
                                value={editForm.stock}
                                onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Stock mínimo y tipo */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                Stock Mínimo
                            </label>
                            <input
                                type="number"
                                value={editForm.stock_minimo}
                                onChange={(e) => setEditForm({ ...editForm, stock_minimo: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="10"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                Tipo Stock
                            </label>
                            <select
                                value={editForm.stock_tipo}
                                onChange={(e) => setEditForm({ ...editForm, stock_tipo: e.target.value })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="unidad">Unidad</option>
                                <option value="caja">Caja</option>
                                <option value="gancho">Gancho</option>
                                <option value="tira">Tira</option>
                            </select>
                        </div>
                    </div>

                    {/* Categoría - improved styling */}
                    <div>
                        <label className="block text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
                            📁 Categoría
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, categoria_id: '' })}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${!editForm.categoria_id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                style={{
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    border: '2px solid var(--color-border)',
                                    color: 'var(--color-text)'
                                }}
                            >
                                Sin categoría
                            </button>
                            {categorias.map(cat => (
                                <button
                                    type="button"
                                    key={cat.id}
                                    onClick={() => setEditForm({ ...editForm, categoria_id: cat.id })}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${String(editForm.categoria_id) === String(cat.id) ? 'ring-2 ring-offset-2' : ''}`}
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
                    </div>

                    {/* URL imagen */}
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                            URL Imagen (opcional)
                        </label>
                        <input
                            type="text"
                            value={editForm.imagen_url}
                            onChange={(e) => setEditForm({ ...editForm, imagen_url: e.target.value })}
                            className="w-full p-2 border rounded"
                            placeholder="https://..."
                        />
                    </div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="btn-secondary flex-1"
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={guardarEdicion}
                        className="btn-primary flex-1"
                        disabled={saving}
                    >
                        {saving ? '⏳ Guardando...' : '💾 Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProductoEditModal;
