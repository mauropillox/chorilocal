import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authFetch, authFetchJson } from '../authFetch';
import { toastSuccess, toastError, toastWarn } from '../toast';
import { getSelectStyles } from '../selectStyles';
import ConfirmDialog from './ConfirmDialog';

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [zona, setZona] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set()); // Multi-select
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [soloConTelefono, setSoloConTelefono] = useState(false);
  const [soloConDireccion, setSoloConDireccion] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClientes, setTotalClientes] = useState(0);
  const LIMIT = 50;

  const searchInputRef = useRef(null);
  const nombreInputRef = useRef(null);

  // Handle URL params
  useEffect(() => {
    const crearParam = searchParams.get('crear');
    const buscarParam = searchParams.get('buscar');

    if (crearParam === '1') {
      setShowCreateForm(true);
      setTimeout(() => nombreInputRef.current?.focus(), 100);
      setSearchParams({});
    }
    if (buscarParam) {
      setBusqueda(buscarParam);
      setSearchParams({});
    }
  }, [searchParams]);

  // Cargar clientes al montar y cuando cambian page o busqueda
  useEffect(() => {
    cargarClientes();
  }, [page, busqueda]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        nombre && agregarCliente();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nombre, telefono, direccion, creating]);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL}/clientes?page=${page}&limit=${LIMIT}`;
      if (busqueda.trim()) url += `&search=${encodeURIComponent(busqueda.trim())}`;

      const { res, data } = await authFetchJson(url);
      if (!res.ok) { setClientes([]); setLoading(false); return; }

      // Formato paginado: { data: [], total, page, pages }
      if (data.data) {
        setClientes(data.data);
        setTotalPages(data.pages);
        setTotalClientes(data.total);
      } else {
        // Formato legacy: array directo
        setClientes(Array.isArray(data) ? data : []);
        setTotalClientes(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
    } catch (e) { setClientes([]); }
    finally { setLoading(false); }
  };

  // Memoized filtered client options for performance
  const clienteOptions = useMemo(() =>
    clientes
      .filter(c => (soloConTelefono ? !!c.telefono : true))
      .filter(c => (soloConDireccion ? !!c.direccion : true))
      .map(c => ({
        value: c.id,
        label: `${c.nombre} - ${c.direccion || 'Sin dirección'}`
      })),
    [clientes, soloConTelefono, soloConDireccion]
  );

  const agregarCliente = async () => {
    if (!nombre) return toastWarn("Debe ingresar el nombre del cliente");
    setCreating(true);
    const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono, direccion, zona })
    });
    if (res.ok) {
      setPage(1);
      await cargarClientes();
      setNombre(''); setTelefono(''); setDireccion(''); setZona('');
      toastSuccess('Cliente creado correctamente');
    } else {
      try {
        const err = await res.json();
        const msg = (err && (err.detail?.detail || err.detail || err.message)) || 'Error al crear cliente';
        toastError(msg);
      } catch (_) {
        toastError('Error al crear cliente');
      }
    }
    setCreating(false);
  };

  const confirmarEliminar = () => {
    if (!selectedCliente) return;
    setConfirmOpen(true);
  };

  const eliminarCliente = useCallback(async () => {
    if (!selectedCliente) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes/${selectedCliente.value}`, { method: "DELETE" });
      if (res.ok) {
        toastSuccess('Cliente eliminado');
        setSelectedCliente(null);
        await cargarClientes();
      } else {
        toastError('Error al eliminar cliente');
      }
    } catch (e) {
      toastError('Error de conexión');
    }
    setDeleting(false);
    setConfirmOpen(false);
  }, [selectedCliente]);

  // Toggle selection for multi-select
  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select/deselect all visible
  const toggleSelectAll = () => {
    const visibleIds = clienteOptions.map(c => c.value);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  // Bulk delete
  const eliminarSeleccionados = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([...selectedIds])
      });
      if (res.ok) {
        const data = await res.json();
        toastSuccess(`${data.deleted} cliente(s) eliminado(s)`);
        if (data.errors?.length > 0) {
          toastWarn(`${data.errors.length} error(es) al eliminar`);
        }
        setSelectedIds(new Set());
        setSelectedCliente(null);
        await cargarClientes();
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al eliminar clientes');
      }
    } catch (e) {
      toastError('Error de conexión');
    }
    setDeleting(false);
    setConfirmBulkOpen(false);
  };

  const exportarCSV = async () => {
    const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes/export/csv`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'clientes.csv';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const clienteDetalle = selectedCliente ? clientes.find(c => c.id === selectedCliente.value) : null;

  const customSelectStyles = getSelectStyles();

  return (
    <div style={{ color: 'var(--color-text)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>👥 Clientes</h2>
        <button onClick={exportarCSV} className="btn-secondary">📥 Exportar CSV</button>
      </div>

      <div className="two-column-layout">
        {/* LEFT: Formulario */}
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>➕ Agregar Cliente</h3>

          <div className="form-group">
            <label>Nombre *</label>
            <input
              ref={nombreInputRef}
              autoFocus
              type="text"
              placeholder="Nombre del cliente"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarCliente()}
            />
          </div>

          <div className="form-group">
            <label>Teléfono</label>
            <input type="text" placeholder="Teléfono" value={telefono}
              onChange={e => setTelefono(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarCliente()} />
          </div>

          <div className="form-group">
            <label>Dirección</label>
            <input type="text" placeholder="Dirección" value={direccion}
              onChange={e => setDireccion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarCliente()} />
          </div>

          <div className="form-group">
            <label>Zona</label>
            <input type="text" placeholder="Zona" value={zona}
              onChange={e => setZona(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarCliente()} />
          </div>
          <button onClick={agregarCliente} disabled={creating} className="btn-success w-full">
            {creating ? '⏳ Creando...' : '➕ Agregar Cliente'}
          </button>
        </div>

        {/* RIGHT: Select y detalle */}
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Buscar / Seleccionar
          </h3>

          <div className="form-group">
            <label>Buscar por nombre/teléfono/dirección</label>
            <input type="text" placeholder="🔍 Buscar..." value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPage(1); }}
              className="w-full" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="custom-checkbox" checked={soloConTelefono} onChange={e => setSoloConTelefono(e.target.checked)} />
              Con teléfono
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="custom-checkbox" checked={soloConDireccion} onChange={e => setSoloConDireccion(e.target.checked)} />
              Con dirección
            </label>
          </div>

          {/* Multi-select toolbar */}
          {clienteOptions.length > 0 && (
            <div className="flex items-center justify-between mb-3 p-2 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="custom-checkbox"
                  checked={clienteOptions.length > 0 && clienteOptions.every(c => selectedIds.has(c.value))}
                  onChange={toggleSelectAll}
                />
                Seleccionar todos
              </label>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmBulkOpen(true)}
                  disabled={deleting}
                  className="btn-danger text-sm"
                  style={{ padding: '4px 12px' }}
                >
                  🗑️ Eliminar ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card-item">
                  <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '8px' }}></div>
                  <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: '4px' }}></div>
                  <div className="skeleton" style={{ height: '16px', width: '50%' }}></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Lista visual de clientes */}
              <div className="space-y-2 mb-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {clienteOptions.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    No se encontraron clientes
                  </div>
                ) : (
                  clienteOptions.map(c => {
                    const cliente = clientes.find(cl => cl.id === c.value);
                    const isSelected = selectedCliente?.value === c.value;
                    const isChecked = selectedIds.has(c.value);
                    return (
                      <div
                        key={c.value}
                        className={`card-item cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'} ${isChecked ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: isSelected ? 'var(--color-primary-light)' : isChecked ? 'var(--color-primary-light)' : undefined
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="custom-checkbox mt-1"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelection(c.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1" onClick={() => setSelectedCliente(isSelected ? null : c)}>
                            <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                              {cliente?.nombre}
                            </div>
                            <div className="text-xs text-muted flex gap-4 mt-1">
                              <span>📞 {cliente?.telefono || 'Sin teléfono'}</span>
                              <span>📍 {cliente?.direccion || 'Sin dirección'}</span>
                              <span>🗺️ {cliente?.zona || 'Sin zona'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="btn-secondary" style={{ padding: '6px 12px' }}>← Anterior</button>
                  <span className="text-sm">Página {page} de {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="btn-secondary" style={{ padding: '6px 12px' }}>Siguiente →</button>
                </div>
              )}
            </>
          )}

          {clienteDetalle && (
            <div className="card-accent mt-4">
              <div className="font-semibold text-lg mb-2" style={{ color: 'var(--color-text)' }}>
                {clienteDetalle.nombre}
              </div>
              <div className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                <div>📞 <strong>Teléfono:</strong> {clienteDetalle.telefono || 'No registrado'}</div>
                <div>📍 <strong>Dirección:</strong> {clienteDetalle.direccion || 'No registrada'}</div>
                <div>🗺️ <strong>Zona:</strong> {clienteDetalle.zona || 'No registrada'}</div>
              </div>
              <button onClick={confirmarEliminar} className="btn-danger mt-3">
                🗑️ Eliminar Cliente
              </button>
            </div>
          )}

          {!clienteDetalle && !loading && (
            <div className="empty-state mt-4">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-text">Selecciona un cliente para ver detalles</div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={eliminarCliente}
        title="¿Eliminar cliente?"
        message={`¿Estás seguro de eliminar a "${selectedCliente?.label?.split(' - ')[0]}"? Esta acción no se puede deshacer.`}
        confirmText={deleting ? "Eliminando..." : "Eliminar"}
      />

      <ConfirmDialog
        open={confirmBulkOpen}
        onClose={() => setConfirmBulkOpen(false)}
        onConfirm={eliminarSeleccionados}
        title="¿Eliminar clientes seleccionados?"
        message={`¿Estás seguro de eliminar ${selectedIds.size} cliente(s)? Esta acción no se puede deshacer.`}
        confirmText={deleting ? "Eliminando..." : `Eliminar ${selectedIds.size}`}
      />
    </div>
  );
}
