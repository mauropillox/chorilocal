import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import authFetch, { authFetchJson } from '../authFetch';
import ConfirmDialog from './ConfirmDialog';
import { toast, toastSuccess } from '../toast';
import HelpBanner from './HelpBanner';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

export default function Ofertas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Vendedor and oficina users can only view offers, not edit
  const isReadOnly = user?.rol === 'vendedor' || user?.rol === 'oficina';
  const [ofertas, setOfertas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [descuento, setDescuento] = useState(10);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]); // [{producto_id, cantidad}]

  // Buscador de productos
  const [busqueda, setBusqueda] = useState('');

  // Edit mode
  const [editando, setEditando] = useState(null);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ofertaToDelete, setOfertaToDelete] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [ofertasRes, productosRes] = await Promise.all([
        authFetchJson(`${import.meta.env.VITE_API_URL}/ofertas`),
        authFetchJson(`${import.meta.env.VITE_API_URL}/productos`)
      ]);

      if (ofertasRes.res.ok) setOfertas(ofertasRes.data);
      if (productosRes.res.ok) setProductos(productosRes.data);
      toastSuccess('🎁 Ofertas y productos cargados correctamente');
    } catch (e) {
      logger.error('Error cargando datos:', e);
      toast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setDesde('');
    setHasta('');
    setDescuento(10);
    setProductosSeleccionados([]);
    setBusqueda('');
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo || !desde || !hasta || productosSeleccionados.length === 0) {
      toast('Complete todos los campos y seleccione al menos un producto', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('titulo', titulo);
      formData.append('descripcion', descripcion || '');
      formData.append('desde', desde);
      formData.append('hasta', hasta);
      formData.append('descuento_porcentaje', descuento);
      formData.append('productos', JSON.stringify(productosSeleccionados));

      const url = editando
        ? `${import.meta.env.VITE_API_URL}/ofertas/${editando}`
        : `${import.meta.env.VITE_API_URL}/ofertas`;

      const method = editando ? 'PUT' : 'POST';

      const res = await authFetch(url, { method, body: formData });

      if (res.ok) {
        toast(editando ? 'Oferta actualizada' : 'Oferta creada', 'success');
        resetForm();
        cargarDatos();
      } else {
        const errorData = await res.json().catch(() => ({}));
        logger.error('Error response:', errorData);
        toast('Error al guardar oferta: ' + (errorData.detail || 'Error desconocido'), 'error');
      }
    } catch (e) {
      logger.error('Error saving oferta:', e);
      toast('Error al guardar oferta', 'error');
    }
  };

  const editarOferta = (oferta) => {
    setEditando(oferta.id);
    setTitulo(oferta.titulo);
    setDescripcion(oferta.descripcion || '');
    setDesde(oferta.desde);
    setDescuento(oferta.descuento_porcentaje || 10);
    setHasta(oferta.hasta);
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
        toast('Oferta eliminada', 'success');
        cargarDatos();
      } else {
        toast('Error al eliminar oferta', 'error');
      }
    } catch (e) {
      logger.error('Error deleting oferta:', e);
      toast('Error al eliminar oferta', 'error');
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
          toast(`Oferta activada y fechas actualizadas: ${data.desde} - ${data.hasta}`, 'success');
        } else {
          toast(oferta.activa ? 'Oferta desactivada' : 'Oferta activada', 'success');
        }
        cargarDatos();
      } else {
        toast('Error al cambiar estado', 'error');
      }
    } catch (e) {
      logger.error('Error toggling oferta:', e);
      toast('Error al cambiar estado', 'error');
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
    return <div className="text-center p-8">Cargando...</div>;
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
            { label: 'Visualización', text: 'Los productos en oferta se marcan con 🎁 en el catálogo y muestran el precio original tachado junto al precio con descuento.' }
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

          <div className="form-group mb-4">
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>
              💰 Descuento (%) *
            </label>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={descuento}
              onChange={(e) => setDescuento(Number(e.target.value))}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              placeholder="Ej: 15"
            />
            <small style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
              Este descuento se aplicará automáticamente a los productos en pedidos
            </small>
          </div>

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
                        <span className="font-bold" style={{
                          fontSize: oferta.activa && vigente ? '1.5rem' : '1.125rem',
                          color: oferta.activa && vigente ? '#059669' : '#14b8a6',
                          textShadow: oferta.activa && vigente ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                        }}>
                          {oferta.descuento_porcentaje || 0}% OFF
                        </span>
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
                          style={{ padding: '6px 12px', fontSize: '12px' }}>
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
