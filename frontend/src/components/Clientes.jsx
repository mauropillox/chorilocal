import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authFetch, authFetchJson } from '../authFetch';
import { toastSuccess, toastError, toastWarn } from '../toast';
import { useClientesQuery } from '../hooks/useHybridQuery';
import { useDeleteCliente } from '../hooks/useMutations';
import { getSelectStyles } from '../selectStyles';
import ConfirmDialog from './ConfirmDialog';
import HelpBanner from './HelpBanner';

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { clientes, isLoading: clientesLoading, refetch: refetchClientes } = useClientesQuery();
  const deleteClienteMutation = useDeleteCliente();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [zona, setZona] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [vendedores, setVendedores] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set()); // Multi-select
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [soloConTelefono, setSoloConTelefono] = useState(false);
  const [soloConDireccion, setSoloConDireccion] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState(false); // Para editar vendedor inline
  const [updatingVendedor, setUpdatingVendedor] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClientes, setTotalClientes] = useState(0);
  const LIMIT = 50;

  const searchInputRef = useRef(null);
  const nombreInputRef = useRef(null);

  // Cargar vendedores para el selector
  useEffect(() => {
    const fetchVendedores = async () => {
      try {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/vendedores`);
        if (res.ok) {
          const data = await res.json();
          setVendedores(data);
        }
      } catch (e) {
        console.error('Error cargando vendedores:', e);
      }
    };
    fetchVendedores();
  }, []);

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

  // Memoized filtered client options for performance
  const clienteOptions = useMemo(() => {
    const busquedaLower = busqueda.toLowerCase().trim();
    return clientes
      .filter(c => {
        // Filter by search text
        if (busquedaLower) {
          const matchNombre = c.nombre?.toLowerCase().includes(busquedaLower);
          const matchTelefono = c.telefono?.toLowerCase().includes(busquedaLower);
          const matchDireccion = c.direccion?.toLowerCase().includes(busquedaLower);
          const matchZona = c.zona?.toLowerCase().includes(busquedaLower);
          if (!matchNombre && !matchTelefono && !matchDireccion && !matchZona) {
            return false;
          }
        }
        // Filter by checkboxes
        if (soloConTelefono && !c.telefono) return false;
        if (soloConDireccion && !c.direccion) return false;
        return true;
      })
      .map(c => ({
        value: c.id,
        label: `${c.nombre} - ${c.direccion || 'Sin dirección'}`
      }));
  }, [clientes, soloConTelefono, soloConDireccion, busqueda]);

  const agregarCliente = async () => {
    if (!nombre) return toastWarn("Debe ingresar el nombre del cliente");
    setCreating(true);
    try {
      const clienteData = {
        nombre,
        telefono,
        direccion,
        zona,
        vendedor_id: vendedorId ? parseInt(vendedorId) : null
      };
      if (editingClienteId) {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes/${editingClienteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clienteData)
        });
        if (res.ok) {
          await refetchClientes();
          toastSuccess('Cliente actualizado correctamente');
          setEditingClienteId(null);
          setNombre(''); setTelefono(''); setDireccion(''); setZona(''); setVendedorId('');
        } else {
          const err = await res.json().catch(() => ({}));
          toastError(err.detail || 'Error al actualizar cliente');
        }
      } else {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clienteData)
        });
        if (res.ok) {
          setPage(1);
          await refetchClientes();
          setNombre(''); setTelefono(''); setDireccion(''); setZona(''); setVendedorId('');
          toastSuccess('Cliente creado correctamente');
        } else {
          const err = await res.json().catch(() => ({}));
          const msg = (err && (err.detail?.detail || err.detail || err.message)) || 'Error al crear cliente';
          toastError(msg);
        }
      }
    } catch (e) {
      toastError('Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  const confirmarEliminar = () => {
    if (!selectedCliente) return;
    setConfirmOpen(true);
  };

  const eliminarCliente = useCallback(async () => {
    if (!selectedCliente) return;
    setDeleting(true);
    try {
      await deleteClienteMutation.mutateAsync(selectedCliente.value);
      setSelectedCliente(null);
    } catch (e) {
      // Error already handled by mutation hook
    }
    setDeleting(false);
    setConfirmOpen(false);
  }, [selectedCliente, deleteClienteMutation]);

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
        await refetchClientes();
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

  // Actualizar vendedor de un cliente directamente (inline)
  const actualizarVendedorCliente = async (clienteId, nuevoVendedorId) => {
    setUpdatingVendedor(true);
    try {
      const cliente = clientes.find(c => c.id === clienteId);
      if (!cliente) return;

      const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes/${clienteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          direccion: cliente.direccion,
          zona: cliente.zona,
          vendedor_id: nuevoVendedorId ? parseInt(nuevoVendedorId) : null
        })
      });
      if (res.ok) {
        await refetchClientes();
        setEditingVendedor(false);
        const vendedor = vendedores.find(v => v.id === parseInt(nuevoVendedorId));
        toastSuccess(vendedor ? `Vendedor asignado: ${vendedor.username}` : 'Vendedor removido');
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al actualizar vendedor');
      }
    } catch (e) {
      toastError('Error de conexión');
    } finally {
      setUpdatingVendedor(false);
    }
  };

  const startEditCliente = (id) => {
    const cli = clientes.find(c => c.id === id);
    if (!cli) return;
    setNombre(cli.nombre || '');
    setTelefono(cli.telefono || '');
    setDireccion(cli.direccion || '');
    setZona(cli.zona || '');
    setVendedorId(cli.vendedor_id ? String(cli.vendedor_id) : '');
    setEditingClienteId(id);
    setShowCreateForm(true);
    setTimeout(() => nombreInputRef.current?.focus(), 80);
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

  // Reset editingVendedor cuando cambia el cliente seleccionado
  useEffect(() => {
    setEditingVendedor(false);
  }, [selectedCliente]);

  const customSelectStyles = getSelectStyles();

  return (
    <div style={{ color: 'var(--color-text)' }}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>👥 Clientes</h2>
        <button onClick={exportarCSV} className="btn-secondary">📥 Exportar CSV</button>
      </div>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo gestionar clientes?"
        icon="👥"
        items={[
          { label: 'Agregar cliente nuevo', text: 'Completá el formulario de la izquierda con nombre (obligatorio), teléfono, dirección y zona. La zona es importante para organizar entregas.' },
          { label: 'Buscar rápido', text: 'Presioná "/" para activar la búsqueda o escribí en la barra superior. Buscá por nombre, teléfono o dirección.' },
          { label: 'Editar datos', text: 'Clickeá cualquier cliente de la lista para cargar sus datos en el formulario. Modificá lo que necesites y guardá los cambios.' },
          { label: 'Ver historial', text: 'Cada cliente muestra cuántos pedidos tiene y el total gastado. Clickeá "Ver Pedidos" para ver su historial completo.' },
          { label: 'Eliminar cliente', text: 'Solo se puede eliminar si no tiene pedidos asociados. Esto protege tu información comercial.' },
          { label: 'Listas de precios', text: 'Si usás precios diferenciados (mayorista/minorista), asigná la lista correspondiente a cada cliente.' }
        ]}
      />

      <div className="two-column-layout">
        {/* LEFT: Formulario */}
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            {editingClienteId ? '✏️ Editar Cliente' : '➕ Agregar Cliente'}
          </h3>

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

          <div className="form-group">
            <label>Vendedor asignado</label>
            <select
              value={vendedorId}
              onChange={e => setVendedorId(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)' }}
            >
              <option value="">Sin vendedor asignado</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id}>{v.username}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={agregarCliente} disabled={creating} className="btn-success" style={{ flex: 1 }}>
              {creating ? (editingClienteId ? '⏳ Guardando...' : '⏳ Creando...') : (editingClienteId ? '💾 Guardar cambios' : '➕ Agregar Cliente')}
            </button>
            {editingClienteId && (
              <button onClick={() => {
                setEditingClienteId(null);
                setNombre(''); setTelefono(''); setDireccion(''); setZona(''); setVendedorId('');
              }} className="btn-ghost" style={{ minWidth: '110px' }}>✕ Cancelar</button>
            )}
          </div>
        </div>

        {/* RIGHT: Select y detalle */}
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Buscar / Seleccionar
          </h3>

          <div className="form-group">
            <label>Buscar por nombre/teléfono/dirección</label>
            <input
              id="cliente-busqueda"
              ref={searchInputRef}
              type="text"
              placeholder="🔍 Escribí para buscar..."
              value={busqueda}
              onChange={e => {
                setBusqueda(e.target.value);
                setPage(1);
              }}
              className="w-full"
              autoComplete="off"
            />
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
              <div className="flex items-center gap-2">
                {selectedIds.size === 1 && (
                  <button
                    onClick={() => {
                      const id = [...selectedIds][0];
                      startEditCliente(id);
                    }}
                    className="btn-secondary text-sm"
                    style={{ padding: '6px 10px' }}
                  >
                    ✏️ Editar
                  </button>
                )}
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
            </div>
          )}

          {clientesLoading ? (
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
                        data-cliente-id={c.value}
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
                            <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1 mt-1">
                              <span>📞 {cliente?.telefono || '-'}</span>
                              <span>📍 {cliente?.direccion ? (cliente.direccion.length > 20 ? cliente.direccion.substring(0, 20) + '...' : cliente.direccion) : '-'}</span>
                              <span>🗺️ {cliente?.zona || '-'}</span>
                              <span style={{ color: cliente?.vendedor_nombre ? 'var(--color-primary)' : undefined }}>
                                👤 {cliente?.vendedor_nombre || '-'}
                              </span>
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
              <div className="text-sm space-y-2" style={{ color: 'var(--color-text-secondary)' }}>
                <div>📞 <strong>Teléfono:</strong> {clienteDetalle.telefono || 'No registrado'}</div>
                <div>📍 <strong>Dirección:</strong> {clienteDetalle.direccion || 'No registrada'}</div>
                <div>🗺️ <strong>Zona:</strong> {clienteDetalle.zona || 'No registrada'}</div>

                {/* Vendedor con edición inline */}
                <div className="flex items-center gap-2">
                  <span>👤 <strong>Vendedor:</strong></span>
                  {editingVendedor ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={clienteDetalle.vendedor_id || ''}
                        onChange={(e) => actualizarVendedorCliente(clienteDetalle.id, e.target.value)}
                        disabled={updatingVendedor}
                        className="text-sm p-1 rounded"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-primary)',
                          minWidth: '140px'
                        }}
                        autoFocus
                      >
                        <option value="">Sin asignar</option>
                        {vendedores.map(v => (
                          <option key={v.id} value={v.id}>{v.username}</option>
                        ))}
                      </select>
                      {updatingVendedor && <span className="text-xs">⏳</span>}
                      <button
                        onClick={() => setEditingVendedor(false)}
                        className="text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => setEditingVendedor(true)}
                      className="cursor-pointer hover:underline"
                      style={{
                        color: clienteDetalle.vendedor_nombre ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontWeight: clienteDetalle.vendedor_nombre ? '500' : 'normal'
                      }}
                      title="Click para cambiar vendedor"
                    >
                      {clienteDetalle.vendedor_nombre || 'Sin asignar'} ✏️
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => startEditCliente(clienteDetalle.id)} className="btn-secondary">
                  ✏️ Editar Cliente
                </button>
                <button onClick={confirmarEliminar} className="btn-danger">
                  🗑️ Eliminar Cliente
                </button>
              </div>
            </div>
          )}

          {!clienteDetalle && !clientesLoading && (
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
