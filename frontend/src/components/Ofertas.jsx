import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import authFetch, { authFetchJson } from '../authFetch';
import ConfirmDialog from './ConfirmDialog';
import { toast, toastSuccess, toastError } from '../toast';
import { CACHE_KEYS } from '../utils/queryClient';
import HelpBanner from './HelpBanner';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

export default function Ofertas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Vendedor and oficina users can only view offers, not edit
  const isReadOnly = user?.rol === 'vendedor' || user?.rol === 'oficina';
  const { data: ofertas = [], refetch: refetchOfertas } = useQuery({
    queryKey: CACHE_KEYS.ofertas,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/ofertas`);
      if (res.ok) toastSuccess('💰 Ofertas cargadas');
      return res.ok ? (data || []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: productos = [] } = useQuery({
    queryKey: CACHE_KEYS.productos,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
      // No toast here - productos are secondary data for this tab
      return res.ok ? (Array.isArray(data) ? data : []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const [loading, setLoading] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipoOferta, setTipoOferta] = useState('porcentaje'); // porcentaje, precio_cantidad, nxm, regalo
  const [descuento, setDescuento] = useState(10);
  const [reglas, setReglas] = useState([{ cantidad: 1, precio_unitario: 100 }]); // Para precio_cantidad
  const [compraCantidad, setCompraCantidad] = useState(3); // Para nxm
  const [pagaCantidad, setPagaCantidad] = useState(2); // Para nxm
  const [regaloProductoId, setRegaloProductoId] = useState(''); // Para regalo
  const [regaloCantidad, setRegaloCantidad] = useState(1); // Para regalo
  const [productosSeleccionados, setProductosSeleccionados] = useState([]); // [{producto_id, cantidad}]

  // Buscador de productos
  const [busqueda, setBusqueda] = useState('');

  // Edit mode
  const [editando, setEditando] = useState(null);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ofertaToDelete, setOfertaToDelete] = useState(null);

  // Data will be loaded automatically by useQuery on mount
  // No need for useEffect + cargarDatos

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setDesde('');
    setHasta('');
    setTipoOferta('porcentaje');
    setDescuento(10);
    setReglas([{ cantidad: 1, precio_unitario: 100 }]);
    setCompraCantidad(3);
    setPagaCantidad(2);
    setRegaloProductoId('');
    setRegaloCantidad(1);
    setProductosSeleccionados([]);
    setBusqueda('');
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones por tipo de oferta
    if (!titulo || !desde || !hasta) {
      toastError('Complete título y fechas');
      return;
    }

    // Validar según tipo
    if (tipoOferta === 'porcentaje') {
      if (!descuento || descuento <= 0 || descuento > 100) {
        toastError('El descuento debe estar entre 1 y 100%');
        return;
      }
    } else if (tipoOferta === 'precio_cantidad') {
      if (!reglas || reglas.length === 0) {
        toastError('Debe agregar al menos una regla de precio por cantidad');
        return;
      }
      // Validar que todas las reglas tengan valores válidos
      const reglasInvalidas = reglas.some(r => !r.cantidad || r.cantidad <= 0 || !r.precio_unitario || r.precio_unitario <= 0);
      if (reglasInvalidas) {
        toastError('Todas las reglas deben tener cantidad y precio válidos');
        return;
      }
    } else if (tipoOferta === 'nxm') {
      if (!compraCantidad || compraCantidad < 2 || !pagaCantidad || pagaCantidad < 1) {
        toastError('Cantidades inválidas para oferta NxM (ej: 3x2)');
        return;
      }
      if (pagaCantidad >= compraCantidad) {
        toastError('La cantidad a pagar debe ser menor que la cantidad a comprar');
        return;
      }
    } else if (tipoOferta === 'regalo') {
      if (!regaloProductoId) {
        toastError('Debe seleccionar un producto de regalo');
        return;
      }
      if (!regaloCantidad || regaloCantidad <= 0) {
        toastError('La cantidad de regalo debe ser mayor a 0');
        return;
      }
    }

    try {
      const payload = {
        titulo,
        descripcion: descripcion || '',
        desde,
        hasta,
        tipo: tipoOferta,
        productos: productosSeleccionados
      };

      // Agregar campos específicos por tipo
      if (tipoOferta === 'porcentaje') {
        payload.descuento_porcentaje = descuento;
      } else if (tipoOferta === 'precio_cantidad') {
        payload.reglas = reglas;
      } else if (tipoOferta === 'nxm') {
        payload.compra_cantidad = compraCantidad;
        payload.paga_cantidad = pagaCantidad;
      } else if (tipoOferta === 'regalo') {
        payload.regalo_producto_id = parseInt(regaloProductoId);
        payload.regalo_cantidad = regaloCantidad;
      }

      const url = editando
        ? `${import.meta.env.VITE_API_URL}/ofertas/${editando}`
        : `${import.meta.env.VITE_API_URL}/ofertas`;

      const method = editando ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toastSuccess(editando ? '✅ Oferta actualizada' : '✅ Oferta creada');
        resetForm();
        refetchOfertas();
      } else {
        const errorData = await res.json().catch(() => ({}));
        logger.error('Error response:', errorData);
        toastError('Error al guardar oferta: ' + (errorData.detail || 'Error desconocido'));
      }
    } catch (e) {
      logger.error('Error saving oferta:', e);
      toastError('Error al guardar oferta');
    }
  };

  const editarOferta = (oferta) => {
    setEditando(oferta.id);
    setTitulo(oferta.titulo);
    setDescripcion(oferta.descripcion || '');
    setDesde(oferta.desde);
    setHasta(oferta.hasta);
    setTipoOferta(oferta.tipo || 'porcentaje');
    setDescuento(oferta.descuento_porcentaje || 10);
    setReglas(oferta.reglas || [{ cantidad: 1, precio_unitario: 100 }]);
    setCompraCantidad(oferta.compra_cantidad || 3);
    setPagaCantidad(oferta.paga_cantidad || 2);
    setRegaloProductoId(oferta.regalo_producto_id || '');
    setRegaloCantidad(oferta.regalo_cantidad || 1);
    setProductosSeleccionados(oferta.productos || []);
    setBusqueda('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmarEliminar = (oferta) => {
    setOfertaToDelete(oferta);
    setConfirmOpen(true);
  };

  const eliminarOferta = async () => {
    if (!ofertaToDelete) return;

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/ofertas/${ofertaToDelete.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toastSuccess('🗑️ Oferta eliminada');
        refetchOfertas();
      } else {
        toastError('Error al eliminar oferta');
      }
    } catch (e) {
      logger.error('Error deleting oferta:', e);
      toastError('Error al eliminar oferta');
    } finally {
      setConfirmOpen(false);
      setOfertaToDelete(null);
    }
  };

  const toggleOferta = async (oferta) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/ofertas/${oferta.id}/toggle`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.fechas_actualizadas) {
          toastSuccess(`✅ Oferta activada y fechas actualizadas: ${data.desde} - ${data.hasta}`);
        } else {
          toastSuccess(oferta.activa ? '🔴 Oferta desactivada' : '✅ Oferta activada');
        }
        refetchOfertas();
      } else {
        toastError('Error al cambiar estado');
      }
    } catch (e) {
      logger.error('Error toggling oferta:', e);
      toastError('Error al cambiar estado');
    }
  };

  const toggleProducto = (id) => {
    setProductosSeleccionados(prev => {
      const existe = prev.find(p => p.producto_id === id);
      if (existe) {
        return prev.filter(p => p.producto_id !== id);
      } else {
        return [...prev, { producto_id: id, cantidad: 1 }];
      }
    });
  };

  const cambiarCantidadProducto = (id, cantidad) => {
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant <= 0) return;
    setProductosSeleccionados(prev =>
      prev.map(p => p.producto_id === id ? { ...p, cantidad: cant } : p)
    );
  };

  // Filtrar productos por búsqueda
  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return productos;
    const term = busqueda.toLowerCase();
    return productos.filter(p => p.nombre.toLowerCase().includes(term));
  }, [productos, busqueda]);

  // Productos seleccionados con datos completos
  const productosSeleccionadosData = useMemo(() => {
    return productosSeleccionados.map(ps => {
      const prod = productos.find(p => p.id === ps.producto_id);
      return prod ? { ...prod, cantidad: ps.cantidad } : null;
    }).filter(Boolean);
  }, [productos, productosSeleccionados]);

  if (loading) {
    return (
      <div className="p-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Skeleton count={5} height={120} />
      </div>
    );
  }

  return (
    <div className="p-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 className="text-2xl font-bold mb-4 text-center" style={{ color: 'var(--color-text)' }}>
        � Gestión de Ofertas
      </h1>

      {/* Ayuda colapsable - Solo para admin */}
      {!isReadOnly && (
        <HelpBanner
          title="¿Cómo gestionar ofertas?"
          icon="🎁"
          items={[
            { label: 'Crear oferta', text: 'Completá título, descripción, fechas de vigencia y porcentaje de descuento. Podés aplicarla a productos específicos o de forma general.' },
            { label: 'Asignar productos', text: 'Buscá y seleccioná los productos que quieras incluir en la oferta. Podés agregar o quitar productos en cualquier momento.' },
            { label: 'Vigencia', text: 'Las ofertas se activan/desactivan automáticamente según las fechas configuradas. Las activas se muestran con un contador en el menú.' },
            { label: 'Editar o eliminar', text: 'Clickeá cualquier oferta de la lista para editarla. Podés eliminar ofertas que ya no necesites.' },
            { label: 'Visualización', text: 'Los productos en oferta se marcan con 🎁 en el catálogo y muestran el precio original tachado junto al precio con descuento.' },
            { label: '📊 Tipo: Porcentaje', text: 'Descuento estándar (ej: 15% de descuento). Se aplica sobre el precio original.' },
            { label: '💰 Tipo: Precio × Cantidad', text: 'Define tus propios precios por cantidad (ej: 1-4 unidades a $100, 5-9 a $90, 10+ a $80). Flexibilidad total!' },
            { label: '🎯 Tipo: NxM (3x2, 2x1)', text: 'Ofertas tipo "Llevá 3 pagá 2" o "2x1". Define cuántas unidades se llevan y cuántas se pagan.' },
            { label: '🎁 Tipo: Regalo', text: 'Al comprar X cantidad del producto principal, se regala otro producto. Ideal para promociones especiales.' }
          ]}
        />
      )}

      {/* Formulario - Solo para admin/oficina */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="card mb-6" style={{ background: 'var(--color-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            {editando ? '✏️ Editar Oferta' : '➕ Nueva Oferta'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>Título *</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: 🔥 Oferta de la semana"
                required
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>Descripción</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción corta"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>Desde *</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>Hasta *</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
          </div>

          {/* Selector de tipo de oferta */}
          <div className="form-group mb-4">
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>
              🎯 Tipo de Oferta *
            </label>
            <select
              value={tipoOferta}
              onChange={(e) => setTipoOferta(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            >
              <option value="porcentaje">📊 Descuento por Porcentaje (ej: 15% off)</option>
              <option value="precio_cantidad">💰 Precio por Cantidad (tú defines cantidad → precio)</option>
              <option value="nxm">🎯 Oferta NxM (ej: 3x2, 2x1)</option>
              <option value="regalo">🎁 Regalo con Compra</option>
            </select>
          </div>

          {/* Campos condicionales según tipo */}

          {/* TIPO: PORCENTAJE */}
          {tipoOferta === 'porcentaje' && (
            <div className="form-group mb-4 highlight-success" style={{ padding: '15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>
                💰 Descuento (%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={descuento}
                onChange={(e) => setDescuento(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                placeholder="Ej: 15"
              />
              <small style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                Este descuento se aplicará sobre el precio original del producto
              </small>
            </div>
          )}

          {/* TIPO: PRECIO × CANTIDAD */}
          {tipoOferta === 'precio_cantidad' && (
            <div className="form-group mb-4 highlight-success" style={{ padding: '15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '10px', display: 'block' }}>
                💰 Reglas de Precio por Cantidad *
              </label>
              <small style={{ color: 'var(--color-text-muted)', fontSize: '12px', display: 'block', marginBottom: '10px' }}>
                Define cuánto cuesta cada unidad según la cantidad comprada. Ejemplo: 1 unidad = $100, 5 unidades = $90 c/u, 10 unidades = $80 c/u
              </small>

              {reglas.map((regla, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-center">
                  <div className="flex-1">
                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Cantidad mínima</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={regla.cantidad}
                      onChange={(e) => {
                        const newReglas = [...reglas];
                        newReglas[idx].cantidad = parseInt(e.target.value) || 1;
                        setReglas(newReglas);
                      }}
                      placeholder="Ej: 5"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div className="flex-1">
                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Precio unitario $</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={regla.precio_unitario}
                      onChange={(e) => {
                        const newReglas = [...reglas];
                        newReglas[idx].precio_unitario = parseFloat(e.target.value) || 0;
                        setReglas(newReglas);
                      }}
                      placeholder="Ej: 90.00"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setReglas(reglas.filter((_, i) => i !== idx))}
                    className="btn-danger"
                    disabled={reglas.length === 1}
                    style={{ marginTop: '20px', minHeight: '36px' }}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setReglas([...reglas, { cantidad: (reglas[reglas.length - 1]?.cantidad || 0) + 5, precio_unitario: 100 }])}
                className="btn-secondary text-sm mt-2"
              >
                ➕ Agregar Regla
              </button>
            </div>
          )}

          {/* TIPO: NxM (3x2, 2x1, etc) */}
          {tipoOferta === 'nxm' && (
            <div className="form-group mb-4 highlight-success" style={{ padding: '15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '10px', display: 'block' }}>
                🎯 Configuración NxM (Llevá X, Pagá Y) *
              </label>
              <small style={{ color: 'var(--color-text-muted)', fontSize: '12px', display: 'block', marginBottom: '10px' }}>
                Ejemplos: 3x2 (llevá 3, pagá 2), 2x1 (llevá 2, pagá 1), 5x4 (llevá 5, pagá 4)
              </small>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Cantidad a llevar</label>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={compraCantidad}
                    onChange={(e) => setCompraCantidad(parseInt(e.target.value) || 2)}
                    placeholder="Ej: 3"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Cantidad a pagar</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={pagaCantidad}
                    onChange={(e) => setPagaCantidad(parseInt(e.target.value) || 1)}
                    placeholder="Ej: 2"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>
              <div className="mt-2 text-center" style={{ padding: '10px', background: 'var(--color-bg-accent)', borderRadius: '6px' }}>
                <strong style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                  {compraCantidad}x{pagaCantidad} - Llevá {compraCantidad}, Pagá {pagaCantidad}
                </strong>
              </div>
            </div>
          )}

          {/* TIPO: REGALO */}
          {tipoOferta === 'regalo' && (
            <div className="form-group mb-4 highlight-success" style={{ padding: '15px', borderRadius: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '10px', display: 'block' }}>
                🎁 Producto de Regalo *
              </label>
              <small style={{ color: 'var(--color-text-muted)', fontSize: '12px', display: 'block', marginBottom: '10px' }}>
                Al comprar el producto principal, se regala automáticamente el producto seleccionado
              </small>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Producto a regalar</label>
                  <select
                    value={regaloProductoId}
                    onChange={(e) => setRegaloProductoId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} - ${p.precio}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Cantidad a regalar</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={regaloCantidad}
                    onChange={(e) => setRegaloCantidad(parseInt(e.target.value) || 1)}
                    placeholder="Ej: 1"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Productos seleccionados - mostrar primero */}
          {productosSeleccionadosData.length > 0 && (
            <div className="mb-4">
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '8px', display: 'block' }}>
                ✅ Productos seleccionados ({productosSeleccionadosData.length})
              </label>
              <div className="highlight-success grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {productosSeleccionadosData.map(p => (
                  <div
                    key={p.id}
                    className="card-item flex items-center gap-2 p-3"
                    style={{ marginBottom: 0 }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {p.nombre}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs" style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        Cant:
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={p.cantidad}
                        onChange={(e) => cambiarCantidadProducto(p.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '70px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleProducto(p.id)}
                        className="btn-danger text-sm px-2 py-1"
                        style={{ minHeight: 'auto' }}
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buscador y selector de productos */}
          <div className="form-group mb-4">
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>
              📦 Agregar productos a la oferta
            </label>

            {/* Buscador */}
            <div className="relative mt-2">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="🔍 Buscar producto por nombre..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '2px solid #0ea5e9',
                  fontSize: '14px'
                }}
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Lista de productos filtrados */}
            <div
              className="mt-2 rounded-lg"
              style={{
                maxHeight: '250px',
                overflowY: 'auto',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)'
              }}
            >
              {productosFiltrados.length === 0 ? (
                <div className="p-4 text-center" style={{ color: '#64748b' }}>
                  No se encontraron productos
                </div>
              ) : (
                <div className="p-2">
                  <div className="flex flex-wrap gap-2">
                    {productosFiltrados.map(p => {
                      const isSelected = productosSeleccionados.find(ps => ps.producto_id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProducto(p.id)}
                          className="transition-all hover:scale-105"
                          style={{
                            padding: '8px 14px',
                            borderRadius: '20px',
                            border: isSelected ? '2px solid #14b8a6' : '1px solid #bae6fd',
                            background: isSelected ? '#dcfce7' : '#f0f9ff',
                            color: isSelected ? '#065f46' : '#0c4a6e',
                            fontWeight: isSelected ? '600' : '400',
                            fontSize: '13px',
                            cursor: 'pointer',
                            minHeight: 'auto'
                          }}
                        >
                          {isSelected && '✓ '}{p.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {productosSeleccionados.length === 0
                ? '⚠️ Seleccione al menos un producto'
                : `✅ ${productosSeleccionados.length} producto(s) seleccionado(s)`}
            </p>
          </div>

          <div className="flex gap-2 justify-center">
            <button type="submit" className="btn-primary" style={{ padding: '10px 24px', borderRadius: '8px' }}>
              {editando ? '💾 Actualizar Oferta' : '➕ Crear Oferta'}
            </button>
            {editando && (
              <button type="button" onClick={resetForm} className="btn-secondary" style={{ padding: '10px 24px', borderRadius: '8px' }}>
                ❌ Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {/* Banner para usuarios de solo lectura */}
      {isReadOnly && (
        <div className="mb-6 p-4 rounded-xl" style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
          border: '1px solid #7dd3fc'
        }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.5rem' }}>👁️</span>
            <div>
              <p className="font-semibold" style={{ color: '#0369a1' }}>Modo visualización</p>
              <p className="text-sm" style={{ color: '#0284c7' }}>Podés ver las ofertas activas pero no editarlas</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Ofertas */}
      <div className="card" style={{ background: 'var(--color-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
        <h2 className="text-lg font-bold mb-6 text-center" style={{ color: 'var(--color-text)' }}>
          🎁 {isReadOnly ? 'Ofertas Vigentes' : 'Ofertas Registradas'} ({ofertas.length})
        </h2>

        {ofertas.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎁</div>
            <p>{isReadOnly ? 'No hay ofertas activas en este momento.' : 'No hay ofertas registradas. Crea una para comenzar.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ordenar: activas vigentes primero, luego programadas, luego inactivas, luego vencidas */}
            {[...ofertas].sort((a, b) => {
              const hoy = new Date().toISOString().split('T')[0];
              const aVigente = a.desde <= hoy && a.hasta >= hoy;
              const bVigente = b.desde <= hoy && b.hasta >= hoy;
              const aVencida = a.hasta < hoy;
              const bVencida = b.hasta < hoy;

              // Activas vigentes primero
              if (a.activa && aVigente && !(b.activa && bVigente)) return -1;
              if (b.activa && bVigente && !(a.activa && aVigente)) return 1;
              // Luego programadas (activas pero no vigentes aún)
              if (a.activa && !aVencida && !(b.activa && !bVencida)) return -1;
              if (b.activa && !bVencida && !(a.activa && !aVencida)) return 1;
              // Vencidas al final
              if (aVencida && !bVencida) return 1;
              if (bVencida && !aVencida) return -1;
              return 0;
            }).map(oferta => {
              const productosConInfo = (oferta.productos || []).map(op => {
                const prod = productos.find(p => p.id === op.producto_id);
                return prod ? { ...prod, cantidad: op.cantidad } : null;
              }).filter(Boolean);

              const hoy = new Date().toISOString().split('T')[0];
              const vigente = oferta.desde <= hoy && oferta.hasta >= hoy;
              const vencida = oferta.hasta < hoy;

              return (
                <div key={oferta.id}
                  className="rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg"
                  style={{
                    background: 'var(--color-bg)',
                    border: oferta.activa && vigente
                      ? '3px solid #10b981'
                      : vencida
                        ? '2px solid var(--color-danger)'
                        : '1px solid var(--color-border)',
                    boxShadow: oferta.activa && vigente
                      ? '0 4px 20px rgba(16, 185, 129, 0.25)'
                      : '0 2px 8px rgba(14, 165, 233, 0.1)',
                    transform: oferta.activa && vigente ? 'scale(1.01)' : 'scale(1)'
                  }}>

                  {/* Header con gradiente mejorado */}
                  <div style={{
                    background: oferta.activa && vigente
                      ? 'linear-gradient(135deg, #dcfce7 0%, #a7f3d0 50%, #6ee7b7 100%)'
                      : vencida
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                        : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    padding: oferta.activa && vigente ? '18px 20px' : '14px 18px',
                    borderBottom: oferta.activa && vigente ? '2px solid #34d399' : '1px solid #bae6fd'
                  }}>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {oferta.activa && vigente && (
                          <span style={{ fontSize: '1.5rem', animation: 'pulse 2s infinite' }}>🔥</span>
                        )}
                        <h3 className="font-bold" style={{
                          fontSize: oferta.activa && vigente ? '1.25rem' : '1.125rem',
                          color: oferta.activa && vigente
                            ? '#047857'
                            : vencida
                              ? '#dc2626'
                              : '#0c4a6e'
                        }}>{oferta.titulo}</h3>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`badge ${oferta.activa && vigente ? 'badge-success' : vencida ? 'badge-danger' : 'badge-muted'}`}
                          style={oferta.activa && vigente ? {
                            background: '#059669',
                            color: 'white',
                            fontWeight: 'bold',
                            padding: '6px 12px'
                          } : {}}>
                          {vencida ? '⏰ Vencida' : vigente && oferta.activa ? '✨ ACTIVA' : oferta.activa ? '⏳ Programada' : '⏸ Inactiva'}
                        </span>

                        {/* Mostrar tipo y valor de oferta */}
                        {oferta.tipo === 'porcentaje' && (
                          <span className="font-bold" style={{
                            fontSize: oferta.activa && vigente ? '1.5rem' : '1.125rem',
                            color: oferta.activa && vigente ? '#059669' : '#14b8a6',
                            textShadow: oferta.activa && vigente ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                          }}>
                            {oferta.descuento_porcentaje || 0}% OFF
                          </span>
                        )}

                        {oferta.tipo === 'precio_cantidad' && (
                          <span className="font-bold" style={{
                            fontSize: oferta.activa && vigente ? '1.2rem' : '1rem',
                            color: oferta.activa && vigente ? '#059669' : '#14b8a6'
                          }}>
                            💰 Precio×Cant
                          </span>
                        )}

                        {oferta.tipo === 'nxm' && (
                          <span className="font-bold" style={{
                            fontSize: oferta.activa && vigente ? '1.3rem' : '1rem',
                            color: oferta.activa && vigente ? '#059669' : '#14b8a6'
                          }}>
                            {oferta.compra_cantidad}x{oferta.paga_cantidad}
                          </span>
                        )}

                        {oferta.tipo === 'regalo' && (
                          <span className="font-bold" style={{
                            fontSize: oferta.activa && vigente ? '1.3rem' : '1rem',
                            color: oferta.activa && vigente ? '#059669' : '#14b8a6'
                          }}>
                            🎁 Regalo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div style={{ padding: '16px', background: 'var(--color-bg)' }}>
                    {oferta.descripcion && (
                      <p className="text-sm mb-3" style={{ color: '#64748b' }}>
                        {oferta.descripcion}
                      </p>
                    )}

                    {/* Detalles según tipo de oferta */}
                    <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-primary)' }}>
                        {oferta.tipo === 'porcentaje' && '📊 Descuento por Porcentaje'}
                        {oferta.tipo === 'precio_cantidad' && '💰 Precio por Cantidad'}
                        {oferta.tipo === 'nxm' && '🎯 Oferta NxM'}
                        {oferta.tipo === 'regalo' && '🎁 Regalo con Compra'}
                      </div>

                      {oferta.tipo === 'porcentaje' && (
                        <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                          <strong>{oferta.descuento_porcentaje}%</strong> de descuento sobre el precio original
                        </div>
                      )}

                      {oferta.tipo === 'precio_cantidad' && oferta.reglas && (
                        <div className="text-sm space-y-1" style={{ color: 'var(--color-text)' }}>
                          {oferta.reglas.map((regla, idx) => (
                            <div key={idx}>
                              • Desde <strong>{regla.cantidad}</strong> unidades → <strong>${regla.precio_unitario}</strong> c/u
                            </div>
                          ))}
                        </div>
                      )}

                      {oferta.tipo === 'nxm' && (
                        <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                          Llevá <strong>{oferta.compra_cantidad}</strong> unidades, pagá solo <strong>{oferta.paga_cantidad}</strong>
                        </div>
                      )}

                      {oferta.tipo === 'regalo' && (
                        <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                          Regalo: <strong>{oferta.regalo_cantidad}×</strong> {productos.find(p => p.id === oferta.regalo_producto_id)?.nombre || 'Producto'}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 flex-wrap mb-4 text-sm" style={{ color: '#64748b' }}>
                      <span>📅 {oferta.desde} → {oferta.hasta}</span>
                    </div>

                    {/* Productos como chips */}
                    <div className="mb-4">
                      <p className="text-xs font-medium mb-2" style={{ color: '#64748b' }}>
                        {productosConInfo.length} producto(s):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {productosConInfo.map((p, i) => (
                          <span key={i}
                            onClick={() => navigate('/productos')}
                            className="text-xs px-2 py-1 rounded-md cursor-pointer hover:opacity-80"
                            style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                            title="Click para ver producto">
                            {p.cantidad}× {p.nombre}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Botones - solo para admin/oficina */}
                    {!isReadOnly && (
                      <div className="flex gap-2 flex-wrap pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <button
                          onClick={() => editarOferta(oferta)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          aria-label={`Editar oferta ${oferta.titulo}`}>
                          Editar
                        </button>
                        <button
                          onClick={() => toggleOferta(oferta)}
                          className={oferta.activa ? "btn-warning" : "btn-success"}
                          style={{ padding: '6px 12px', fontSize: '12px' }}>
                          {oferta.activa ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => confirmarEliminar(oferta)}
                          className="btn-danger"
                          style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={eliminarOferta}
        title="¿Eliminar oferta?"
        message={`¿Estás seguro de eliminar "${ofertaToDelete?.titulo}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
