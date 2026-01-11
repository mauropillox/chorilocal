import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authFetchJson, authFetch } from '../authFetch';
import { toast, toastSuccess, toastError } from '../toast';
import { CACHE_KEYS } from '../utils/queryClient';
import ConfirmDialog from './ConfirmDialog';
import HelpBanner from './HelpBanner';

export default function Templates() {
  const navigate = useNavigate();
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: CACHE_KEYS.templates,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/templates`);
      if (res.ok) toastSuccess('📋 Plantillas cargadas');
      return res.ok ? (data || []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: clientes = [] } = useQuery({
    queryKey: CACHE_KEYS.clientes,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`);
      // No toast - clientes are secondary data for Templates
      return res.ok ? (Array.isArray(data) ? data : (data.data || [])) : [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: productos = [] } = useQuery({
    queryKey: CACHE_KEYS.productos,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos`);
      return res.ok ? (Array.isArray(data) ? data : []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);

  // Form
  const [nombre, setNombre] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [frecuencia, setFrecuencia] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // Confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [confirmEjecutar, setConfirmEjecutar] = useState(null);

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return productos.slice(0, 50);
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    ).slice(0, 50);
  }, [productos, busqueda]);

  const resetForm = () => {
    setNombre('');
    setClienteId('');
    setFrecuencia('');
    setProductosSeleccionados([]);
    setBusqueda('');
    setEditando(null);
  };

  const toggleProducto = (productoId) => {
    setProductosSeleccionados(prev => {
      const existe = prev.find(p => p.producto_id === productoId);
      if (existe) {
        return prev.filter(p => p.producto_id !== productoId);
      }
      return [...prev, { producto_id: productoId, cantidad: 1, tipo: 'unidad' }];
    });
  };

  const cambiarCantidad = (productoId, delta) => {
    setProductosSeleccionados(prev =>
      prev.map(p => {
        if (p.producto_id === productoId) {
          const nuevaCantidad = Math.max(0.5, Math.round((p.cantidad + delta) * 2) / 2);
          return { ...p, cantidad: nuevaCantidad };
        }
        return p;
      })
    );
  };

  const setCantidadDirecta = (productoId, valor) => {
    const cantidad = Math.max(0.5, Math.round(parseFloat(valor || 0.5) * 2) / 2);
    setProductosSeleccionados(prev =>
      prev.map(p => p.producto_id === productoId ? { ...p, cantidad } : p)
    );
  };

  const cambiarTipo = (productoId, tipo) => {
    setProductosSeleccionados(prev =>
      prev.map(p => p.producto_id === productoId ? { ...p, tipo } : p)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toastError('El nombre es requerido');
      return;
    }
    if (productosSeleccionados.length === 0) {
      toastError('Selecciona al menos un producto');
      return;
    }

    try {
      const url = editando
        ? `${import.meta.env.VITE_API_URL}/templates/${editando}`
        : `${import.meta.env.VITE_API_URL}/templates`;

      const res = await authFetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          cliente_id: clienteId ? parseInt(clienteId) : null,
          frecuencia: frecuencia || null,
          productos: productosSeleccionados
        })
      });

      if (res.ok) {
        toastSuccess(editando ? '✅ Template actualizado' : '✅ Template creado');
        resetForm();
        refetchTemplates();
      } else {
        const err = await res.json();
        toastError(err.detail || 'Error');
      }
    } catch (e) {
      toastError('Error de conexión');
    }
  };

  const editarTemplate = async (template) => {
    try {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/templates/${template.id}`);
      if (res.ok) {
        setEditando(data.id);
        setNombre(data.nombre);
        setClienteId(data.cliente_id ? String(data.cliente_id) : '');
        setFrecuencia(data.frecuencia || '');
        setProductosSeleccionados(data.productos.map(p => ({
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          tipo: p.tipo
        })));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      toastError('Error cargando template');
    }
  };

  const confirmarEliminar = (template) => {
    setItemToDelete(template);
    setConfirmOpen(true);
  };

  const eliminarTemplate = async () => {
    if (!itemToDelete) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/templates/${itemToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toastSuccess('🗑️ Template eliminado');
        refetchTemplates();
      }
    } catch (e) {
      toastError('Error');
    } finally {
      setConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const ejecutarTemplate = async (template) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/templates/${template.id}/ejecutar`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        toastSuccess('✅ Pedido creado correctamente');
        navigate(`/pedidos?nuevo=${data.pedido_id}`);
      }
    } catch (e) {
      toastError('Error al crear pedido');
    } finally {
      setConfirmEjecutar(null);
    }
  };

  const productosSeleccionadosData = useMemo(() => {
    return productosSeleccionados.map(ps => {
      const prod = productos.find(p => p.id === ps.producto_id);
      return prod ? { ...prod, cantidad: ps.cantidad, tipo: ps.tipo } : null;
    }).filter(Boolean);
  }, [productos, productosSeleccionados]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-4xl animate-pulse">🔄</div>
        <p className="text-muted">Cargando templates...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--color-primary)' }}>
        🔄 Pedidos Recurrentes
      </h1>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo usar pedidos recurrentes?"
        icon="🔄"
        items={[
          { label: 'Qué es un template', text: 'Es una plantilla con productos predefinidos. Guardá combinaciones que pedís frecuentemente para crear pedidos con un solo click.' },
          { label: 'Crear template', text: 'Completá un nombre descriptivo (ej: "Pedido semanal Juan"), agregá los productos y cantidades que siempre se incluyen.' },
          { label: 'Usar template', text: 'Desde la lista de templates, clickeá "Usar" para crear un pedido nuevo con esos productos ya cargados. Podés ajustar antes de guardar.' },
          { label: 'Asignar a cliente', text: 'Podés vincular un template a un cliente específico. Cuando lo uses, se auto-selecciona ese cliente.' },
          { label: 'Editar o eliminar', text: 'Modificá los productos o cantidades en cualquier momento. Los pedidos creados anteriormente no se afectan.' }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="panel">
          <h2 className="font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
            {editando ? '✏️ Editar Template' : '➕ Nuevo Template'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Nombre del Template *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Pedido semanal Juan"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Cliente (opcional)
              </label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Sin cliente específico</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Frecuencia (referencia)
              </label>
              <select value={frecuencia} onChange={e => setFrecuencia(e.target.value)}>
                <option value="">Sin frecuencia</option>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            {/* Productos seleccionados */}
            {productosSeleccionadosData.length > 0 && (
              <div className="p-3 rounded-lg stat-card-success" style={{ textAlign: 'left' }}>
                <p className="text-sm font-medium mb-2">
                  ✅ Productos ({productosSeleccionadosData.length})
                </p>
                <div className="space-y-2">
                  {productosSeleccionadosData.map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded panel" style={{ flexWrap: 'wrap' }}>
                      <span className="flex-1 text-sm truncate" style={{ minWidth: '120px' }}>{p.nombre}</span>

                      {/* Controles de cantidad */}
                      <div className="flex items-center gap-1" style={{ background: 'var(--color-bg)', borderRadius: '8px', padding: '2px' }}>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(p.id, -0.5)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', minHeight: 'auto', fontSize: '16px', fontWeight: 'bold' }}
                          disabled={p.cantidad <= 0.5}
                          title="Disminuir 0.5"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={p.cantidad}
                          onChange={e => setCantidadDirecta(p.id, e.target.value)}
                          style={{ width: '55px', padding: '4px', fontSize: '13px', textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(p.id, 0.5)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', minHeight: 'auto', fontSize: '16px', fontWeight: 'bold' }}
                          title="Aumentar 0.5"
                        >
                          +
                        </button>
                      </div>

                      {/* Selector de tipo */}
                      <select
                        value={p.tipo}
                        onChange={e => cambiarTipo(p.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto', width: 'auto' }}
                      >
                        <option value="unidad">📦 Unidad</option>
                        <option value="caja">📤 Caja</option>
                        <option value="tira">📏 Tira</option>
                        <option value="gancho">🪝 Gancho</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => toggleProducto(p.id)}
                        className="btn-danger text-xs px-2 py-1"
                        style={{ minHeight: 'auto' }}
                        title="Quitar producto"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buscador de productos */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Agregar Productos
              </label>
              <p className="text-xs mb-2 text-muted">
                💡 Clickea los productos que quieras incluir en este template
              </p>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="🔍 Buscar producto..."
              />
              <div
                className="mt-2 rounded-lg panel"
                style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}
              >
                <div className="p-2 flex flex-wrap gap-2">
                  {productosFiltrados.map(p => {
                    const isSelected = productosSeleccionados.find(ps => ps.producto_id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProducto(p.id)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-all product-pill ${isSelected ? 'selected' : ''}`}
                        title={isSelected ? 'Click para quitar' : 'Click para agregar'}
                      >
                        {isSelected ? '✓ ' : '+ '}{p.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                {editando ? '💾 Guardar' : '➕ Crear Template'}
              </button>
              {editando && (
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista de templates */}
        <div className="panel">
          <h2 className="font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
            📋 Templates Guardados ({templates.length})
          </h2>

          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="text-4xl mb-2">📋</div>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No hay templates guardados</p>
              <p className="text-xs mt-1">Crea templates para agilizar pedidos frecuentes y recurrentes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="p-4 template-item"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--color-primary)' }}>{template.nombre}</h3>
                      <div className="text-xs space-x-2 text-muted">
                        {template.cliente_nombre && <span>👤 {template.cliente_nombre}</span>}
                        {template.frecuencia && <span>🔄 {template.frecuencia}</span>}
                        <span>📦 {template.productos_count} {template.productos_count === 1 ? 'producto' : 'productos'}</span>
                      </div>
                      {template.ultima_ejecucion && (
                        <div className="text-xs mt-1 text-muted">
                          Último uso: {template.ultima_ejecucion}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap mt-3">
                    <button
                      onClick={() => setConfirmEjecutar(template)}
                      className="btn-success text-xs px-3 py-1.5"
                      style={{ minHeight: 'auto' }}
                      title="Crear un pedido usando este template"
                    >
                      ▶️ Crear Pedido
                    </button>
                    <button
                      onClick={() => editarTemplate(template)}
                      className="btn-secondary text-xs px-3 py-1.5"
                      style={{ minHeight: 'auto' }}
                      aria-label={`Editar template ${template.nombre}`}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => confirmarEliminar(template)}
                      className="btn-danger text-xs px-3 py-1.5"
                      style={{ minHeight: 'auto' }}
                    >
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tip: Repetir último pedido */}
      <div className="card p-4 mt-6" style={{ background: 'linear-gradient(135deg, #e0f2fe, #ccfbf1)', border: '1px solid #14b8a6' }}>
        <h3 className="font-bold mb-2" style={{ color: '#0c4a6e' }}>💡 Tip: Repetir Último Pedido</h3>
        <p className="text-sm" style={{ color: '#64748b' }}>
          También puedes repetir el último pedido de un cliente directamente desde la pantalla de Pedidos.
          Solo selecciona el cliente y usa el botón "Repetir último pedido".
        </p>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={eliminarTemplate}
        title="¿Eliminar template?"
        message={`¿Estás seguro de eliminar "${itemToDelete?.nombre}"?`}
      />

      <ConfirmDialog
        open={!!confirmEjecutar}
        onClose={() => setConfirmEjecutar(null)}
        onConfirm={() => ejecutarTemplate(confirmEjecutar)}
        title="Crear pedido desde template"
        message={`¿Crear un nuevo pedido usando el template "${confirmEjecutar?.nombre}"?`}
      />
    </div>
  );
}
