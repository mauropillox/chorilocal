import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch, authFetchJson } from '../authFetch';
import { toastSuccess, toastError, toastWarn } from '../toast';
import { CACHE_KEYS } from '../utils/queryClient';
import HelpBanner from './HelpBanner';
import { logger } from '../utils/logger';

export default function Pedidos() {
  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: CACHE_KEYS.clientes,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`);
      if (!res.ok) return [];
      return Array.isArray(data) ? data : (data.data || []);
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: productos = [], isLoading: productosLoading } = useQuery({
    queryKey: CACHE_KEYS.productos,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
      if (!res.ok) return [];
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const [clienteId, setClienteId] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
  const [sortBy, setSortBy] = useState('nombre_asc');
  const [showAll, setShowAll] = useState(false);
  const [ofertasActivas, setOfertasActivas] = useState([]);
  const [notas, setNotas] = useState(''); // Notas/observaciones del pedido
  const searchInputRef = useRef(null);
  const guardarPedidoRef = useRef(null);

  // Keyboard shortcuts effect - uses ref to avoid stale closure
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        guardarPedidoRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Confirm before leaving if there's a draft
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (clienteId || productosSeleccionados.length > 0) {
        e.preventDefault();
        e.returnValue = '¿Seguro que quieres salir? Tienes un pedido sin guardar.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [clienteId, productosSeleccionados.length]);

  useEffect(() => {
    (async () => {
      setLoadingClientes(true);
      const rc = await authFetch(`${import.meta.env.VITE_API_URL}/clientes`);
      if (rc.ok) { const data = await rc.json(); setClientes(data); }
      else setClientes([]);
      setLoadingClientes(false);

      setLoadingProductos(true);
      try {
        const { res: rp, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
        if (rp.ok && Array.isArray(data)) setProductos(data); else setProductos([]);
      } catch (e) { setProductos([]); }
      setLoadingProductos(false);

      // Cargar ofertas activas
      try {
        const ro = await authFetch(`${import.meta.env.VITE_API_URL}/ofertas/activas`);
        if (ro.ok) {
          const ofertas = await ro.json();
          setOfertasActivas(ofertas);
        }
      } catch (e) {
        logger.error('Error cargando ofertas:', e);
      }

      toastSuccess('📦 Clientes, productos y ofertas cargados correctamente');
    })();

    // Restore draft from localStorage
    const draft = localStorage.getItem('pedido_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.clienteId) setClienteId(parsed.clienteId);
        if (Array.isArray(parsed.productos)) setProductosSeleccionados(parsed.productos);
        if (parsed.notas) setNotas(parsed.notas);
      } catch (e) { logger.warn('Failed to restore draft:', e); }
    }
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (clienteId || productosSeleccionados.length > 0 || notas) {
      localStorage.setItem('pedido_draft', JSON.stringify({ clienteId, productos: productosSeleccionados, notas }));
    }
  }, [clienteId, productosSeleccionados, notas]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedBusqueda(busquedaProducto), 250);
    return () => clearTimeout(id);
  }, [busquedaProducto]);

  const agregarProducto = (producto) => {
    if (!productosSeleccionados.some(p => p.id === producto.id)) {
      setProductosSeleccionados([...productosSeleccionados, { ...producto, cantidad: 1, tipo: 'unidad' }]);
    }
  };

  const cambiarCantidad = (id, cantidad) => {
    let val = parseFloat(cantidad) || 0;
    // Redondear a múltiplo de 0.5
    val = Math.round(val * 2) / 2;
    // Mínimo 0.5
    if (val < 0.5) val = 0.5;
    setProductosSeleccionados(productosSeleccionados.map(p => p.id === id ? { ...p, cantidad: val } : p));
  };

  const incrementarCantidad = (id) => {
    setProductosSeleccionados(productosSeleccionados.map(p => {
      if (p.id === id) {
        let nueva = (parseFloat(p.cantidad) || 0) + 0.5;
        return { ...p, cantidad: nueva };
      }
      return p;
    }));
  };

  const decrementarCantidad = (id) => {
    setProductosSeleccionados(productosSeleccionados.map(p => {
      if (p.id === id) {
        let nueva = (parseFloat(p.cantidad) || 0.5) - 0.5;
        if (nueva < 0.5) nueva = 0.5;
        return { ...p, cantidad: nueva };
      }
      return p;
    }));
  };

  const cambiarTipo = (id, tipo) => {
    setProductosSeleccionados(productosSeleccionados.map(p => p.id === id ? { ...p, tipo } : p));
  };

  const eliminarProducto = (id) => {
    setProductosSeleccionados(productosSeleccionados.filter(p => p.id !== id));
  };

  // Obtener descuento activo para un producto
  const obtenerDescuento = (productoId) => {
    const oferta = ofertasActivas.find(o =>
      o.productos && o.productos.some(p => p.producto_id === productoId)
    );
    return oferta ? oferta.descuento_porcentaje : 0;
  };

  // Calcular precio con descuento
  const calcularPrecioFinal = (precio, productoId) => {
    const descuento = obtenerDescuento(productoId);
    if (descuento > 0) {
      return precio * (1 - descuento / 100);
    }
    return precio;
  };

  // Calcular total estimado en vivo (memoizado para evitar recálculos)
  const { items: itemsConTotales, total: totalEstimado } = useMemo(() => {
    let total = 0;
    const items = productosSeleccionados.map(p => {
      const precioOriginal = parseFloat(p.precio);
      const cantidad = parseFloat(p.cantidad);
      const descuento = obtenerDescuento(p.id);
      const precioFinal = calcularPrecioFinal(precioOriginal, p.id);
      const precioValido = !isNaN(precioOriginal) && precioOriginal > 0;
      const cantidadValida = !isNaN(cantidad) && cantidad > 0;
      const subtotal = precioValido && cantidadValida ? precioFinal * cantidad : 0;
      if (cantidadValida) total += subtotal;
      return {
        id: p.id,
        nombre: p.nombre,
        cantidad,
        precio: precioOriginal,
        precioFinal,
        descuento,
        subtotal,
        precioValido,
        cantidadValida
      };
    });
    return { items, total };
  }, [productosSeleccionados, ofertasActivas]);

  // Formato moneda UYU
  const formatUYU = (value) => {
    if (isNaN(value) || value === null) return '$ 0,00';
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const guardarPedido = useCallback(async () => {
    if (!clienteId) { toastWarn("Debes seleccionar un cliente primero"); return; }
    if (productosSeleccionados.length === 0) { toastWarn("Debes agregar al menos un producto"); return; }

    // Verificar stock antes de guardar
    const sinStock = productosSeleccionados.filter(ps => {
      const prod = productos.find(p => p.id === ps.id);
      return prod && (prod.stock || 0) < ps.cantidad;
    });

    if (sinStock.length > 0) {
      const msgs = sinStock.map(ps => {
        const prod = productos.find(p => p.id === ps.id);
        return `${ps.nombre}: pedido ${ps.cantidad}, disponible ${prod?.stock || 0}`;
      });
      toastWarn("Stock insuficiente: " + msgs.join("; "));
      return;
    }

    const cliente = clientes.find(c => c.id === parseInt(clienteId));

    // Transform products to match backend ProductoPedido model
    const productosForBackend = productosSeleccionados.map(p => ({
      id: p.id,
      nombre: p.nombre || p.nome,  // Handle both nombre and nome
      precio: p.precio,
      cantidad: p.cantidad,
      tipo: p.tipo
    }));

    const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, productos: productosForBackend, notas: notas.trim() })
    });
    if (res.ok) {
      toastSuccess("Pedido guardado correctamente");
      localStorage.removeItem('pedido_draft'); // Clear draft
      setClienteId('');
      setProductosSeleccionados([]);
      setNotas('');
      // Recargar productos para actualizar stock
      const { res: rp, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
      if (rp.ok && Array.isArray(data)) setProductos(data);
    } else {
      const err = await res.json().catch(() => ({}));
      if (err.detail?.errores) {
        const msgs = err.detail.errores.map(e => `${e.nombre}: pedido ${e.cantidad_pedida}, disponible ${e.stock_disponible}`);
        toastWarn("Stock insuficiente: " + msgs.join("; "));
      } else {
        toastError(err.detail?.message || "Error al guardar pedido");
      }
    }
  }, [clienteId, productosSeleccionados, productos, clientes, notas]);

  // Keep ref updated for keyboard shortcut
  useEffect(() => {
    guardarPedidoRef.current = clienteId && productosSeleccionados.length > 0 ? guardarPedido : null;
  }, [guardarPedido, clienteId, productosSeleccionados.length]);

  // Memoizar productos filtrados para evitar recálculos
  const productosFiltrados = useMemo(() => {
    if (!debouncedBusqueda.trim() && !showAll) return [];
    let list = productos.slice();
    const q = debouncedBusqueda.trim().toLowerCase();
    if (q) list = list.filter(p => p.nombre.toLowerCase().includes(q));
    if (sortBy === 'nombre_asc') list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (sortBy === 'nombre_desc') list.sort((a, b) => b.nombre.localeCompare(a.nombre));
    if (sortBy === 'precio_asc') list.sort((a, b) => a.precio - b.precio);
    if (sortBy === 'precio_desc') list.sort((a, b) => b.precio - a.precio);
    return list;
  }, [debouncedBusqueda, showAll, productos, sortBy]);

  const clienteSeleccionado = clientes.find(c => c.id === parseInt(clienteId));

  return (
    <div style={{ color: 'var(--color-text)' }}>
      <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-primary)' }}>🛒 Crear Pedido</h2>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo crear un pedido?"
        icon="🛒"
        items={[
          { label: 'Paso 1 - Elegir cliente', text: 'Clickeá el selector arriba, escribí el nombre y elegí de la lista. Si es cliente nuevo, andá a la sección Clientes primero.' },
          { label: 'Paso 2 - Buscar productos', text: 'Presioná "/" para activar el buscador rápido o escribí directamente en la barra. Los productos aparecen con foto, precio y stock.' },
          { label: 'Paso 3 - Agregar al pedido', text: 'Clickeá el producto para agregarlo. Ajustá la cantidad con los botones + / - o escribí directo en el campo.' },
          { label: 'Paso 4 - Revisar total', text: 'El resumen de la derecha muestra subtotal, descuentos y total final. Podés aplicar descuentos o elegir método de pago.' },
          { label: 'Paso 5 - Guardar', text: 'Presioná Ctrl+S o clickeá "💾 Guardar Pedido". El pedido aparecerá en el Historial con estado "Pendiente".' },
          { label: 'Tips', text: 'Usá las categorías para filtrar productos. Los productos en oferta se marcan con 🎁. El stock bajo aparece en naranja.' }
        ]}
      />

      <div className="two-column-layout">
        {/* LEFT: Panel de pedido */}
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Datos del Pedido</h3>

          <div className="form-group">
            <label htmlFor="cliente-select">Cliente *</label>
            <select id="cliente-select" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full" aria-label="Seleccionar cliente">
              <option value="">-- Elegí un cliente --</option>
              {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
            </select>
          </div>

          {clienteSeleccionado && (
            <div className="card-accent p-3 mb-4">
              <div className="font-semibold" style={{ color: 'var(--color-primary)' }}>👤 {clienteSeleccionado.nombre}</div>
              <div className="text-sm text-muted">{clienteSeleccionado.telefono || 'Sin teléfono'}</div>
              <div className="text-sm text-muted">{clienteSeleccionado.direccion || 'Sin dirección'}</div>
            </div>
          )}

          {productosSeleccionados.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  🧊 Productos ({productosSeleccionados.length})
                </h4>
                <button onClick={() => setProductosSeleccionados([])} className="btn-ghost text-sm px-3 py-1" aria-label="Limpiar todos los productos seleccionados">
                  ✕ Limpiar
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {productosSeleccionados.map(p => {
                  const itemInfo = itemsConTotales.find(i => i.id === p.id);
                  const sinPrecio = itemInfo && !itemInfo.precioValido;
                  const cantidadInvalida = itemInfo && !itemInfo.cantidadValida;
                  return (
                    <div key={p.id} className="card-item flex items-center gap-2 p-2" style={sinPrecio || cantidadInvalida ? { borderLeft: '3px solid #ef4444' } : {}}>
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="product-image-sm"
                          onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextElementSibling && (e.target.nextElementSibling.style.display = 'flex'); }}
                        />
                      ) : null}
                      <div className="product-image-placeholder-sm" style={{ display: p.imagen_url ? 'none' : 'flex' }}>📦</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate font-medium block" style={{ color: 'var(--color-text)' }}>
                          {p.nombre}
                          {itemInfo?.descuento > 0 && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-bold"
                              style={{ background: '#10b981', color: 'white' }}>
                              🎉 -{itemInfo.descuento}%
                            </span>
                          )}
                        </span>
                        <div className="text-xs" style={{ color: sinPrecio ? '#ef4444' : 'var(--color-text-muted)' }}>
                          {sinPrecio ? '⚠️ Sin precio' : (
                            <>
                              {itemInfo?.descuento > 0 ? (
                                <>
                                  <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{formatUYU(p.precio)}</span>
                                  {' → '}
                                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatUYU(itemInfo.precioFinal)}</span>
                                  {' c/u'}
                                </>
                              ) : (
                                `${formatUYU(p.precio)} c/u`
                              )}
                            </>
                          )}
                          {cantidadInvalida && <span style={{ color: '#ef4444', marginLeft: '8px' }}>⚠️ Cantidad inválida</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => decrementarCantidad(p.id)}
                          className="text-sm font-bold rounded"
                          style={{
                            minWidth: '28px',
                            minHeight: '32px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          title="Restar 0.5"
                          aria-label={`Restar 0.5 a ${p.nombre}`}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={p.cantidad}
                          onChange={(e) => cambiarCantidad(p.id, e.target.value)}
                          className="w-14 p-1 text-sm rounded text-center"
                          style={{ minHeight: '32px', borderColor: cantidadInvalida ? '#ef4444' : '#d1d5db', border: '1px solid' }}
                          aria-label={`Cantidad de ${p.nombre}`}
                        />
                        <button
                          onClick={() => incrementarCantidad(p.id)}
                          className="text-sm font-bold rounded"
                          style={{
                            minWidth: '28px',
                            minHeight: '32px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          title="Sumar 0.5"
                          aria-label={`Sumar 0.5 a ${p.nombre}`}
                        >
                          +
                        </button>
                      </div>
                      <select value={p.tipo} onChange={(e) => cambiarTipo(p.id, e.target.value)} className="p-1 text-sm rounded" style={{ minHeight: '32px' }} aria-label={`Tipo de ${p.nombre}`}>
                        <option value="unidad">Unidad</option>
                        <option value="caja">Caja</option>
                        <option value="gancho">Gancho</option>
                        <option value="tira">Tira</option>
                      </select>
                      <div className="text-sm font-semibold text-right" style={{ minWidth: '80px', color: itemInfo?.subtotal > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {itemInfo?.subtotal > 0 ? formatUYU(itemInfo.subtotal) : '-'}
                      </div>
                      <button onClick={() => eliminarProducto(p.id)} className="btn-danger text-sm px-2 py-1" style={{ minHeight: '32px' }} aria-label={`Eliminar ${p.nombre}`}>✕</button>
                    </div>
                  );
                })}
              </div>

              {/* Panel Total Estimado */}
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '12px',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>💰 Total Estimado</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{productosSeleccionados.length} producto(s)</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                  {formatUYU(totalEstimado)}
                </div>
                {(() => {
                  const totalSinDescuento = itemsConTotales.reduce((sum, item) => {
                    return sum + (item.precio * item.cantidad);
                  }, 0);
                  const ahorro = totalSinDescuento - totalEstimado;
                  return ahorro > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.875rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🎉 Ahorrás {formatUYU(ahorro)} con ofertas activas
                    </div>
                  );
                })()}
                {itemsConTotales.some(i => !i.precioValido || !i.cantidadValida) && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ Algunos productos tienen precio o cantidad inválidos
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notas del Pedido */}
          <div className="mt-4">
            <label htmlFor="pedido-notas" className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              📝 Notas / Observaciones (opcional)
            </label>
            <textarea
              id="pedido-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Entregar antes de las 15:00, dejar en portería, etc."
              className="w-full p-3 border rounded-lg text-sm"
              style={{
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '2px solid var(--color-border)',
                minHeight: '80px',
                resize: 'vertical'
              }}
              rows="3"
            />
          </div>

          <button
            onClick={guardarPedido}
            disabled={!clienteId || productosSeleccionados.length === 0}
            className="btn-success w-full mt-4"
          >
            💾 Guardar Pedido
          </button>

          {!clienteId && (
            <div className="text-sm text-muted text-center mt-2">⚠️ Selecciona un cliente para continuar</div>
          )}
        </div>

        {/* RIGHT: Catálogo de productos */}
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Catálogo</h3>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={busquedaProducto}
              onChange={(e) => { setBusquedaProducto(e.target.value); setShowAll(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && productosFiltrados.length > 0) {
                  e.preventDefault();
                  agregarProducto(productosFiltrados[0]);
                }
              }}
              placeholder="🔍 Buscar productos..."
              className="flex-1"
              ref={searchInputRef}
              aria-label="Buscar productos"
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-36" aria-label="Ordenar productos">
              <option value="nombre_asc">Nombre ↑</option>
              <option value="nombre_desc">Nombre ↓</option>
              <option value="precio_asc">Precio ↑</option>
              <option value="precio_desc">Precio ↓</option>
            </select>
          </div>

          {loadingProductos ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="card-item flex items-center gap-3">
                  <div className="skeleton" style={{ width: '60px', height: '60px', borderRadius: '8px' }}></div>
                  <div className="flex-1">
                    <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '8px' }}></div>
                    <div className="skeleton" style={{ height: '14px', width: '40%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : productosFiltrados.length === 0 && !debouncedBusqueda && !showAll ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">Busca productos para agregar</div>
              <button onClick={() => setShowAll(true)} className="btn-secondary">
                Ver todos ({productos.length})
              </button>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-text">No se encontraron productos</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {productosFiltrados.map(p => {
                const yaAgregado = productosSeleccionados.some(ps => ps.id === p.id);
                const descuento = obtenerDescuento(p.id);
                const precioFinal = calcularPrecioFinal(p.precio, p.id);
                return (
                  <div key={p.id} className={`card-item flex items-center gap-3 ${yaAgregado ? 'opacity-50' : ''} ${(p.stock || 0) < 10 ? 'border-l-4 border-orange-400' : ''}`} style={{ cursor: 'default' }}>
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="product-image-sm"
                        onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextElementSibling && (e.target.nextElementSibling.style.display = 'flex'); }}
                      />
                    ) : null}
                    <div className="product-image-placeholder-sm" style={{ display: p.imagen_url ? 'none' : 'flex' }}>📦</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                        {p.nombre}
                        {descuento > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#10b981', color: 'white' }}>
                            🎉 -{descuento}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {descuento > 0 ? (
                          <>
                            <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>${p.precio}</span>
                            <span className="font-semibold" style={{ color: '#10b981' }}>${precioFinal.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="font-medium" style={{ color: 'var(--color-success)' }}>${p.precio}</span>
                        )}
                        <span className={`text-xs ${(p.stock || 0) < 10 ? 'text-orange-600 font-bold' : 'text-gray-400'}`}>
                          📦 {p.stock || 0}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => agregarProducto(p)}
                      disabled={yaAgregado || (p.stock || 0) === 0}
                      className={yaAgregado ? "btn-ghost px-3 py-1 text-sm" : (p.stock || 0) === 0 ? "btn-ghost px-3 py-1 text-sm text-red-500" : "btn-primary px-3 py-1 text-sm"}
                      style={{ minHeight: '36px' }}
                    >
                      {yaAgregado ? '✓' : (p.stock || 0) === 0 ? '✕' : '+'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {(debouncedBusqueda || showAll) && productosFiltrados.length > 0 && (
            <div className="mt-3 text-sm text-muted text-center">
              Mostrando {productosFiltrados.length} de {productos.length} productos
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
