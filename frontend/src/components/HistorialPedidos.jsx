import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { authFetch, authFetchJson } from '../authFetch';
import { toastSuccess, toastError, toastWarn } from '../toast';
import ConfirmDialog from './ConfirmDialog';
import { getSelectStyles } from '../selectStyles';
import HelpBanner from './HelpBanner';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

export default function HistorialPedidos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  // Role-based access: admin/oficina can filter by user, ventas only see their own
  const isAdmin = user?.rol === 'admin' || user?.rol === 'administrador';
  const isOficina = user?.rol === 'oficina';
  const canFilterByUser = isAdmin || isOficina; // admin and oficina can filter by user

  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [assigningClient, setAssigningClient] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [editandoPedido, setEditandoPedido] = useState(null);
  const [editandoNotas, setEditandoNotas] = useState(null);
  const [notasTemp, setNotasTemp] = useState('');
  const [nuevoItem, setNuevoItem] = useState({ producto_id: '', cantidad: '1', tipo: 'unidad' });
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [activeTab, setActiveTab] = useState('pendientes'); // 'pendientes' o 'generados'
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [stockPreview, setStockPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [undoDelete, setUndoDelete] = useState(null); // { pedido, timeout }
  const [recentProductos, setRecentProductos] = useState([]);
  const [filtroAntiguos, setFiltroAntiguos] = useState(false); // Filtrar pedidos +24h
  const [filtroPedidoId, setFiltroPedidoId] = useState(null); // Filtrar por ID específico
  const [filtroCreador, setFiltroCreador] = useState(''); // Filtrar por usuario creador
  const [creadores, setCreadores] = useState([]); // Lista de usuarios que crearon pedidos

  // Función para restaurar pedido eliminado (undo)
  const restaurarPedido = async () => {
    if (!undoDelete?.pedido) return;
    const pedido = undoDelete.pedido;

    // Clear the timeout
    if (undoDelete.timeout) clearTimeout(undoDelete.timeout);
    setUndoDelete(null);

    try {
      // Recrear el pedido en el backend
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: { id: pedido.cliente_id },
          productos: pedido.productos.map(p => ({
            id: p.producto_id || p.id,
            nombre: p.nombre || p.nome || 'Producto',
            precio: p.precio || 0,
            cantidad: p.cantidad,
            tipo: p.tipo || 'unidad'
          })),
          notas: pedido.notas || ''
        })
      });

      if (res.ok) {
        await cargarDatos();
        toastSuccess('Pedido restaurado correctamente');
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al restaurar pedido');
      }
    } catch (e) {
      logger.error('Error restaurando pedido:', e);
      toastError('Error de conexión al restaurar pedido');
    }
  };

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    try {
      const saved = localStorage.getItem('historial_itemsPerPage');
      return saved ? parseInt(saved) : 25;
    } catch (e) { return 25; }
  });

  // Persist items per page
  useEffect(() => {
    localStorage.setItem('historial_itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  useEffect(() => {
    cargarDatos();
    // Load recent productos
    try {
      const recent = JSON.parse(localStorage.getItem('recent_productos') || '[]');
      setRecentProductos(recent);
    } catch (e) { setRecentProductos([]); }
  }, []);

  // Handle URL search params (for deep linking from dashboard)
  useEffect(() => {
    const antiguosParam = searchParams.get('antiguos');
    const pedidoIdParam = searchParams.get('pedidoId');

    if (antiguosParam === '1') {
      setFiltroAntiguos(true);
      setActiveTab('pendientes');
      setSearchParams({});
    }
    if (pedidoIdParam) {
      setFiltroPedidoId(parseInt(pedidoIdParam));
      setActiveTab('pendientes');
      setSearchParams({});
    }
  }, [searchParams]);

  // Ordenar pedidos: más nuevos primero (ID descendente)
  const pedidosOrdenados = useMemo(() => {
    return [...pedidos].sort((a, b) => b.id - a.id);
  }, [pedidos]);

  // Filtrado por estado
  const pendientes = useMemo(() => {
    return pedidosOrdenados.filter(p => !p.pdf_generado);
  }, [pedidosOrdenados]);

  const generados = useMemo(() => {
    return pedidosOrdenados.filter(p => p.pdf_generado);
  }, [pedidosOrdenados]);

  // Datos según tab activo
  const datosActuales = activeTab === 'pendientes' ? pendientes : generados;

  // Filtrado de búsqueda
  const coincideTexto = useCallback((p) => {
    const q = busquedaTexto.trim().toLowerCase();
    if (!q) return true;
    const cliente = clientes.find(c => c.id === p.cliente_id);
    const clienteNombre = (cliente?.nombre || '').toLowerCase();
    const productosStr = (p.productos || []).map(x => x.nombre.toLowerCase()).join(' ');
    return clienteNombre.includes(q) || productosStr.includes(q);
  }, [busquedaTexto, clientes]);

  // Filtro de pedidos antiguos (+24 horas)
  const esAntiguo = useCallback((p) => {
    if (!filtroAntiguos) return true;
    const fecha = new Date(p.fecha_creacion || p.fecha);
    const ahora = new Date();
    const diffHoras = (ahora - fecha) / (1000 * 60 * 60);
    return diffHoras >= 24;
  }, [filtroAntiguos]);

  // Filtro por ID específico
  const coincideId = useCallback((p) => {
    if (!filtroPedidoId) return true;
    return p.id === filtroPedidoId;
  }, [filtroPedidoId]);

  // Filtro por usuario creador (solo para admin/oficina)
  const coincideCreador = useCallback((p) => {
    if (!filtroCreador) return true;
    return (p.creado_por || '') === filtroCreador;
  }, [filtroCreador]);

  const datosFiltrados = useMemo(() => {
    return datosActuales.filter(p => coincideTexto(p) && esAntiguo(p) && coincideId(p) && coincideCreador(p));
  }, [datosActuales, coincideTexto, esAntiguo, coincideId, coincideCreador]);

  // Paginación
  const totalPages = Math.ceil(datosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const datosPaginados = useMemo(() => {
    return datosFiltrados.slice(startIndex, endIndex);
  }, [datosFiltrados, startIndex, endIndex]);

  // Reset a página 1 cuando cambia tab, búsqueda o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, busquedaTexto, filtroCreador]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a' && activeTab === 'pendientes' && pendientes.length > 0) {
          e.preventDefault();
          setSelectedIds(datosPaginados.map(p => p.id));
          toastSuccess('Página seleccionada');
        }
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setStockPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [activeTab, datosPaginados]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [pedRes, cliRes, prodRes] = await Promise.all([
        authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos`),
        authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`),
        authFetchJson(`${import.meta.env.VITE_API_URL}/productos?lite=true`)  // No images for faster load
      ]);

      if (pedRes.res.ok) setPedidos(Array.isArray(pedRes.data) ? pedRes.data : []);
      // Handle paginated response from clientes
      if (cliRes.res.ok) {
        const cliData = cliRes.data;
        if (cliData.data) setClientes(cliData.data);
        else setClientes(Array.isArray(cliData) ? cliData : []);
      }
      if (prodRes.res.ok) setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);

      // Load creators list for filter (only for admin/oficina)
      if (canFilterByUser) {
        try {
          const creatorsRes = await authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos/creators`);
          if (creatorsRes.res.ok) setCreadores(Array.isArray(creatorsRes.data) ? creatorsRes.data : []);
        } catch (e) { logger.error('Error loading creators:', e); }
      }

      // Show success toast only on initial load
      if (!pedidos.length) {
        toastSuccess('📜 Historial cargado');
      }
    } catch (e) { logger.error('Error cargando datos:', e); }
    finally { setLoading(false); }
  };

  const exportarCSV = async () => {
    let url = `${import.meta.env.VITE_API_URL}/pedidos/export/csv`;
    const params = [];
    if (filtroFechaDesde) params.push(`desde=${filtroFechaDesde}`);
    if (filtroFechaHasta) params.push(`hasta=${filtroFechaHasta}`);
    if (params.length) url += '?' + params.join('&');

    const res = await authFetch(url);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = 'pedidos.csv';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(blobUrl);
    }
  };

  const asignarCliente = async (pedidoId, clienteId) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/cliente?cliente_id=${clienteId}`, {
        method: 'PUT'
      });

      if (res.ok) {
        await cargarDatos();
        setAssigningClient(null);
        toastSuccess('Cliente asignado');
      } else {
        toastError('Error al asignar cliente');
      }
    } catch (err) {
      toastError('Error de conexión al asignar cliente');
    }
  };

  const actualizarNotas = async (pedidoId) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/notas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: notasTemp })
      });

      if (res.ok) {
        await cargarDatos();
        setEditandoNotas(null);
        setNotasTemp('');
        toastSuccess('Notas actualizadas');
      } else {
        toastError('Error al actualizar notas');
      }
    } catch (err) {
      toastError('Error de conexión al actualizar notas');
    }
  };

  const eliminarPedido = async (pedidoId) => {
    setConfirmDelete(null);
    setEliminando(pedidoId);

    // Guardar copia del pedido para poder restaurarlo
    const pedidoToDelete = pedidos.find(p => p.id === pedidoId);

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await cargarDatos();
        setSelectedIds(prev => prev.filter(id => id !== pedidoId));

        // Configurar undo con timeout de 10 segundos
        if (pedidoToDelete) {
          // Limpiar timeout anterior si existe
          if (undoDelete?.timeout) clearTimeout(undoDelete.timeout);

          const timeout = setTimeout(() => {
            setUndoDelete(null);
          }, 10000);

          setUndoDelete({ pedido: pedidoToDelete, timeout });
        }

        toastSuccess('Pedido eliminado. Puedes restaurarlo en los próximos 10 segundos.');
      } else {
        toastError('Error al eliminar pedido');
      }
    } catch (err) {
      toastError('Error de conexión al eliminar pedido');
    }
    setEliminando(null);
  };

  const previewStockChanges = async () => {
    if (selectedIds.length === 0) return toastWarn('Debes seleccionar al menos un pedido');
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/preview_stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_ids: selectedIds })
      });
      if (res.ok) {
        const data = await res.json();
        setStockPreview(data);
        if (data.warnings.length === 0) {
          toastSuccess('Stock suficiente para todos los pedidos');
        }
      } else {
        toastError('Error al verificar stock');
      }
    } catch (err) {
      toastError('Error de conexión al verificar stock');
    }
  };

  const guardarItem = async (pedidoId, productoId, cantidad, tipo) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/items/${productoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: productoId, cantidad: parseFloat(cantidad) || 0, tipo })
      });
      if (res.ok) { await cargarDatos(); toastSuccess('Ítem actualizado'); } else toastError('Error al actualizar ítem');
    } catch (err) { alert('Error de conexión al actualizar ítem'); }
  };

  const eliminarItem = async (pedidoId, productoId) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/items/${productoId}`, { method: 'DELETE' });
      if (res.ok) { await cargarDatos(); toastSuccess('Ítem eliminado'); } else toastError('Error al eliminar ítem');
    } catch (err) { alert('Error de conexión al eliminar ítem'); }
  };

  const agregarItem = async (pedidoId) => {
    if (!nuevoItem.producto_id) return toastWarn('Selecciona un producto');
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: parseInt(nuevoItem.producto_id), cantidad: parseFloat(nuevoItem.cantidad) || 1, tipo: nuevoItem.tipo })
      });
      if (res.ok) { setNuevoItem({ producto_id: '', cantidad: '1', tipo: 'unidad' }); await cargarDatos(); toastSuccess('Producto agregado al pedido'); }
      else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail?.detail || err.detail || 'Error al agregar producto');
      }
    } catch (err) { toastError('Error de conexión al agregar producto'); }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const generarPDFs = async () => {
    if (selectedIds.length === 0) return toastWarn('Debes seleccionar al menos un pedido');
    setGenerando(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/generar_pdfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_ids: selectedIds })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al generar PDF');
        setGenerando(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Get filename from Content-Disposition header or use default
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename=(.+)/);
      a.download = filenameMatch ? filenameMatch[1] : `pedidos_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSelectedIds([]);
      await cargarDatos(); // Reload to show updated status
      setActiveTab('generados'); // Cambiar a tab de generados
      toastSuccess('PDF generado correctamente');
    } catch (err) {
      toastError('Error al generar PDF: ' + err.message);
    }
    setGenerando(false);
  };

  const clientesOptions = clientes.map(c => ({
    value: c.id,
    label: `${c.nombre} - ${c.barrio || 'Sin barrio'}`
  }));

  const customSelectStyles = getSelectStyles();

  // Limpiar todos los filtros especiales
  const limpiarFiltrosEspeciales = () => {
    setFiltroAntiguos(false);
    setFiltroPedidoId(null);
    setSearchParams({});
  };

  return (
    <div style={{ color: 'var(--color-text)' }}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
          📋 Historial de Pedidos
        </h2>
        <button onClick={exportarCSV} className="btn-secondary">📥 Exportar CSV</button>
      </div>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo usar el Historial?"
        icon="📋"
        items={[
          { label: 'Pendientes', text: 'Pedidos que aún no tienen PDF generado. Acá podés editar productos y cantidades.' },
          { label: 'Generados', text: 'Pedidos con PDF generado, listos para imprimir y entregar.' },
          { label: 'Generar PDF', text: 'Marcá varios pedidos con el checkbox y clickeá "📄 Generar PDFs" para crear los remitos.' },
          { label: 'Buscar rápido', text: 'Usá la barra de búsqueda para filtrar por cliente o producto.' }
        ]}
      />

      {/* Banner de filtros activos desde Dashboard */}
      {(filtroAntiguos || filtroPedidoId) && (
        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg"
          style={{ backgroundColor: 'var(--color-warning-bg, #fef3cd)', border: '1px solid var(--color-warning, #ffc107)' }}>
          <span style={{ color: 'var(--color-text)' }}>
            🔍 Filtro activo: {filtroAntiguos && '⏰ Pedidos pendientes +24h'}{filtroPedidoId && `📋 Pedido #${filtroPedidoId}`}
          </span>
          <button
            onClick={limpiarFiltrosEspeciales}
            className="btn-ghost"
            style={{ marginLeft: 'auto', padding: '4px 12px', minHeight: 'auto' }}
          >
            ✕ Quitar filtro
          </button>
        </div>
      )}

      {/* Filters - responsive grid simplificado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 historial-filters">
        <div className="form-group">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>📅 Desde</label>
          <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)}
            className="text-sm p-2 border rounded w-full" />
        </div>
        <div className="form-group">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>📅 Hasta</label>
          <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)}
            className="text-sm p-2 border rounded w-full" />
        </div>
        <div className="form-group">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>🔍 Buscar</label>
          <input type="text" value={busquedaTexto} onChange={e => setBusquedaTexto(e.target.value)}
            className="text-sm p-2 border rounded w-full" placeholder="Cliente o producto..." />
        </div>
      </div>

      {/* Filtro por usuario creador - solo visible para admin/oficina */}
      {canFilterByUser && creadores.length > 0 && (
        <div className="mb-4">
          <select
            value={filtroCreador}
            onChange={e => setFiltroCreador(e.target.value)}
            className="text-sm p-2 border rounded"
            style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minWidth: '200px' }}
          >
            <option value="">👤 Todos los usuarios</option>
            {creadores.map(c => (
              <option key={c} value={c}>👤 {c}</option>
            ))}
          </select>
          {filtroCreador && (
            <button
              onClick={() => setFiltroCreador('')}
              className="btn-ghost ml-2"
              style={{ padding: '4px 8px', minHeight: 'auto' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Tabs para Pendientes y Generados */}
      <div className="historial-tabs" style={{ borderRadius: '6px', overflow: 'hidden' }}>
        <button
          onClick={() => setActiveTab('pendientes')}
          className={`historial-tab ${activeTab === 'pendientes' ? 'btn-warning active' : 'btn-ghost'}`}
        >
          ⏳ Pendientes ({pendientes.length})
        </button>
        <button
          onClick={() => setActiveTab('generados')}
          className={`historial-tab ${activeTab === 'generados' ? 'btn-success active' : 'btn-ghost'}`}
        >
          ✅ Generados ({generados.length})
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">Cargando pedidos...</div>
        </div>
      ) : (
        <>
          {/* Action bar with badges and buttons */}
          <div className="action-bar historial-action-bar">
            <span className="badge badge-warning">⏳ Pendientes: {pendientes.length}</span>
            <span className="badge badge-success">✅ Generados: {generados.length}</span>

            <div className="flex-1" />

            {activeTab === 'pendientes' && datosFiltrados.length > 0 && (
              <>
                <button
                  onClick={() => setSelectedIds(datosPaginados.map(p => p.id))}
                  className="btn-ghost"
                  style={{ minHeight: '36px', padding: '6px 12px' }}
                >
                  ✓ Seleccionar página
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  disabled={selectedIds.length === 0}
                  className="btn-ghost"
                  style={{ minHeight: '36px', padding: '6px 12px' }}
                >
                  ✕ Limpiar
                </button>
              </>
            )}

            <button
              onClick={previewStockChanges}
              disabled={selectedIds.length === 0}
              className="btn-secondary"
            >
              � Verificar Stock ({selectedIds.length})
            </button>
            <button
              onClick={generarPDFs}
              disabled={selectedIds.length === 0 || generando}
              className="btn-success generar-pdfs-btn"
              style={{ fontWeight: 700 }}
            >
              {generando ? '⏳ Generando...' : `📄 Generar PDFs (${selectedIds.length})`}
            </button>
          </div>

          {/* Contenido de la tab activa */}
          {datosFiltrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">
                {busquedaTexto ? 'No se encontraron resultados' : `No hay ${activeTab === 'pendientes' ? 'pedidos pendientes' : 'pedidos generados'}`}
              </div>
            </div>
          ) : (
            <>
              {/* Paginación superior */}
              <div className="historial-pagination" style={{ background: 'var(--color-border-light)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    Mostrando {startIndex + 1} - {Math.min(endIndex, datosFiltrados.length)} de {datosFiltrados.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ver:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="px-2 py-1 text-sm rounded border"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minWidth: '70px' }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={99999}>Todos</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn-ghost px-3 py-1"
                    style={{ minHeight: 'auto' }}
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm">
                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-ghost px-3 py-1"
                    style={{ minHeight: 'auto' }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>

              {/* Lista de pedidos paginados */}
              <div className="space-y-3">
                {datosPaginados.map(p => {
                  const cliente = clientes.find(c => c.id === p.cliente_id);
                  const sinCliente = !cliente;

                  return (
                    <div
                      key={p?.id}
                      className="card-item"
                      style={{
                        ...(sinCliente ? { border: '2px solid var(--color-warning)', background: 'var(--color-bg-warning-subtle)' } : {}),
                        ...(selectedIds.includes(p?.id) ? { border: '2px solid var(--color-primary)', background: 'var(--color-bg-secondary)' } : {})
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p?.id)}
                          onChange={() => toggleSelection(p?.id)}
                          className="mt-1 custom-checkbox"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                              Pedido #{p?.id}
                            </span>
                            {p.pdf_generado ? (
                              <span className="badge badge-success">✅ Generado</span>
                            ) : (
                              <span className="badge badge-pending">⏳ Pendiente</span>
                            )}
                            {p.repartidor && (
                              <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #6366f1' }}>
                                🚚 {p.repartidor}
                              </span>
                            )}
                            {sinCliente && (
                              <span className="badge badge-danger">
                                ⚠️ Sin cliente
                              </span>
                            )}
                          </div>

                          {sinCliente ? (
                            assigningClient === p.id ? (
                              <div className="highlight-warning mt-2">
                                <div className="text-xs mb-1 font-semibold" style={{ color: 'var(--color-warning)' }}>Asignar cliente:</div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <Select
                                      options={clientesOptions}
                                      onChange={(opt) => asignarCliente(p.id, opt.value)}
                                      placeholder="Seleccionar cliente..."
                                      styles={customSelectStyles}
                                      isSearchable
                                    />
                                  </div>
                                  <button
                                    onClick={() => setAssigningClient(null)}
                                    className="btn-secondary"
                                    style={{ minHeight: '36px', padding: '0 12px' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssigningClient(p.id)}
                                className="btn-secondary mt-2"
                                style={{ fontSize: '0.875rem', padding: '6px 12px' }}
                              >
                                👤 Asignar cliente
                              </button>
                            )
                          ) : (
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                              <strong>Cliente:</strong> {cliente?.nombre || 'Desconocido'}
                            </div>
                          )}

                          <div className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            <strong>Fecha:</strong> {p.fecha_creacion ? p.fecha_creacion : new Date(p?.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {' • '}
                            <strong>Productos:</strong> {p?.productos?.length || 0}
                          </div>

                          {/* Alerta de pedido antiguo (> 24 horas pendiente) - muestra fecha/hora exacta */}
                          {!p.pdf_generado && p.fecha_creacion && (() => {
                            const fechaCreacion = p.fecha_creacion;
                            const horasTranscurridas = (Date.now() - new Date(p.fecha).getTime()) / (1000 * 60 * 60);
                            if (horasTranscurridas > 24) {
                              return (
                                <div className="text-xs mt-2 p-2 rounded flex items-center gap-2" style={{
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626'
                                }}>
                                  ⚠️ <strong>Creado el {fechaCreacion}</strong> - Sin generar PDF
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Información de tracking */}
                          <div className="text-xs mt-2 p-2 rounded" style={{
                            background: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)'
                          }}>
                            <div className="grid grid-cols-1 gap-1">
                              {p.fecha_creacion && (
                                <div>📅 <strong>Creado:</strong> {p.fecha_creacion} {p.creado_por && <span className="ml-1">por <strong>{p.creado_por}</strong></span>}</div>
                              )}
                              {p.pdf_generado && p.fecha_generacion && (
                                <div>📄 <strong>Generado:</strong> {p.fecha_generacion} {p.generado_por && <span className="ml-1">por <strong>{p.generado_por}</strong></span>}</div>
                              )}
                              {p.ultimo_editor && p.fecha_ultima_edicion && (
                                <div>✏️ <strong>Editado:</strong> {p.fecha_ultima_edicion} por <strong>{p.ultimo_editor}</strong></div>
                              )}
                              {p.dispositivo && (
                                <div>📱 <strong>Desde:</strong> {p.dispositivo === 'mobile' ? '📱 Móvil' : p.dispositivo === 'tablet' ? '📱 Tablet' : '💻 Web'}</div>
                              )}

                              {/* Notas - Editable */}
                              {editandoNotas === p.id ? (
                                <div className="mt-2 flex gap-2">
                                  <input
                                    type="text"
                                    value={notasTemp}
                                    onChange={(e) => setNotasTemp(e.target.value)}
                                    placeholder="Agregar nota..."
                                    className="flex-1 text-xs p-2 border rounded"
                                    style={{ minHeight: 'auto' }}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && actualizarNotas(p.id)}
                                  />
                                  <button onClick={() => actualizarNotas(p.id)} className="btn-primary text-xs px-2 py-1" style={{ minHeight: 'auto' }} aria-label="Guardar notas">💾</button>
                                  <button onClick={() => { setEditandoNotas(null); setNotasTemp(''); }} className="btn-secondary text-xs px-2 py-1" style={{ minHeight: 'auto' }} aria-label="Cancelar edición de notas">✕</button>
                                </div>
                              ) : (
                                <div className="mt-1 flex items-center gap-2">
                                  {p.notas ? (
                                    <span>📝 <em>{p.notas}</em></span>
                                  ) : (
                                    <span style={{ opacity: 0.5 }}>📝 Sin notas</span>
                                  )}
                                  <button
                                    onClick={() => { setEditandoNotas(p.id); setNotasTemp(p.notas || ''); }}
                                    className="text-xs px-2 py-1"
                                    style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', minHeight: 'auto' }}
                                  >
                                    ✏️
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Lista compacta de productos */}
                          {p?.productos && p.productos.length > 0 && (
                            <div className="mt-2 p-2 rounded order-products-list" style={{
                              background: 'var(--color-border-light)',
                              border: '1px solid var(--color-border)'
                            }}>
                              <div className="space-y-1">
                                {p.productos.map((item, idx) => (
                                  <div key={idx} className="text-xs" style={{
                                    color: 'var(--color-text-secondary)',
                                    wordWrap: 'break-word',
                                    lineHeight: '1.4'
                                  }}>
                                    <strong>{item.nombre}</strong> × {item.cantidad} {item.tipo === 'caja' ? 'caja' : item.tipo === 'kg' ? 'kg' : 'u'} — ${item.precio || 0}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Editar productos del pedido pendiente */}
                          {editandoPedido === p.id ? (
                            <div className="highlight-info mt-3 historial-edit-form">
                              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>Editar productos:</div>
                              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {p.productos.map(item => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    <span className="flex-1 text-sm truncate">{item.nombre}</span>
                                    <input type="number" step="0.5" min="0" defaultValue={item.cantidad}
                                      onBlur={(e) => guardarItem(p.id, item.id, e.target.value, item.tipo)}
                                      className="w-16 p-1 text-sm border rounded" />
                                    <select defaultValue={item.tipo} onChange={(e) => guardarItem(p.id, item.id, item.cantidad, e.target.value)}
                                      className="p-1 text-sm border rounded">
                                      <option value="unidad">U</option>
                                      <option value="kg">Kg</option>
                                      <option value="caja">C</option>
                                      <option value="gancho">G</option>
                                      <option value="tira">T</option>
                                    </select>
                                    <button onClick={() => eliminarItem(p.id, item.id)} className="btn-danger text-xs px-2 py-1" aria-label={`Eliminar ${item.nombre} del pedido`}>✕</button>
                                  </div>
                                ))}
                              </div>
                              <div className="historial-add-item">
                                <select value={nuevoItem.producto_id} onChange={e => setNuevoItem({ ...nuevoItem, producto_id: e.target.value })}
                                  className="flex-1 p-2 border rounded text-sm">
                                  <option value="">+ Producto...</option>
                                  {productos.map(pr => (
                                    <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                                  ))}
                                </select>
                                <input type="number" step="0.5" min="0.5" value={nuevoItem.cantidad}
                                  onChange={e => setNuevoItem({ ...nuevoItem, cantidad: e.target.value })}
                                  className="w-20 p-2 border rounded text-sm" />
                                <select value={nuevoItem.tipo} onChange={e => setNuevoItem({ ...nuevoItem, tipo: e.target.value })}
                                  className="p-2 border rounded text-sm">
                                  <option value="unidad">Unidad</option>
                                  <option value="kg">Kilo</option>
                                  <option value="caja">Caja</option>
                                  <option value="gancho">Gancho</option>
                                  <option value="tira">Tira</option>
                                </select>
                                <button onClick={() => agregarItem(p.id)} className="btn-primary text-sm px-3 py-2" aria-label="Agregar producto al pedido">➕ Agregar</button>
                                <button onClick={() => setEditandoPedido(null)} className="btn-secondary text-sm px-3 py-2">Listo</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setEditandoPedido(p.id)} className="btn-secondary mt-2" style={{ fontSize: '0.875rem', padding: '6px 12px' }}>
                              ✏️ Editar productos
                            </button>
                          )}

                          <button
                            onClick={() => setConfirmDelete(p.id)}
                            disabled={eliminando === p.id}
                            className="btn-danger mt-2"
                            style={{ fontSize: '0.875rem', padding: '6px 12px' }}
                          >
                            {eliminando === p.id ? '⏳ Eliminando...' : '🗑️ Eliminar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación inferior */}
              <div className="historial-pagination" style={{ background: 'var(--color-border-light)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm">Mostrando {startIndex + 1} - {Math.min(endIndex, datosFiltrados.length)} de {datosFiltrados.length}</span>
                  <div className="flex items-center gap-1">
                    <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ver:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="px-2 py-1 text-sm rounded border"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minWidth: '70px' }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={99999}>Todos</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn-ghost px-3 py-1 text-sm"
                    style={{ minHeight: 'auto' }}
                  >
                    ← Anterior
                  </button>
                  <select
                    value={currentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                    className="px-2 py-1 border rounded text-sm"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minWidth: '90px' }}
                  >
                    {Array.from({ length: totalPages }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Página {i + 1}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-ghost px-3 py-1 text-sm"
                    style={{ minHeight: 'auto' }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </>
          )}

          {pedidos.length === 0 && (
            <div className="empty-state-large">
              <div className="empty-state-icon-large">📋</div>
              <div className="empty-state-title">No hay pedidos aún</div>
              <div className="empty-state-subtitle">
                Los pedidos que crees aparecerán aquí organizados por estado
              </div>
              <a href="/pedidos" className="btn-primary mt-4" style={{ display: 'inline-block', textDecoration: 'none' }}>
                ➕ Crear primer pedido
              </a>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar pedido"
        message="¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer."
        onConfirm={() => eliminarPedido(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {stockPreview && (
        <div className="modal-backdrop" onClick={() => setStockPreview(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="text-lg font-semibold mb-3">Preview: Cambios de Stock</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Se procesarán {stockPreview.pedidos_count} pedidos
            </p>

            {stockPreview.warnings.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border-2 border-orange-400 rounded">
                <div className="font-semibold text-orange-700 mb-2">⚠️ Advertencias de Stock:</div>
                {stockPreview.warnings.map((w, i) => (
                  <div key={i} className="text-sm text-orange-600">{w.mensaje}</div>
                ))}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto custom-scrollbar mb-4">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Producto</th>
                    <th className="text-center p-2">Actual</th>
                    <th className="text-center p-2">Restar</th>
                    <th className="text-center p-2">Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {stockPreview.stock_changes.map((sc, i) => (
                    <tr key={i} className={sc.stock_nuevo === 0 ? 'bg-orange-50' : ''}>
                      <td className="p-2 truncate">{sc.nombre}</td>
                      <td className="text-center p-2">{sc.stock_actual}</td>
                      <td className="text-center p-2">-{sc.cantidad_a_restar}</td>
                      <td className="text-center p-2 font-semibold" style={{ color: sc.stock_nuevo === 0 ? '#ea580c' : '#0d9488' }}>
                        {sc.stock_nuevo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setStockPreview(null)} className="btn-secondary">Cancelar</button>
              <button onClick={() => { setStockPreview(null); generarPDFs(); }} className="btn-primary">
                Continuar con PDFs
              </button>
            </div>
          </div>
        </div>
      )}

      {undoDelete && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-slideUp">
          <span>Pedido eliminado</span>
          <button onClick={restaurarPedido} className="font-semibold underline hover:opacity-80">
            ↶ Deshacer
          </button>
        </div>
      )}
    </div>
  );
}
