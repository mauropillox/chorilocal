/**
 * ProductoStockManager - Stock management grid component
 */
import { useState } from 'react';
import { authFetch } from '../../authFetch';
import { toastSuccess } from '../../toast';
import { TableSkeleton } from '../Skeleton';

export function ProductoStockManager({
    productos,
    loading,
    onStockUpdated
}) {
    const [editingStock, setEditingStock] = useState(null);
    const [newStock, setNewStock] = useState('');
    const [newStockTipo, setNewStockTipo] = useState('unidad');
    const [stockPage, setStockPage] = useState(1);
    const [stockItemsPerPage, setStockItemsPerPage] = useState(15);

    const actualizarStock = async (productoId, nuevoStock, nuevoTipo) => {
        // Use PATCH endpoint for stock-only updates (more efficient than PUT)
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stock: parseFloat(nuevoStock) || 0, stock_tipo: nuevoTipo })
        });

        if (res.ok) {
            await onStockUpdated?.();
            setEditingStock(null);
            setNewStock('');
            toastSuccess('Stock actualizado');
        } else {
            const err = await res.json().catch(() => ({}));
            const { toastError } = await import('../../toast');
            toastError(err.detail || 'Error al actualizar stock');
        }
    };

    if (loading) {
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>📦 Gestor de Stock</h3>
                </div>
                <TableSkeleton rows={10} columns={4} />
            </div>
        );
    }

    const totalStockPages = Math.ceil(productos.length / stockItemsPerPage);
    const stockStartIndex = (stockPage - 1) * stockItemsPerPage;
    const stockEndIndex = stockStartIndex + stockItemsPerPage;
    const productosPaginados = productos.slice(stockStartIndex, stockEndIndex);

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>📦 Gestor de Stock</h3>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>💡 Haz clic en Stock para editar</span>
            </div>

            {/* Top Pagination */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '12px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)'
            }}>
                <button
                    onClick={() => setStockPage(Math.max(1, stockPage - 1))}
                    disabled={stockPage === 1}
                    className="btn-secondary"
                    style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                >
                    ← Anterior
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {stockStartIndex + 1}-{Math.min(stockEndIndex, productos.length)} de {productos.length}
                    </span>
                    <select
                        value={stockItemsPerPage}
                        onChange={(e) => {
                            const val = e.target.value === 'all' ? productos.length : parseInt(e.target.value);
                            setStockItemsPerPage(val);
                            setStockPage(1);
                        }}
                        style={{
                            background: 'var(--color-bg)',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            minHeight: '36px'
                        }}
                    >
                        <option value={10}>10/pág</option>
                        <option value={15}>15/pág</option>
                        <option value={25}>25/pág</option>
                        <option value={50}>50/pág</option>
                        <option value={100}>100/pág</option>
                        <option value="all">Todos</option>
                    </select>
                </div>

                <button
                    onClick={() => setStockPage(Math.min(totalStockPages, stockPage + 1))}
                    disabled={stockPage === totalStockPages}
                    className="btn-secondary"
                    style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                >
                    Siguiente →
                </button>
            </div>

            {/* Stock Table */}
            <div className="stock-table-container">
                <table className="stock-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style={{ textAlign: 'center' }}>Stock</th>
                            <th style={{ textAlign: 'center' }}>Mínimo</th>
                            <th style={{ textAlign: 'center' }}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosPaginados.map(p => {
                            const bajo = (p.stock || 0) < (p.stock_minimo || 10);
                            return (
                                <tr key={p.id} className={bajo ? 'stock-bajo' : ''}>
                                    <td className="truncate" title={p.nombre} style={{ maxWidth: '200px' }}>{p.nombre}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {editingStock === p.id ? (
                                            <div className="flex items-center gap-1 justify-center">
                                                <input
                                                    type="number"
                                                    value={newStock}
                                                    onChange={e => setNewStock(e.target.value)}
                                                    className="w-16 text-sm p-1 border rounded"
                                                    min="0"
                                                    step="0.5"
                                                    autoFocus
                                                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') actualizarStock(p.id, newStock, newStockTipo);
                                                        if (e.key === 'Escape') setEditingStock(null);
                                                    }}
                                                />
                                                <select
                                                    value={newStockTipo}
                                                    onChange={e => setNewStockTipo(e.target.value)}
                                                    className="text-sm p-1 rounded"
                                                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                                >
                                                    <option value="unidad">U</option>
                                                    <option value="kg">Kg</option>
                                                    <option value="gramo">g</option>
                                                    <option value="litro">L</option>
                                                    <option value="mililitro">ml</option>
                                                    <option value="caja">C</option>
                                                    <option value="gancho">G</option>
                                                    <option value="tira">T</option>
                                                    <option value="paquete">P</option>
                                                    <option value="bandeja">B</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <span
                                                className="editable-cell px-3 py-1 font-semibold inline-block rounded"
                                                onClick={() => {
                                                    setEditingStock(p.id);
                                                    setNewStock(String(p.stock || 0));
                                                    setNewStockTipo(p.stock_tipo || 'unidad');
                                                }}
                                                title="Clic para editar stock"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {p.stock || 0} {(p.stock_tipo || 'unidad').charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {p.stock_minimo || 10} {(p.stock_tipo || 'unidad').charAt(0).toUpperCase()}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {editingStock === p.id ? (
                                            <div className="flex gap-2 justify-center">
                                                <button
                                                    onClick={() => actualizarStock(p.id, newStock, newStockTipo)}
                                                    className="btn-success px-3 py-1 text-sm"
                                                    style={{ minHeight: '32px' }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setEditingStock(null)}
                                                    className="btn-ghost px-2 py-1 text-sm"
                                                    style={{ minHeight: '32px' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : bajo ? (
                                            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Bajo</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-success)' }}>✓ OK</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginTop: '12px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)'
            }}>
                <button
                    onClick={() => setStockPage(Math.max(1, stockPage - 1))}
                    disabled={stockPage === 1}
                    className="btn-secondary"
                    style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                >
                    ← Anterior
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 500 }}>
                    Página {stockPage} de {totalStockPages}
                </span>
                <button
                    onClick={() => setStockPage(Math.min(totalStockPages, stockPage + 1))}
                    disabled={stockPage === totalStockPages}
                    className="btn-secondary"
                    style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                >
                    Siguiente →
                </button>
            </div>
        </>
    );
}

export default ProductoStockManager;
