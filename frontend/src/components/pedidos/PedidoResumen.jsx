/**
 * PedidoResumen - Order summary with quantity editing and totals
 * Extracted from Pedidos.jsx for better maintainability
 */
import React, { useMemo } from 'react';

export default function PedidoResumen({
    productosSeleccionados,
    setProductosSeleccionados,
    notas,
    setNotas,
    onGuardar,
    onLimpiar,
    guardando = false,
    clienteId
}) {
    // Calculate totals
    const { subtotal, totalItems } = useMemo(() => {
        let subtotal = 0;
        let totalItems = 0;

        productosSeleccionados.forEach(p => {
            const cantidad = p.cantidad || 1;
            const precio = p.precio || 0;
            subtotal += precio * cantidad;
            totalItems += cantidad;
        });

        return { subtotal, totalItems };
    }, [productosSeleccionados]);

    // Update quantity for a product
    const updateCantidad = (productoId, nuevaCantidad) => {
        if (nuevaCantidad <= 0) {
            // Remove if quantity is 0 or less
            setProductosSeleccionados(prev =>
                prev.filter(p => p.id !== productoId)
            );
        } else {
            setProductosSeleccionados(prev =>
                prev.map(p =>
                    p.id === productoId
                        ? { ...p, cantidad: nuevaCantidad }
                        : p
                )
            );
        }
    };

    // Remove a product
    const removeProducto = (productoId) => {
        setProductosSeleccionados(prev =>
            prev.filter(p => p.id !== productoId)
        );
    };

    // Check if can save
    const canSave = clienteId && productosSeleccionados.length > 0;

    return (
        <div className="pedido-resumen">
            <h3 className="resumen-title">
                🛒 Resumen del Pedido
                {productosSeleccionados.length > 0 && (
                    <span className="item-count">({totalItems} items)</span>
                )}
            </h3>

            {productosSeleccionados.length === 0 ? (
                <div className="empty-resumen">
                    <p>No hay productos seleccionados</p>
                    <p className="hint">Haz clic en un producto para agregarlo</p>
                </div>
            ) : (
                <>
                    {/* Products list */}
                    <div className="resumen-productos">
                        {productosSeleccionados.map(producto => (
                            <div key={producto.id} className="resumen-item">
                                <div className="resumen-item-info">
                                    <span className="resumen-item-nombre">{producto.nombre}</span>
                                    <span className="resumen-item-precio">
                                        ${(producto.precio * (producto.cantidad || 1)).toFixed(2)}
                                    </span>
                                </div>
                                <div className="resumen-item-controls">
                                    <button
                                        onClick={() => updateCantidad(producto.id, (producto.cantidad || 1) - 1)}
                                        className="qty-btn"
                                        aria-label="Reducir cantidad"
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={producto.cantidad || 1}
                                        onChange={(e) => updateCantidad(producto.id, parseFloat(e.target.value) || 0)}
                                        className="qty-input"
                                        aria-label={`Cantidad de ${producto.nombre}`}
                                    />
                                    <button
                                        onClick={() => updateCantidad(producto.id, (producto.cantidad || 1) + 1)}
                                        className="qty-btn"
                                        aria-label="Aumentar cantidad"
                                    >
                                        +
                                    </button>
                                    <button
                                        onClick={() => removeProducto(producto.id)}
                                        className="remove-btn"
                                        aria-label={`Quitar ${producto.nombre}`}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div className="resumen-total">
                        <span>Total:</span>
                        <span className="total-amount">${subtotal.toFixed(2)}</span>
                    </div>
                </>
            )}

            {/* Notes */}
            <div className="resumen-notas">
                <label htmlFor="notas-pedido">📝 Notas (opcional)</label>
                <textarea
                    id="notas-pedido"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Agregar notas o instrucciones especiales..."
                    rows={2}
                    className="notas-textarea"
                />
            </div>

            {/* Actions */}
            <div className="resumen-actions">
                <button
                    onClick={onLimpiar}
                    className="btn-secondary"
                    disabled={productosSeleccionados.length === 0 && !clienteId}
                >
                    🧹 Limpiar
                </button>
                <button
                    onClick={onGuardar}
                    className="btn-primary"
                    disabled={!canSave || guardando}
                >
                    {guardando ? '⏳ Guardando...' : '💾 Guardar Pedido (Ctrl+S)'}
                </button>
            </div>

            {!canSave && productosSeleccionados.length > 0 && (
                <p className="warning-text">⚠️ Selecciona un cliente para guardar</p>
            )}
        </div>
    );
}
