import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetchJson, authFetch } from '../authFetch';
import { toastSuccess, toastError } from '../toast';
import { CACHE_KEYS } from '../utils/queryClient';
import HelpBanner from './HelpBanner';
import { logger } from '../utils/logger';

// Estados de pedido workflow SIMPLIFICADOS
const ESTADOS_PEDIDO = {
    pendiente: { label: 'Pendiente', icon: '📝', color: '#3b82f6', bg: '#dbeafe' },
    preparando: { label: 'Preparando', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    entregado: { label: 'Entregado', icon: '✅', color: '#10b981', bg: '#d1fae5' },
    cancelado: { label: 'Cancelado', icon: '❌', color: '#ef4444', bg: '#fee2e2' },
    // Legacy states for backward compatibility
    confirmado: { label: 'Confirmado', icon: '✔️', color: '#3b82f6', bg: '#dbeafe' },
    enviado: { label: 'Enviado', icon: '🚚', color: '#8b5cf6', bg: '#ede9fe' },
    listo: { label: 'Listo', icon: '📦', color: '#10b981', bg: '#d1fae5' },
    en_preparacion: { label: 'En Preparación', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    // Case variations
    Pendiente: { label: 'Pendiente', icon: '📝', color: '#3b82f6', bg: '#dbeafe' },
    Confirmado: { label: 'Confirmado', icon: '✔️', color: '#3b82f6', bg: '#dbeafe' },
    'En Preparación': { label: 'En Preparación', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    'en preparación': { label: 'En Preparación', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    'En preparacion': { label: 'En Preparación', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    Listo: { label: 'Listo', icon: '📦', color: '#10b981', bg: '#d1fae5' },
    Entregado: { label: 'Entregado', icon: '✅', color: '#10b981', bg: '#d1fae5' },
    Cancelado: { label: 'Cancelado', icon: '❌', color: '#ef4444', bg: '#fee2e2' },
    Preparando: { label: 'Preparando', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    Enviado: { label: 'Enviado', icon: '🚚', color: '#8b5cf6', bg: '#ede9fe' },
    // Null/empty/undefined handling
    null: { label: 'Pendiente', icon: '📝', color: '#3b82f6', bg: '#dbeafe' },
    undefined: { label: 'Pendiente', icon: '📝', color: '#3b82f6', bg: '#dbeafe' },
    '': { label: 'Pendiente', icon: '📝', color: '#3b82f6', bg: '#dbeafe' }
};

// Default state info for unknown states - treat as Pendiente
const DEFAULT_ESTADO_INFO = { label: 'Pendiente', icon: '📝', color: '#3b82f6', bg: '#dbeafe' };

// Helper to get estado info safely
const getEstadoInfo = (estado) => ESTADOS_PEDIDO[estado] || DEFAULT_ESTADO_INFO;

// Helper to calculate zone progress stats
const calcZoneProgress = (pedidosZona) => {
    const total = pedidosZona.length;
    const pendiente = pedidosZona.filter(p => (p.estado || 'pendiente') === 'pendiente').length;
    const preparando = pedidosZona.filter(p => p.estado === 'preparando').length;
    const entregado = pedidosZona.filter(p => p.estado === 'entregado').length;
    const cancelado = pedidosZona.filter(p => p.estado === 'cancelado').length;
    const completedPercent = total > 0 ? Math.round((entregado / total) * 100) : 0;
    return { total, pendiente, preparando, entregado, cancelado, completedPercent };
};

export default function HojaRuta() {
    const { data: pedidos = [] } = useQuery({
        queryKey: CACHE_KEYS.pedidos,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos`);
            return res.ok ? (data || []) : [];
        },
        staleTime: 1000 * 60 * 5,
    });
    const { data: clientes = [] } = useQuery({
        queryKey: CACHE_KEYS.clientes,
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`);
            return res.ok ? (Array.isArray(data) ? data : (data.data || [])) : [];
        },
        staleTime: 1000 * 60 * 5,
    });
    const { data: repartidores = [] } = useQuery({
        queryKey: [...CACHE_KEYS.usuarios, 'repartidores'],
        queryFn: async () => {
            const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/repartidores`);
            return res.ok ? (data || []) : [];
        },
        staleTime: 1000 * 60 * 5,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null); // Error state for UX
    const [filtroRepartidor, setFiltroRepartidor] = useState('');
    const [filtroZona, setFiltroZona] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [nuevoRepartidor, setNuevoRepartidor] = useState('');
    const [asignandoRepartidor, setAsignandoRepartidor] = useState(null);
    const [generandoPDF, setGenerandoPDF] = useState(false);

    // Bulk selection for batch actions
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [bulkRepartidor, setBulkRepartidor] = useState('');
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Hover state for showing actions
    const [hoveredPedidoId, setHoveredPedidoId] = useState(null);
    const [showActionsForId, setShowActionsForId] = useState(null);

    // Paginación - default 25 para ver más
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Vista compacta toggle
    const [vistaCompacta, setVistaCompacta] = useState(true);

    // Repartidores management state
    const [showRepartidoresManager, setShowRepartidoresManager] = useState(false);
    const [nuevoRepartidorNombre, setNuevoRepartidorNombre] = useState('');
    const [nuevoRepartidorTelefono, setNuevoRepartidorTelefono] = useState('');

    // Zonas management state
    const [showZonasManager, setShowZonasManager] = useState(false);
    const [editingClienteZona, setEditingClienteZona] = useState(null);
    const [nuevaZonaCliente, setNuevaZonaCliente] = useState('');
    const [zonasPredefinidasUY] = useState(['Montevideo Centro', 'Montevideo Este', 'Montevideo Oeste', 'Ciudad de la Costa', 'Canelones', 'San José', 'Colonia', 'Maldonado', 'Punta del Este', 'Otras zonas']);

    // Paginación de zonas
    const [zonasPage, setZonasPage] = useState(1);
    const [zonasPerPage, setZonasPerPage] = useState(5);
    const [expandedZona, setExpandedZona] = useState(null);
    const [clientesZonaPage, setClientesZonaPage] = useState({});
    const [clientesPorZonaPage, setClientesPorZonaPage] = useState(10);

    // Paginación de clientes sin zona
    const [clientesSinZonaPage, setClientesSinZonaPage] = useState(1);
    const [clientesSinZonaPerPage, setClientesSinZonaPerPage] = useState(10);

    // Nueva zona state
    const [creatingZona, setCreatingZona] = useState(false);
    const [nuevaZonaNombre, setNuevaZonaNombre] = useState('');

    // Paginación de zonas en la vista de pedidos (sin panel de zonas)
    const [pedidosZonaPage, setPedidosZonaPage] = useState(1);
    const [pedidosZonasPerPage, setPedidosZonasPerPage] = useState(5);
    const [expandedPedidoZona, setExpandedPedidoZona] = useState(null);

    // Paginación de pedidos DENTRO de cada zona
    const [pedidosDentroZonaPage, setPedidosDentroZonaPage] = useState({});
    const [pedidosDentroZonaPerPage, setPedidosDentroZonaPerPage] = useState(10);

    useEffect(() => {
        cargarDatos();
    }, []);

    // Reset página cuando cambian filtros
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set()); // Clear selection on filter change
    }, [filtroEstado, filtroZona, filtroRepartidor]);

    const cargarDatos = async () => {
        setLoading(true);
        setError(null);
        try {
            const [pedRes, cliRes, repRes] = await Promise.all([
                authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos`),
                authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`),
                authFetchJson(`${import.meta.env.VITE_API_URL}/repartidores`)
            ]);

            if (pedRes.res.ok) {
                const pedidosData = Array.isArray(pedRes.data) ? pedRes.data : [];
                setPedidos(pedidosData);
            } else {
                setError('Error al cargar pedidos');
            }

            if (cliRes.res.ok) {
                const cliData = cliRes.data;
                if (cliData.data) setClientes(cliData.data);
                else setClientes(Array.isArray(cliData) ? cliData : []);
            }

            // Load repartidores from API (with fallback to pedidos-based list)
            if (repRes.res.ok && Array.isArray(repRes.data)) {
                setRepartidores(repRes.data);
            } else {
                // Fallback: extract from pedidos
                const pedidosData = Array.isArray(pedRes.data) ? pedRes.data : [];
                const reps = [...new Set(pedidosData.map(p => p.repartidor).filter(Boolean))];
                setRepartidores(reps.map(r => ({ nombre: r, id: null })));
            }
            toastSuccess('🗺️ Hoja de ruta cargada correctamente');
        } catch (e) {
            logger.error('Error cargando datos:', e);
            setError('Error de conexión. Por favor, intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // Add new repartidor
    const agregarRepartidor = async () => {
        if (!nuevoRepartidorNombre.trim()) {
            toastError('Ingresá un nombre');
            return;
        }
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/repartidores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nuevoRepartidorNombre.trim(),
                    telefono: nuevoRepartidorTelefono.trim() || null
                })
            });
            if (res.ok) {
                toastSuccess('Repartidor agregado');
                setNuevoRepartidorNombre('');
                setNuevoRepartidorTelefono('');
                await cargarDatos();
            } else {
                const data = await res.json();
                toastError(data.detail || 'Error al agregar');
            }
        } catch (e) {
            logger.error('Error agregando repartidor:', e);
            toastError('Error de conexión');
        }
    };

    // Asignar/cambiar zona de un cliente
    const asignarZonaCliente = async (clienteId, zona) => {
        if (!zona || !zona.trim()) {
            toastError('Seleccioná una zona');
            return;
        }

        try {
            const cliente = clientes.find(c => c.id === clienteId);
            if (!cliente) return;

            const res = await authFetch(`${import.meta.env.VITE_API_URL}/clientes/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: cliente.nombre,
                    telefono: cliente.telefono,
                    direccion: cliente.direccion,
                    zona: zona.trim()
                })
            });

            if (res.ok) {
                toastSuccess(`Zona actualizada: ${zona}`);
                setEditingClienteZona(null);
                setNuevaZonaCliente('');
                await cargarDatos();
            } else {
                toastError('Error al actualizar zona');
            }
        } catch (e) {
            toastError('Error de conexión');
        }
    };

    // Delete repartidor
    const eliminarRepartidor = async (id) => {
        if (!window.confirm('¿Desactivar este repartidor?')) return;
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/repartidores/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toastSuccess('Repartidor desactivado');
                await cargarDatos();
            } else {
                toastError('Error al desactivar');
            }
        } catch (e) {
            toastError('Error de conexión');
        }
    };

    // Map-based lookup for O(1) client access instead of O(n) array.find
    // IMPORTANT: Must be defined before callbacks that use pedidosFiltrados
    const clientesMap = useMemo(() =>
        new Map(clientes.map(c => [c.id, c])),
        [clientes]
    );

    const getCliente = useCallback((clienteId) =>
        clientesMap.get(clienteId) || {},
        [clientesMap]
    );

    const zonasUnicas = useMemo(() => {
        const zonas = [...new Set(clientes.map(c => c.zona).filter(Boolean))];
        return zonas.sort();
    }, [clientes]);

    // Filtrar pedidos (excluir entregados y cancelados por defecto)
    // IMPORTANT: Must be defined before selectAll callback
    const pedidosFiltrados = useMemo(() => {
        return pedidos.filter(p => {
            const estado = p.estado || 'pendiente';
            // Excluir entregados y cancelados por defecto
            if (!filtroEstado && (estado === 'entregado' || estado === 'cancelado')) return false;

            if (filtroEstado && estado !== filtroEstado) return false;
            if (filtroRepartidor === '__sin_asignar__') {
                if (p.repartidor) return false;
            } else if (filtroRepartidor && p.repartidor !== filtroRepartidor) {
                return false;
            }
            if (filtroZona) {
                const cliente = getCliente(p.cliente_id);
                if (cliente.zona !== filtroZona) return false;
            }
            return true;
        });
    }, [pedidos, filtroEstado, filtroRepartidor, filtroZona, getCliente]);

    // Toggle selection for bulk actions
    const toggleSelection = useCallback((id) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    // Select all visible pedidos
    const selectAll = useCallback(() => {
        const visibleIds = pedidosFiltrados.map(p => p.id);
        setSelectedIds(new Set(visibleIds));
    }, [pedidosFiltrados]);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    // Bulk change estado - using parallel requests for better performance
    const bulkChangeEstado = useCallback(async (nuevoEstado) => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        // Create a pedidos map for O(1) lookup
        const pedidosMap = new Map(pedidos.map(p => [p.id, p]));

        // Execute all requests in parallel
        const results = await Promise.allSettled(
            ids.map(id => {
                const pedido = pedidosMap.get(id);
                return authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${id}/estado`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: nuevoEstado,
                        repartidor: pedido?.repartidor
                    })
                });
            })
        );

        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;

        if (successCount > 0) {
            toastSuccess(`${ESTADOS_PEDIDO[nuevoEstado].icon} ${successCount} pedidos actualizados`);
            await cargarDatos();
            setSelectedIds(new Set());
        } else {
            toastError('Error al actualizar pedidos');
        }
    }, [selectedIds, pedidos, cargarDatos]);

    // Bulk assign repartidor - using parallel requests
    const bulkAsignarRepartidor = useCallback(async () => {
        if (!bulkRepartidor.trim()) {
            toastError('Ingresá un nombre de repartidor');
            return;
        }

        const ids = Array.from(selectedIds);
        const pedidosMap = new Map(pedidos.map(p => [p.id, p]));

        // Execute all requests in parallel
        const results = await Promise.allSettled(
            ids.map(id => {
                const pedido = pedidosMap.get(id);
                return authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${id}/estado`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estado: pedido?.estado || 'pendiente',
                        repartidor: bulkRepartidor
                    })
                });
            })
        );

        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;

        if (successCount > 0) {
            toastSuccess(`👤 ${successCount} pedidos asignados a ${bulkRepartidor}`);
            await cargarDatos();
            setSelectedIds(new Set());
            setBulkAssigning(false);
            setBulkRepartidor('');
            if (!repartidores.some(r => r.nombre === bulkRepartidor)) {
                // Reload to get updated list from server
                await cargarDatos();
            }
        } else {
            toastError('Error al asignar repartidor');
        }
    }, [selectedIds, pedidos, bulkRepartidor, repartidores, cargarDatos]);

    // Bulk delete pedidos
    const bulkEliminarPedidos = useCallback(async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
            toastError('No hay pedidos seleccionados');
            return;
        }

        // Confirmar eliminación
        const confirmMsg = `¿Estás seguro de eliminar ${ids.length} pedido${ids.length > 1 ? 's' : ''}?`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            setBulkDeleting(true);
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedido_ids: ids })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.deleted > 0) {
                    toastSuccess(`🗑️ ${data.deleted} pedido${data.deleted > 1 ? 's' : ''} eliminado${data.deleted > 1 ? 's' : ''}`);
                    await cargarDatos();
                    setSelectedIds(new Set());
                }
                if (data.errors && data.errors.length > 0) {
                    toastError(`Errores: ${data.errors.join(', ')}`);
                }
            } else {
                let err;
                try {
                    err = await res.json();
                } catch {
                    err = null;
                }
                const msg = err?.error || err?.detail || 'Error al eliminar pedidos';
                toastError(msg);
            }
        } catch (e) {
            logger.error('Error al eliminar pedidos:', e);
            toastError('Error de conexión');
        } finally {
            setBulkDeleting(false);
        }
    }, [selectedIds, cargarDatos]);

    // Individual delete pedido
    const eliminarPedido = useCallback(async (pedidoId, clienteNombre) => {
        if (!window.confirm(`¿Eliminar pedido de "${clienteNombre}"?`)) {
            return;
        }
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toastSuccess('🗑️ Pedido eliminado');
                await cargarDatos();
            } else {
                const err = await res.json().catch(() => null);
                toastError(err?.detail || 'Error al eliminar pedido');
            }
        } catch (e) {
            logger.error('Error al eliminar pedido:', e);
            toastError('Error de conexión');
        }
    }, [cargarDatos]);

    // Paginación
    const totalPages = Math.ceil(pedidosFiltrados.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pedidosPaginados = pedidosFiltrados.slice(startIndex, startIndex + itemsPerPage);

    // Agrupar pedidos paginados por zona
    const pedidosPorZona = useMemo(() => {
        const grupos = {};
        pedidosPaginados.forEach(p => {
            const cliente = getCliente(p.cliente_id);
            const zona = cliente.zona || 'Sin Zona';
            if (!grupos[zona]) grupos[zona] = [];
            grupos[zona].push({ ...p, cliente });
        });
        return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
    }, [pedidosPaginados, clientes]);

    const asignarRepartidor = async (pedidoId, repartidor) => {
        if (!repartidor.trim()) {
            toastError('Ingresá un nombre de repartidor');
            return;
        }
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: pedidos.find(p => p.id === pedidoId)?.estado || 'pendiente',
                    repartidor
                })
            });

            if (res.ok) {
                toastSuccess(`Repartidor: ${repartidor}`);
                await cargarDatos();
                // Note: cargarDatos already refreshes repartidores from API
            } else {
                toastError('Error al asignar');
            }
        } catch (e) {
            toastError('Error de conexión');
        }
        setAsignandoRepartidor(null);
        setNuevoRepartidor('');
    };

    const cambiarEstado = async (pedidoId, nuevoEstado) => {
        try {
            const pedido = pedidos.find(p => p.id === pedidoId);
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: nuevoEstado,
                    repartidor: pedido?.repartidor
                })
            });

            if (res.ok) {
                toastSuccess(`${ESTADOS_PEDIDO[nuevoEstado].icon} ${ESTADOS_PEDIDO[nuevoEstado].label}`);
                await cargarDatos();
            } else {
                toastError('Error al cambiar estado');
            }
        } catch (e) {
            toastError('Error de conexión');
        }
    };

    // Generar PDF de hoja de ruta
    const generarPDFHojaRuta = async (repartidor) => {
        if (!repartidor) {
            toastError('Seleccioná un repartidor primero');
            return;
        }

        setGenerandoPDF(true);
        try {
            const res = await authFetch(`${import.meta.env.VITE_API_URL}/hoja-ruta/generar-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repartidor,
                    zona: filtroZona || ''
                })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hoja_ruta_${repartidor.replace(/\s+/g, '_')}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toastSuccess(`📄 PDF generado para ${repartidor}`);
            } else {
                const err = await res.json();
                toastError(err.detail || 'Error generando PDF');
            }
        } catch (e) {
            toastError('Error de conexión');
        } finally {
            setGenerandoPDF(false);
        }
    };

    // Contadores - memoized to avoid recalculating on every render
    const contadores = useMemo(() => ({
        pendiente: pedidos.filter(p => (p.estado || 'pendiente') === 'pendiente').length,
        preparando: pedidos.filter(p => p.estado === 'preparando').length,
        entregado: pedidos.filter(p => p.estado === 'entregado').length,
    }), [pedidos]);

    // Siguiente estado en el workflow
    const getSiguienteEstado = (estadoActual) => {
        const flujo = { 'pendiente': 'preparando', 'preparando': 'entregado' };
        return flujo[estadoActual] || null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="text-4xl mb-2">⏳</div>
                    <div>Cargando...</div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center p-6 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-danger)' }}>
                    <div className="text-4xl mb-2">⚠️</div>
                    <div className="font-semibold mb-2" style={{ color: 'var(--color-danger)' }}>{error}</div>
                    <button
                        onClick={cargarDatos}
                        className="px-4 py-2 rounded text-white"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                    🚚 Hoja de Ruta
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Gestiona entregas • {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Ayuda colapsable - Actualizada con gestión de repartidores */}
            <HelpBanner
                title="¿Cómo usar la Hoja de Ruta?"
                icon="🚚"
                items={[
                    { label: 'Filtrar por estado', text: 'Clickeá las tarjetas de colores (Pendiente, Preparando, etc.) para ver solo esos pedidos. Los números muestran cuántos hay en cada estado.' },
                    { label: 'Gestionar repartidores', text: 'Usá el botón "⚙️ Repartidores" para agregar nuevos repartidores o desactivar los existentes. Ingresá nombre y opcionalmente teléfono.' },
                    { label: 'Asignar repartidores', text: 'Cada pedido tiene un selector "👤 Asignar Repartidor". Elegí el nombre y se guarda automáticamente. Los pedidos sin asignar aparecen primero.' },
                    { label: 'Acciones masivas', text: 'Usá "☑ Todos" para seleccionar pedidos visibles. Luego podés cambiar estado o asignar repartidor a todos juntos.' },
                    { label: 'Cambiar estados', text: 'Usá los botones de cada pedido para avanzar: Pendiente → Preparar → Entregar. También podés cancelar si es necesario.' },
                    { label: 'Generar PDF', text: 'Seleccioná un repartidor y hacé clic en "📄 Generar PDF" para crear una hoja de ruta imprimible con todos sus pedidos, agrupados por zona.' },
                    { label: 'Organización', text: 'Los pedidos están agrupados por zona para optimizar la ruta de entrega.' }
                ]}
            />

            {/* Tutorial paso a paso para armar rutas */}
            <HelpBanner
                title="📋 Paso a paso: Armar rutas de entrega"
                icon="📍"
                items={[
                    { label: 'PASO 1: Crear repartidores', text: 'Abrí "⚙️ Repartidores" → Ingresá nombre (ej: Juan, Pedro) → Click "Agregar". Hacelo una vez y quedan guardados.' },
                    { label: 'PASO 2: Organizar por zonas', text: 'Usá "🗺️ Zonas" para asignar zonas a tus clientes (ej: Montevideo Centro, San José, Ciudad de la Costa). Filtrá por zona para ver pedidos agrupados.' },
                    { label: 'PASO 3: Asignar pedidos', text: 'Seleccioná una zona → Click "☑ Seleccionar todos" → Elegí un repartidor del dropdown → Listo! Todos los pedidos de esa zona quedan asignados.' },
                    { label: 'PASO 4: Repetir por zona', text: 'Hacé lo mismo con cada zona: Montevideo Centro → Juan, San José → Pedro, etc. Así cada repartidor tiene su ruta definida.' },
                    { label: 'PASO 5: Imprimir hoja de ruta', text: 'Filtrá por repartidor (ej: "👤 Juan") → Aparece el botón "📄 Generar PDF" → Se descarga el PDF para imprimir.' },
                    { label: 'PASO 6: Marcar entregas', text: 'Cuando el repartidor vuelve, filtrá por su nombre y marcá cada pedido como "Entregado". Podés hacerlo masivo con "☑ Seleccionar todos".' }
                ]}
            />

            {/* Stats Cards - Clickeables como filtros */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {['pendiente', 'preparando', 'entregado'].map(estado => {
                    const info = getEstadoInfo(estado);
                    const isActive = filtroEstado === estado;
                    return (
                        <button
                            key={estado}
                            onClick={() => setFiltroEstado(isActive ? '' : estado)}
                            className="p-2 rounded-lg text-center transition-all"
                            style={{
                                background: isActive ? info.color : info.bg,
                                color: isActive ? 'white' : info.color,
                                border: `2px solid ${info.color}`,
                                cursor: 'pointer'
                            }}
                        >
                            <div className="text-lg font-bold">{contadores[estado]}</div>
                            <div className="text-xs">{info.icon} {info.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* Barra de acciones */}
            <div className="flex flex-wrap gap-4 mb-4 p-4 rounded-lg items-center" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                {/* Filtros */}
                <select
                    value={filtroZona}
                    onChange={e => setFiltroZona(e.target.value)}
                    className="px-3 py-2 rounded border text-sm"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                >
                    <option value="">📍 Todas las zonas</option>
                    {zonasUnicas.map(zona => (
                        <option key={zona} value={zona}>{zona}</option>
                    ))}
                </select>

                <select
                    value={filtroRepartidor}
                    onChange={e => setFiltroRepartidor(e.target.value)}
                    className="px-3 py-2 rounded border text-sm"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                >
                    <option value="">👤 Todos</option>
                    <option value="__sin_asignar__">❌ Sin repartidor</option>
                    {repartidores.map(rep => (
                        <option key={rep.id || rep.nombre} value={rep.nombre}>{rep.nombre}</option>
                    ))}
                </select>

                {/* Gestionar Repartidores button */}
                <button
                    onClick={() => setShowRepartidoresManager(!showRepartidoresManager)}
                    className="px-3 py-2 text-sm rounded flex items-center gap-1"
                    style={{ background: showRepartidoresManager ? 'var(--color-primary)' : 'var(--color-bg)', color: showRepartidoresManager ? 'white' : 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    aria-label="Gestionar repartidores"
                    aria-expanded={showRepartidoresManager}
                >
                    ⚙️ Repartidores
                </button>

                {(filtroEstado || filtroZona || filtroRepartidor) && (
                    <button
                        onClick={() => { setFiltroEstado(''); setFiltroZona(''); setFiltroRepartidor(''); }}
                        className="px-3 py-2 text-sm rounded"
                        style={{ background: 'var(--color-danger)', color: 'white' }}
                        aria-label="Limpiar todos los filtros"
                    >
                        ✕ Limpiar
                    </button>
                )}

                {/* Separador */}
                <div className="h-8 w-px mx-3" style={{ background: 'var(--color-border)' }}></div>

                {/* Zonas Manager Button */}
                <button
                    onClick={() => setShowZonasManager(!showZonasManager)}
                    className="px-3 py-2 text-sm rounded font-medium"
                    style={{ background: showZonasManager ? 'var(--color-primary)' : 'var(--color-bg)', color: showZonasManager ? 'white' : 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    aria-label="Gestionar zonas de clientes"
                    aria-expanded={showZonasManager}
                >
                    🗺️ Zonas
                </button>

                {/* Bulk selection buttons */}
                <button
                    onClick={selectAll}
                    className="px-3 py-2 text-sm rounded"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    title="Seleccionar todos los pedidos visibles"
                    aria-label="Seleccionar todos los pedidos visibles"
                >
                    ☑️ Seleccionar todos
                </button>

                {/* Botón PDF */}
                {filtroRepartidor && filtroRepartidor !== '__sin_asignar__' && (
                    <button
                        onClick={() => generarPDFHojaRuta(filtroRepartidor)}
                        disabled={generandoPDF}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                        style={{
                            background: generandoPDF ? '#6b7280' : '#059669',
                            color: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {generandoPDF ? (
                            <>⏳ Generando...</>
                        ) : (
                            <>📄 Generar PDF para {filtroRepartidor}</>
                        )}
                    </button>
                )}

                {/* Vista compacta toggle */}
                <button
                    onClick={() => setVistaCompacta(!vistaCompacta)}
                    className="px-3 py-2 rounded text-sm ml-auto"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    aria-label={vistaCompacta ? 'Cambiar a vista expandida' : 'Cambiar a vista compacta'}
                    aria-pressed={vistaCompacta}
                >
                    {vistaCompacta ? '📋 Vista Expandida' : '📑 Vista Compacta'}
                </button>

                {/* Items por página */}
                <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ver:</span>
                    <select
                        value={itemsPerPage}
                        onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-2 py-1 rounded border text-sm"
                        style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {/* Repartidores Management Panel */}
            {showRepartidoresManager && (
                <div
                    className="mb-4 p-4 rounded-lg"
                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            👥 Gestionar Repartidores
                        </h3>
                        <button
                            onClick={() => setShowRepartidoresManager(false)}
                            className="text-sm px-2 py-1 rounded"
                            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Add new repartidor form */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        <input
                            type="text"
                            value={nuevoRepartidorNombre}
                            onChange={e => setNuevoRepartidorNombre(e.target.value)}
                            placeholder="Nombre del repartidor"
                            className="px-3 py-2 rounded border text-sm flex-1 min-w-[150px]"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                            onKeyDown={e => e.key === 'Enter' && agregarRepartidor()}
                        />
                        <input
                            type="text"
                            value={nuevoRepartidorTelefono}
                            onChange={e => setNuevoRepartidorTelefono(e.target.value)}
                            placeholder="Teléfono (opcional)"
                            className="px-3 py-2 rounded border text-sm w-36"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                            onKeyDown={e => e.key === 'Enter' && agregarRepartidor()}
                        />
                        <button
                            onClick={agregarRepartidor}
                            className="px-4 py-2 rounded text-sm font-semibold"
                            style={{ background: '#10b981', color: 'white' }}
                        >
                            + Agregar
                        </button>
                    </div>

                    {/* List of repartidores */}
                    <div className="flex flex-wrap gap-2">
                        {repartidores.length === 0 ? (
                            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No hay repartidores registrados. Agregá uno arriba.
                            </span>
                        ) : (
                            repartidores.map(rep => (
                                <div
                                    key={rep.id || rep.nombre}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                                >
                                    <span className="font-medium">{rep.nombre}</span>
                                    {rep.telefono && (
                                        <span style={{ color: 'var(--color-text-muted)' }}>📞 {rep.telefono}</span>
                                    )}
                                    {rep.id && (
                                        <button
                                            onClick={() => eliminarRepartidor(rep.id)}
                                            className="ml-2 px-2 py-0.5 rounded text-xs"
                                            style={{ background: 'var(--color-danger)', color: 'white' }}
                                            title="Desactivar repartidor"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Zonas Manager Panel */}
            {showZonasManager && (
                <div
                    className="mb-4 p-4 rounded-lg"
                    style={{ background: 'var(--color-bg-secondary)', border: '2px solid var(--color-primary)' }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2 text-lg">
                            🗺️ Gestionar Zonas de Clientes
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCreatingZona(!creatingZona)}
                                className="text-sm px-3 py-1.5 rounded font-medium"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                + Nueva Zona
                            </button>
                            <button
                                onClick={() => setShowZonasManager(false)}
                                className="text-sm px-3 py-1.5 rounded font-medium flex items-center gap-1"
                                style={{ background: '#ef4444', color: 'white' }}
                                title="Cerrar panel de zonas"
                            >
                                ✕ Cerrar
                            </button>
                        </div>
                    </div>

                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        Asigná zonas a tus clientes para organizar mejor las rutas de entrega.
                    </p>

                    {/* Crear nueva zona */}
                    {creatingZona && (
                        <div className="mb-4 p-3 rounded" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={nuevaZonaNombre}
                                    onChange={e => setNuevaZonaNombre(e.target.value)}
                                    placeholder="Nombre de la nueva zona"
                                    className="flex-1 px-3 py-2 rounded border text-sm"
                                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && nuevaZonaNombre.trim()) {
                                            setNuevaZonaCliente(nuevaZonaNombre);
                                            setNuevaZonaNombre('');
                                            setCreatingZona(false);
                                            toastSuccess(`Zona "${nuevaZonaNombre}" lista para asignar`);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (nuevaZonaNombre.trim()) {
                                            setNuevaZonaCliente(nuevaZonaNombre);
                                            setNuevaZonaNombre('');
                                            setCreatingZona(false);
                                            toastSuccess(`Zona "${nuevaZonaNombre}" creada`);
                                        }
                                    }}
                                    className="px-4 py-2 rounded text-sm font-medium"
                                    style={{ background: '#10b981', color: 'white' }}
                                >
                                    Crear
                                </button>
                                <button
                                    onClick={() => {
                                        setCreatingZona(false);
                                        setNuevaZonaNombre('');
                                    }}
                                    className="px-3 py-2 rounded text-sm"
                                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Clientes sin zona primero */}
                    <div className="mb-4">
                        {(() => {
                            const clientesSinZona = clientes.filter(c => !c.zona);
                            const totalClientesSinZona = clientesSinZona.length;
                            const totalPagesSinZona = Math.ceil(totalClientesSinZona / clientesSinZonaPerPage);
                            const startIdx = (clientesSinZonaPage - 1) * clientesSinZonaPerPage;
                            const clientesPaginados = clientesSinZona.slice(startIdx, startIdx + clientesSinZonaPerPage);

                            return (
                                <>
                                    {/* Header con paginación integrada - estilo igual a lista de pedidos */}
                                    <div
                                        className="px-3 py-2 rounded-t-lg flex items-center justify-between"
                                        style={{ background: '#f59e0b', color: 'white' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">⚠️ Clientes sin zona asignada:</span>
                                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                                {totalClientesSinZona} cliente{totalClientesSinZona !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={clientesSinZonaPerPage}
                                                onChange={e => { setClientesSinZonaPerPage(Number(e.target.value)); setClientesSinZonaPage(1); }}
                                                className="px-2 py-1 rounded text-xs"
                                                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <option value={5} style={{ color: 'black' }}>5</option>
                                                <option value={10} style={{ color: 'black' }}>10</option>
                                                <option value={25} style={{ color: 'black' }}>25</option>
                                                <option value={50} style={{ color: 'black' }}>50</option>
                                            </select>
                                            {totalPagesSinZona > 1 && (
                                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                                    pág {clientesSinZonaPage}/{totalPagesSinZona}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {totalClientesSinZona === 0 ? (
                                        <div className="text-sm p-3 rounded-b-lg" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderTop: 'none' }}>
                                            ✓ Todos los clientes tienen zona asignada
                                        </div>
                                    ) : (
                                        <div className="rounded-b-lg overflow-hidden" style={{ border: '1px solid var(--color-border)', borderTop: 'none' }}>
                                            {/* Paginación arriba */}
                                            {totalPagesSinZona > 1 && (
                                                <div className="flex items-center justify-center gap-2 py-2 px-3" style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                                    <button
                                                        onClick={() => setClientesSinZonaPage(p => Math.max(1, p - 1))}
                                                        disabled={clientesSinZonaPage === 1}
                                                        className="px-2 py-1 rounded text-xs"
                                                        style={{ background: clientesSinZonaPage === 1 ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: clientesSinZonaPage === 1 ? 'var(--color-text-muted)' : 'white' }}
                                                    >
                                                        ← Anterior
                                                    </button>
                                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        {startIdx + 1}-{Math.min(startIdx + clientesSinZonaPerPage, totalClientesSinZona)} de {totalClientesSinZona}
                                                    </span>
                                                    <button
                                                        onClick={() => setClientesSinZonaPage(p => Math.min(totalPagesSinZona, p + 1))}
                                                        disabled={clientesSinZonaPage >= totalPagesSinZona}
                                                        className="px-2 py-1 rounded text-xs"
                                                        style={{ background: clientesSinZonaPage >= totalPagesSinZona ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: clientesSinZonaPage >= totalPagesSinZona ? 'var(--color-text-muted)' : 'white' }}
                                                    >
                                                        Siguiente →
                                                    </button>
                                                </div>
                                            )}

                                            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                {clientesPaginados.map(cliente => (
                                                    <div
                                                        key={cliente.id}
                                                        className="flex items-center justify-between px-3 py-2 text-sm"
                                                        style={{ background: 'var(--color-bg)' }}
                                                    >
                                                        <div className="flex-1">
                                                            <span className="font-medium">{cliente.nombre}</span>
                                                            {cliente.direccion && (
                                                                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                    📍 {cliente.direccion}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setEditingClienteZona(cliente.id);
                                                                setNuevaZonaCliente('');
                                                            }}
                                                            className="px-3 py-1 rounded text-xs font-medium whitespace-nowrap ml-2"
                                                            style={{ background: 'var(--color-primary)', color: 'white' }}
                                                        >
                                                            Asignar zona
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Clientes por zona con paginación - Estilo unificado */}
                    <div className="flex flex-col gap-3">
                        {zonasUnicas.length === 0 ? (
                            <div className="text-sm p-3 rounded" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)' }}>
                                No hay zonas asignadas aún. Creá una zona arriba.
                            </div>
                        ) : (
                            <>
                                {/* Header global de zonas */}
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                        {zonasUnicas.length} zona{zonasUnicas.length !== 1 ? 's' : ''} configuradas
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Clientes/zona:</span>
                                            <select
                                                value={clientesPorZonaPage}
                                                onChange={e => setClientesPorZonaPage(Number(e.target.value))}
                                                className="px-2 py-1 rounded border text-xs"
                                                style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Zonas:</span>
                                            <select
                                                value={zonasPerPage}
                                                onChange={e => { setZonasPerPage(Number(e.target.value)); setZonasPage(1); }}
                                                className="px-2 py-1 rounded border text-xs"
                                                style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                            >
                                                <option value={3}>3</option>
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>Todas</option>
                                            </select>
                                        </div>
                                        {zonasUnicas.length > zonasPerPage && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setZonasPage(p => Math.max(1, p - 1))}
                                                    disabled={zonasPage === 1}
                                                    className="px-2 py-1 rounded text-xs"
                                                    style={{
                                                        background: zonasPage === 1 ? 'var(--color-bg-secondary)' : 'var(--color-bg)',
                                                        border: '1px solid var(--color-border)',
                                                        opacity: zonasPage === 1 ? 0.5 : 1
                                                    }}
                                                >
                                                    ←
                                                </button>
                                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    {zonasPage} / {Math.ceil(zonasUnicas.length / zonasPerPage)}
                                                </span>
                                                <button
                                                    onClick={() => setZonasPage(p => Math.min(Math.ceil(zonasUnicas.length / zonasPerPage), p + 1))}
                                                    disabled={zonasPage >= Math.ceil(zonasUnicas.length / zonasPerPage)}
                                                    className="px-2 py-1 rounded text-xs"
                                                    style={{
                                                        background: zonasPage >= Math.ceil(zonasUnicas.length / zonasPerPage) ? 'var(--color-bg-secondary)' : 'var(--color-bg)',
                                                        border: '1px solid var(--color-border)',
                                                        opacity: zonasPage >= Math.ceil(zonasUnicas.length / zonasPerPage) ? 0.5 : 1
                                                    }}
                                                >
                                                    →
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Zonas con estilo igual a pedidos */}
                                {zonasUnicas
                                    .slice((zonasPage - 1) * zonasPerPage, zonasPage * zonasPerPage)
                                    .map(zona => {
                                        const clientesEnZona = clientes.filter(c => c.zona === zona);
                                        const isExpanded = expandedZona === zona;
                                        const currentClientePage = clientesZonaPage[zona] || 1;
                                        const totalClientePages = Math.ceil(clientesEnZona.length / clientesPorZonaPage);
                                        const startIdx = (currentClientePage - 1) * clientesPorZonaPage;
                                        const clientesPaginados = clientesEnZona.slice(startIdx, startIdx + clientesPorZonaPage);

                                        return (
                                            <div key={zona} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                                                {/* Header zona - estilo azul como pedidos */}
                                                <button
                                                    onClick={() => setExpandedZona(isExpanded ? null : zona)}
                                                    className="w-full px-3 py-2 flex items-center justify-between cursor-pointer"
                                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
                                                        <span className="font-semibold text-sm">📍 {zona}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs opacity-80">{clientesEnZona.length} cliente{clientesEnZona.length !== 1 ? 's' : ''}</span>
                                                        {totalClientePages > 1 && isExpanded && (
                                                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                                                · pág {currentClientePage}/{totalClientePages}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Contenido expandido */}
                                                {isExpanded && (
                                                    <>
                                                        {/* Barra de paginación si hay más de 1 página */}
                                                        {totalClientePages > 1 && (
                                                            <div className="flex items-center justify-center gap-2 py-2 px-3" style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setClientesZonaPage({ ...clientesZonaPage, [zona]: Math.max(1, currentClientePage - 1) }); }}
                                                                    disabled={currentClientePage === 1}
                                                                    className="px-2 py-1 rounded text-xs"
                                                                    style={{ background: currentClientePage === 1 ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: currentClientePage === 1 ? 'var(--color-text-muted)' : 'white' }}
                                                                >
                                                                    ← Anterior
                                                                </button>
                                                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                    {startIdx + 1}-{Math.min(startIdx + clientesPorZonaPage, clientesEnZona.length)} de {clientesEnZona.length}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setClientesZonaPage({ ...clientesZonaPage, [zona]: Math.min(totalClientePages, currentClientePage + 1) }); }}
                                                                    disabled={currentClientePage >= totalClientePages}
                                                                    className="px-2 py-1 rounded text-xs"
                                                                    style={{ background: currentClientePage >= totalClientePages ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: currentClientePage >= totalClientePages ? 'var(--color-text-muted)' : 'white' }}
                                                                >
                                                                    Siguiente →
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Lista de clientes */}
                                                        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                            {clientesPaginados.map(cliente => (
                                                                <div
                                                                    key={cliente.id}
                                                                    className="flex items-center justify-between px-3 py-2 text-sm"
                                                                    style={{ background: 'var(--color-bg)' }}
                                                                >
                                                                    <div className="flex-1">
                                                                        <span className="font-medium">{cliente.nombre}</span>
                                                                        {cliente.direccion && (
                                                                            <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                                📍 {cliente.direccion}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingClienteZona(cliente.id);
                                                                            setNuevaZonaCliente(cliente.zona);
                                                                        }}
                                                                        className="px-3 py-1 rounded text-xs whitespace-nowrap ml-2"
                                                                        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                                                                    >
                                                                        Editar
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                            </>
                        )}
                    </div>

                    {/* Edit zona modal overlay */}
                    {editingClienteZona && (
                        <div
                            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                            onClick={() => setEditingClienteZona(null)}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="zona-modal-title"
                        >
                            <div
                                className="p-6 rounded-lg max-w-md w-full mx-4"
                                style={{ background: 'var(--color-bg)' }}
                                onClick={e => e.stopPropagation()}
                            >
                                <h3 id="zona-modal-title" className="font-semibold mb-4">
                                    Asignar zona a {clientes.find(c => c.id === editingClienteZona)?.nombre || 'cliente'}
                                </h3>

                                {/* Zonas predefinidas de Uruguay */}
                                <div className="mb-4">
                                    <label className="text-sm font-medium mb-2 block">
                                        Zonas comunes:
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {zonasPredefinidasUY.map(zona => (
                                            <button
                                                key={zona}
                                                onClick={() => setNuevaZonaCliente(zona)}
                                                className="px-3 py-1 rounded text-sm"
                                                style={{
                                                    background: nuevaZonaCliente === zona ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                                                    color: nuevaZonaCliente === zona ? 'white' : 'var(--color-text)',
                                                    border: '1px solid var(--color-border)'
                                                }}
                                            >
                                                {zona}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom zona input */}
                                <div className="mb-4">
                                    <label className="text-sm font-medium mb-2 block">
                                        O escribí una zona personalizada:
                                    </label>
                                    <input
                                        type="text"
                                        value={nuevaZonaCliente}
                                        onChange={e => setNuevaZonaCliente(e.target.value)}
                                        placeholder="Ej: Las Piedras, Pando, etc."
                                        className="w-full px-3 py-2 rounded border"
                                        style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        onKeyDown={e => e.key === 'Enter' && asignarZonaCliente(editingClienteZona, nuevaZonaCliente)}
                                    />
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => {
                                            setEditingClienteZona(null);
                                            setNuevaZonaCliente('');
                                        }}
                                        className="px-4 py-2 rounded text-sm"
                                        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => asignarZonaCliente(editingClienteZona, nuevaZonaCliente)}
                                        className="px-4 py-2 rounded text-sm font-semibold"
                                        style={{ background: '#10b981', color: 'white' }}
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Shared datalist for repartidores - single instance to avoid duplicate IDs */}
            <datalist id="reps-list-shared">
                {repartidores.map(r => <option key={r.id || r.nombre} value={r.nombre} />)}
            </datalist>

            {/* Bulk Actions Bar - appears when items are selected */}
            {selectedIds.size > 0 && (
                <div
                    className="mb-4 p-3 rounded-lg flex flex-wrap items-center gap-3"
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: 'white',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    <span className="font-semibold">
                        ✓ {selectedIds.size} pedido{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                    </span>

                    <div className="h-6 w-px" style={{ background: 'rgba(255,255,255,0.3)' }}></div>

                    <button
                        onClick={() => bulkChangeEstado('preparando')}
                        className="px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105"
                        style={{ background: '#f59e0b', color: 'white' }}
                    >
                        🔧 Marcar Preparando
                    </button>

                    <button
                        onClick={() => bulkChangeEstado('entregado')}
                        className="px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105"
                        style={{ background: '#10b981', color: 'white' }}
                    >
                        ✅ Marcar Entregado
                    </button>

                    {bulkAssigning ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={bulkRepartidor}
                                onChange={e => setBulkRepartidor(e.target.value)}
                                placeholder="Nombre del repartidor..."
                                className="px-2 py-1 rounded text-sm text-gray-900"
                                autoFocus
                                list="bulk-reps-list"
                            />
                            <datalist id="bulk-reps-list">
                                {repartidores.map(r => <option key={r.id || r.nombre} value={r.nombre} />)}
                            </datalist>
                            <button
                                onClick={bulkAsignarRepartidor}
                                className="px-2 py-1 rounded text-sm"
                                style={{ background: 'white', color: '#3b82f6' }}
                            >
                                ✓
                            </button>
                            <button
                                onClick={() => { setBulkAssigning(false); setBulkRepartidor(''); }}
                                className="px-2 py-1 rounded text-sm"
                                style={{ background: 'rgba(255,255,255,0.2)' }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setBulkAssigning(true)}
                            className="px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105"
                            style={{ background: 'rgba(255,255,255,0.2)' }}
                        >
                            👤 Asignar Repartidor
                        </button>
                    )}

                    <button
                        onClick={() => bulkChangeEstado('cancelado')}
                        className="px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105"
                        style={{ background: '#ef4444', color: 'white' }}
                    >
                        ❌ Cancelar
                    </button>

                    <button
                        onClick={bulkEliminarPedidos}
                        disabled={bulkDeleting}
                        className="px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105"
                        style={{ background: '#991b1b', color: 'white', opacity: bulkDeleting ? 0.7 : 1 }}
                        title="Eliminar pedidos seleccionados (no se pueden recuperar)"
                    >
                        {bulkDeleting ? '⏳ Eliminando...' : '🗑️ Eliminar'}
                    </button>

                    <button
                        onClick={clearSelection}
                        className="ml-auto px-3 py-1.5 rounded text-sm transition-all hover:bg-white/20"
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                        ✕ Cancelar
                    </button>
                </div>
            )}

            {/* Lista de pedidos - SOLO si no está el panel de zonas abierto */}
            {!showZonasManager && (pedidosPorZona.length === 0 ? (
                <div className="text-center py-12 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                    <div className="text-4xl mb-2">📭</div>
                    <div className="font-semibold mb-1">No hay pedidos</div>
                    <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {filtroEstado ? `No hay pedidos "${ESTADOS_PEDIDO[filtroEstado]?.label || filtroEstado}"` : 'Ajustá los filtros'}
                    </div>
                </div>
            ) : (
                <>
                    {/* Paginación de zonas en lista de pedidos */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 px-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                            📍 {pedidosPorZona.length} zona{pedidosPorZona.length !== 1 ? 's' : ''} con pedidos
                        </span>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>Mostrar por zona:</span>
                                <select
                                    value={pedidosDentroZonaPerPage}
                                    onChange={e => { setPedidosDentroZonaPerPage(Number(e.target.value)); setPedidosDentroZonaPage({}); }}
                                    className="px-2 py-1 rounded border text-xs"
                                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    title="Pedidos a mostrar dentro de cada zona"
                                >
                                    <option value={5}>5 pedidos</option>
                                    <option value={10}>10 pedidos</option>
                                    <option value={25}>25 pedidos</option>
                                    <option value={50}>50 pedidos</option>
                                </select>
                            </div>
                            <div className="h-4 w-px" style={{ background: 'var(--color-border)' }}></div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>Ver zonas:</span>
                                <select
                                    value={pedidosZonasPerPage}
                                    onChange={e => { setPedidosZonasPerPage(Number(e.target.value)); setPedidosZonaPage(1); }}
                                    className="px-2 py-1 rounded border text-xs"
                                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    title="Cuántas zonas mostrar a la vez"
                                >
                                    <option value={3}>3 zonas</option>
                                    <option value={5}>5 zonas</option>
                                    <option value={10}>10 zonas</option>
                                    <option value={25}>Todas</option>
                                </select>
                            </div>
                            {pedidosPorZona.length > pedidosZonasPerPage && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPedidosZonaPage(p => Math.max(1, p - 1))}
                                        disabled={pedidosZonaPage === 1}
                                        className="px-2 py-1 rounded text-xs"
                                        style={{
                                            background: pedidosZonaPage === 1 ? 'var(--color-bg-secondary)' : 'var(--color-bg)',
                                            border: '1px solid var(--color-border)',
                                            opacity: pedidosZonaPage === 1 ? 0.5 : 1
                                        }}
                                    >
                                        ←
                                    </button>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {pedidosZonaPage} / {Math.ceil(pedidosPorZona.length / pedidosZonasPerPage)}
                                    </span>
                                    <button
                                        onClick={() => setPedidosZonaPage(p => Math.min(Math.ceil(pedidosPorZona.length / pedidosZonasPerPage), p + 1))}
                                        disabled={pedidosZonaPage >= Math.ceil(pedidosPorZona.length / pedidosZonasPerPage)}
                                        className="px-2 py-1 rounded text-xs"
                                        style={{
                                            background: pedidosZonaPage >= Math.ceil(pedidosPorZona.length / pedidosZonasPerPage) ? 'var(--color-bg-secondary)' : 'var(--color-bg)',
                                            border: '1px solid var(--color-border)',
                                            opacity: pedidosZonaPage >= Math.ceil(pedidosPorZona.length / pedidosZonasPerPage) ? 0.5 : 1
                                        }}
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {pedidosPorZona
                        .slice((pedidosZonaPage - 1) * pedidosZonasPerPage, pedidosZonaPage * pedidosZonasPerPage)
                        .map(([zona, pedidosZona]) => {
                            const isZonaExpanded = expandedPedidoZona === zona || expandedPedidoZona === null;
                            const currentPedidoPage = pedidosDentroZonaPage[zona] || 1;
                            const totalPedidoPages = Math.ceil(pedidosZona.length / pedidosDentroZonaPerPage);
                            const pedidosZonaPaginados = pedidosZona.slice(
                                (currentPedidoPage - 1) * pedidosDentroZonaPerPage,
                                currentPedidoPage * pedidosDentroZonaPerPage
                            );

                            // Calculate progress for this zone
                            const zoneProgress = calcZoneProgress(pedidosZona);

                            return (
                                <div key={zona} className="mb-4 rounded-lg overflow-hidden shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
                                    {/* Header zona - diseño horizontal limpio */}
                                    <button
                                        onClick={() => setExpandedPedidoZona(expandedPedidoZona === zona ? null : zona)}
                                        className="w-full cursor-pointer hover:brightness-105 transition-all"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        {/* Contenedor con dos secciones */}
                                        <div className="px-5 py-4 flex flex-col gap-3.5">
                                            {/* Fila 1: Icon + Nombre + Badges */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-lg flex-shrink-0">{isZonaExpanded ? '▼' : '▶'}</span>
                                                    <span className="font-bold text-lg">📍 {zona}</span>
                                                </div>

                                                {/* Badges compactos */}
                                                <div className="flex items-center gap-2.5 flex-wrap justify-end">
                                                    {zoneProgress.pendiente > 0 && (
                                                        <span
                                                            className="px-2 py-0.5 rounded text-xs font-semibold cursor-help"
                                                            style={{ background: 'rgba(59,130,246,0.4)' }}
                                                            title={`${zoneProgress.pendiente} pedido${zoneProgress.pendiente !== 1 ? 's' : ''} esperando`}
                                                        >
                                                            📝 {zoneProgress.pendiente}
                                                        </span>
                                                    )}
                                                    {zoneProgress.preparando > 0 && (
                                                        <span
                                                            className="px-2 py-0.5 rounded text-xs font-semibold cursor-help"
                                                            style={{ background: 'rgba(245,158,11,0.4)' }}
                                                            title={`${zoneProgress.preparando} preparando`}
                                                        >
                                                            🔧 {zoneProgress.preparando}
                                                        </span>
                                                    )}
                                                    {zoneProgress.entregado > 0 && (
                                                        <span
                                                            className="px-2 py-0.5 rounded text-xs font-semibold cursor-help"
                                                            style={{ background: 'rgba(16,185,129,0.4)' }}
                                                            title={`${zoneProgress.entregado} entregados`}
                                                        >
                                                            ✅ {zoneProgress.entregado}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fila 2: Resumen descriptivo */}
                                            <div className="text-sm opacity-95 pl-7 font-medium">
                                                {zoneProgress.total} pedidos • {zoneProgress.pendiente} pendientes • {zoneProgress.completedPercent}% entregado
                                            </div>

                                            {/* Barra de progreso - fila 3 */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <div
                                                    className="flex-1 h-2 rounded-full overflow-hidden cursor-help"
                                                    style={{ background: 'rgba(255,255,255,0.25)' }}
                                                    title={`${zoneProgress.entregado}/${zoneProgress.total} pedidos entregados en esta zona`}
                                                >
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${zoneProgress.completedPercent}%`,
                                                            background: zoneProgress.completedPercent === 100 ? '#10b981' : '#fbbf24'
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    className="text-xs font-semibold cursor-help"
                                                    style={{ minWidth: '32px' }}
                                                    title={`${zoneProgress.completedPercent}% completado`}
                                                >
                                                    {zoneProgress.completedPercent}%
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Pedidos - Vista compacta o expandida */}
                                    {isZonaExpanded && (
                                        <>
                                            {/* Paginación dentro de la zona */}
                                            {totalPedidoPages > 1 && (
                                                <div className="flex items-center justify-center gap-2 py-2 px-3" style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPedidosDentroZonaPage({ ...pedidosDentroZonaPage, [zona]: Math.max(1, currentPedidoPage - 1) }); }}
                                                        disabled={currentPedidoPage === 1}
                                                        className="px-2 py-1 rounded text-xs"
                                                        style={{ background: currentPedidoPage === 1 ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: currentPedidoPage === 1 ? 'var(--color-text-muted)' : 'white' }}
                                                    >
                                                        ← Anterior
                                                    </button>
                                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        {(currentPedidoPage - 1) * pedidosDentroZonaPerPage + 1}-{Math.min(currentPedidoPage * pedidosDentroZonaPerPage, pedidosZona.length)} de {pedidosZona.length}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPedidosDentroZonaPage({ ...pedidosDentroZonaPage, [zona]: Math.min(totalPedidoPages, currentPedidoPage + 1) }); }}
                                                        disabled={currentPedidoPage >= totalPedidoPages}
                                                        className="px-2 py-1 rounded text-xs"
                                                        style={{ background: currentPedidoPage >= totalPedidoPages ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: currentPedidoPage >= totalPedidoPages ? 'var(--color-text-muted)' : 'white' }}
                                                    >
                                                        Siguiente →
                                                    </button>
                                                </div>
                                            )}

                                            {vistaCompacta ? (
                                                // Vista COMPACTA - Más pedidos visibles, acciones en hover
                                                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                    {pedidosZonaPaginados.map((p, rowIndex) => {
                                                        const estado = p.estado || 'pendiente';
                                                        const estadoInfo = getEstadoInfo(estado);
                                                        const siguiente = getSiguienteEstado(estado);
                                                        const productosResumen = p.productos?.slice(0, 2).map(prod => `${prod.nombre?.substring(0, 15) || '?'}${(prod.nombre?.length || 0) > 15 ? '...' : ''} x${prod.cantidad}`).join(' • ') || '';
                                                        const masProductos = (p.productos?.length || 0) > 2 ? ` +${(p.productos?.length || 0) - 2} más` : '';
                                                        const isSelected = selectedIds.has(p.id);
                                                        const isHovered = hoveredPedidoId === p.id;
                                                        const showActions = showActionsForId === p.id;
                                                        const isEvenRow = rowIndex % 2 === 0;

                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className="px-3 py-2.5 flex items-center gap-3 transition-all cursor-pointer group"
                                                                style={{
                                                                    background: isSelected ? 'var(--color-primary-bg, rgba(59, 130, 246, 0.15))' : isHovered ? 'var(--color-bg-hover, var(--color-bg-secondary))' : isEvenRow ? 'var(--color-bg)' : 'var(--color-bg-secondary)',
                                                                    borderLeft: isSelected ? '4px solid var(--color-primary, #3b82f6)' : '4px solid transparent'
                                                                }}
                                                                onMouseEnter={() => setHoveredPedidoId(p.id)}
                                                                onMouseLeave={() => setHoveredPedidoId(null)}
                                                            >
                                                                {/* Checkbox for bulk selection */}
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleSelection(p.id)}
                                                                    className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                                                                    aria-label={`Seleccionar pedido de ${p.cliente?.nombre}`}
                                                                />

                                                                {/* Cliente + Estado + Producto (single line) */}
                                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                                    <span className="font-semibold text-sm truncate max-w-[150px]">{p.cliente?.nombre || 'Cliente'}</span>
                                                                    <span className="text-xs opacity-60 hidden sm:inline">•</span>
                                                                    <span className="text-xs truncate max-w-[180px] hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>
                                                                        {productosResumen}{masProductos}
                                                                    </span>
                                                                    <span className="px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap ml-auto shadow-sm" style={{ background: estadoInfo.bg, color: estadoInfo.color, border: `1px solid ${estadoInfo.color}20` }}>
                                                                        {estadoInfo.icon} {estadoInfo.label}
                                                                    </span>
                                                                    {p.repartidor && (
                                                                        <span className="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap hidden md:inline shadow-sm" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #4338ca20' }}>
                                                                            👤 {p.repartidor}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Action menu - visible on hover or touch */}
                                                                <div className="flex gap-1 items-center flex-shrink-0 relative">
                                                                    {asignandoRepartidor === p.id ? (
                                                                        <div className="flex gap-1 items-center">
                                                                            <input
                                                                                type="text"
                                                                                value={nuevoRepartidor}
                                                                                onChange={e => setNuevoRepartidor(e.target.value)}
                                                                                onKeyDown={e => e.key === 'Enter' && asignarRepartidor(p.id, nuevoRepartidor)}
                                                                                placeholder="Nombre..."
                                                                                className="px-2 py-1 border rounded text-xs w-24"
                                                                                autoFocus
                                                                                list="reps-list-shared"
                                                                            />
                                                                            <button onClick={() => asignarRepartidor(p.id, nuevoRepartidor)} className="px-2 py-1 rounded text-white text-xs" style={{ background: '#10b981' }}>✓</button>
                                                                            <button onClick={() => { setAsignandoRepartidor(null); setNuevoRepartidor(''); }} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-bg-secondary)' }}>✕</button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {/* Dropdown toggle button - always visible for discoverability */}
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setShowActionsForId(showActions ? null : p.id); }}
                                                                                className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all hover:scale-105"
                                                                                style={{
                                                                                    background: showActions ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                                                                                    color: showActions ? 'white' : 'var(--color-text)',
                                                                                    border: '1px solid var(--color-border)',
                                                                                    boxShadow: isHovered || showActions ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                                                                }}
                                                                            >
                                                                                ⋮ Acciones
                                                                            </button>

                                                                            {/* Dropdown menu */}
                                                                            {showActions && (
                                                                                <div
                                                                                    className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg py-1 min-w-[160px]"
                                                                                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                                                                                    onMouseLeave={() => setShowActionsForId(null)}
                                                                                >
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setAsignandoRepartidor(p.id); setShowActionsForId(null); }}
                                                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                                                                                        style={{ color: 'var(--color-text)' }}
                                                                                    >
                                                                                        👤 {p.repartidor ? 'Cambiar repartidor' : 'Asignar repartidor'}
                                                                                    </button>
                                                                                    {siguiente && (
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); cambiarEstado(p.id, siguiente); setShowActionsForId(null); }}
                                                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                                                                                            style={{ color: ESTADOS_PEDIDO[siguiente].color }}
                                                                                        >
                                                                                            {ESTADOS_PEDIDO[siguiente].icon} Marcar {ESTADOS_PEDIDO[siguiente].label}
                                                                                        </button>
                                                                                    )}
                                                                                    <div className="border-t my-1" style={{ borderColor: 'var(--color-border)' }}></div>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); eliminarPedido(p.id, p.cliente?.nombre); setShowActionsForId(null); }}
                                                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2"
                                                                                        style={{ color: '#ef4444' }}
                                                                                    >
                                                                                        🗑️ Eliminar pedido
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                // Vista EXPANDIDA - Card-based layout con más detalles
                                                <div className="p-2 grid gap-2 sm:grid-cols-1 md:grid-cols-2">
                                                    {pedidosZonaPaginados.map((p, rowIndex) => {
                                                        const estado = p.estado || 'pendiente';
                                                        const estadoInfo = getEstadoInfo(estado);
                                                        const siguiente = getSiguienteEstado(estado);
                                                        const isSelected = selectedIds.has(p.id);

                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className="p-4 rounded-lg transition-all hover:shadow-md"
                                                                style={{
                                                                    border: isSelected ? '2px solid #3b82f6' : '1px solid var(--color-border)',
                                                                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : rowIndex % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-secondary)'
                                                                }}
                                                            >
                                                                {/* Card Header: Checkbox + Cliente + Estado */}
                                                                <div className="flex items-center gap-3 mb-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleSelection(p.id)}
                                                                        className="w-5 h-5 rounded cursor-pointer accent-blue-600"
                                                                        aria-label={`Seleccionar pedido de ${p.cliente?.nombre}`}
                                                                    />
                                                                    <span className="font-bold text-base flex-1">{p.cliente?.nombre || 'Cliente'}</span>
                                                                    <span className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm" style={{ background: estadoInfo.bg, color: estadoInfo.color, border: `1px solid ${estadoInfo.color}30` }}>
                                                                        {estadoInfo.icon} {estadoInfo.label}
                                                                    </span>
                                                                </div>

                                                                {/* Card Body: Contact Info */}
                                                                <div className="flex flex-wrap gap-3 text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {p.cliente?.direccion && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span>📍</span>
                                                                            <span>{p.cliente.direccion}</span>
                                                                        </span>
                                                                    )}
                                                                    {p.cliente?.telefono && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span>📞</span>
                                                                            <span>{p.cliente.telefono}</span>
                                                                        </span>
                                                                    )}
                                                                    {p.repartidor && (
                                                                        <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                                                                            👤 {p.repartidor}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Card Body: Productos */}
                                                                <div className="text-sm p-3 rounded-lg mb-3" style={{ background: 'var(--color-bg-tertiary)' }}>
                                                                    <div className="font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>📦 Productos:</div>
                                                                    {p.productos?.slice(0, 4).map((prod, i) => (
                                                                        <div key={i} className="flex justify-between py-0.5">
                                                                            <span>{prod.nombre}</span>
                                                                            <span className="font-semibold">×{prod.cantidad}</span>
                                                                        </div>
                                                                    ))}
                                                                    {p.productos?.length > 4 && <div className="opacity-60 text-xs mt-1">+{p.productos.length - 4} productos más</div>}
                                                                </div>

                                                                {/* Card Footer: Acciones */}
                                                                <div className="flex gap-2 flex-wrap pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                                                                    {asignandoRepartidor === p.id ? (
                                                                        <div className="flex gap-1 items-center">
                                                                            <input
                                                                                type="text"
                                                                                value={nuevoRepartidor}
                                                                                onChange={e => setNuevoRepartidor(e.target.value)}
                                                                                onKeyDown={e => e.key === 'Enter' && asignarRepartidor(p.id, nuevoRepartidor)}
                                                                                placeholder="Nombre..."
                                                                                className="px-2 py-1 border rounded text-sm w-32"
                                                                                autoFocus
                                                                                list="reps-list-shared"
                                                                            />
                                                                            <button onClick={() => asignarRepartidor(p.id, nuevoRepartidor)} className="px-3 py-1.5 rounded text-white text-sm font-medium" style={{ background: '#10b981' }}>✓</button>
                                                                            <button onClick={() => { setAsignandoRepartidor(null); setNuevoRepartidor(''); }} className="px-3 py-1.5 rounded text-sm" style={{ background: 'var(--color-bg-secondary)' }}>✕</button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setAsignandoRepartidor(p.id)}
                                                                            className="px-3 py-1.5 rounded-md text-sm font-medium transition-all hover:shadow"
                                                                            style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                                                                        >
                                                                            👤 {p.repartidor ? 'Cambiar' : 'Asignar'}
                                                                        </button>
                                                                    )}

                                                                    {siguiente && (
                                                                        <button
                                                                            onClick={() => cambiarEstado(p.id, siguiente)}
                                                                            className="px-3 py-1.5 rounded-md text-sm font-semibold text-white transition-all hover:shadow-md hover:scale-105"
                                                                            style={{ background: ESTADOS_PEDIDO[siguiente].color }}
                                                                        >
                                                                            {ESTADOS_PEDIDO[siguiente].icon} Marcar {ESTADOS_PEDIDO[siguiente].label}
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={() => eliminarPedido(p.id, p.cliente?.nombre)}
                                                                        className="px-3 py-1.5 rounded-md text-sm font-medium ml-auto transition-all hover:shadow"
                                                                        style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}
                                                                    >
                                                                        🗑️ Eliminar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}

                    {/* Paginación de zonas al final */}
                    {pedidosPorZona.length > pedidosZonasPerPage && (
                        <div className="flex items-center justify-center gap-3 mt-4 p-3 rounded" style={{ background: 'var(--color-bg-secondary)' }}>
                            <button
                                onClick={() => setPedidosZonaPage(p => Math.max(1, p - 1))}
                                disabled={pedidosZonaPage === 1}
                                className="px-3 py-1 rounded text-sm"
                                style={{ background: pedidosZonaPage === 1 ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: pedidosZonaPage === 1 ? 'var(--color-text-muted)' : 'white' }}
                            >
                                ← Anterior
                            </button>
                            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Zonas {(pedidosZonaPage - 1) * pedidosZonasPerPage + 1}-{Math.min(pedidosZonaPage * pedidosZonasPerPage, pedidosPorZona.length)} de {pedidosPorZona.length}
                            </span>
                            <button
                                onClick={() => setPedidosZonaPage(p => Math.min(Math.ceil(pedidosPorZona.length / pedidosZonasPerPage), p + 1))}
                                disabled={pedidosZonaPage >= Math.ceil(pedidosPorZona.length / pedidosZonasPerPage)}
                                className="px-3 py-1 rounded text-sm"
                                style={{ background: pedidosZonaPage >= Math.ceil(pedidosPorZona.length / pedidosZonasPerPage) ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: pedidosZonaPage >= Math.ceil(pedidosPorZona.length / pedidosZonasPerPage) ? 'var(--color-text-muted)' : 'white' }}
                            >
                                Siguiente →
                            </button>
                        </div>
                    )}
                </>
            ))}
        </div>
    );
}
// Build trigger: 1768080262
