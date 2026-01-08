import { useState, useEffect, useMemo } from 'react';
import { authFetchJson, authFetch } from '../authFetch';
import { toastSuccess, toastError } from '../toast';
import HelpBanner from './HelpBanner';

// Estados de pedido workflow
const ESTADOS_PEDIDO = {
    tomado: { label: 'Tomado', icon: '📝', color: '#3b82f6', bg: '#dbeafe' },
    preparando: { label: 'Preparando', icon: '🔧', color: '#f59e0b', bg: '#fef3c7' },
    listo: { label: 'Listo', icon: '✅', color: '#10b981', bg: '#d1fae5' },
    entregado: { label: 'Entregado', icon: '🚚', color: '#6b7280', bg: '#e5e7eb' },
    cancelado: { label: 'Cancelado', icon: '❌', color: '#ef4444', bg: '#fee2e2' }
};

export default function HojaRuta() {
    const [pedidos, setPedidos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [repartidores, setRepartidores] = useState([]);
    const [filtroRepartidor, setFiltroRepartidor] = useState('');
    const [filtroZona, setFiltroZona] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [nuevoRepartidor, setNuevoRepartidor] = useState('');
    const [asignandoRepartidor, setAsignandoRepartidor] = useState(null);
    const [generandoPDF, setGenerandoPDF] = useState(false);

    // Paginación - default 25 para ver más
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Vista compacta toggle
    const [vistaCompacta, setVistaCompacta] = useState(true);

    useEffect(() => {
        cargarDatos();
    }, []);

    // Reset página cuando cambian filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [filtroEstado, filtroZona, filtroRepartidor]);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [pedRes, cliRes] = await Promise.all([
                authFetchJson(`${import.meta.env.VITE_API_URL}/pedidos`),
                authFetchJson(`${import.meta.env.VITE_API_URL}/clientes`)
            ]);

            if (pedRes.res.ok) {
                const pedidosData = Array.isArray(pedRes.data) ? pedRes.data : [];
                setPedidos(pedidosData);
                const reps = [...new Set(pedidosData.map(p => p.repartidor).filter(Boolean))];
                setRepartidores(reps);
            }

            if (cliRes.res.ok) {
                const cliData = cliRes.data;
                if (cliData.data) setClientes(cliData.data);
                else setClientes(Array.isArray(cliData) ? cliData : []);
            }
        } catch (e) {
            console.error('Error cargando datos:', e);
        } finally {
            setLoading(false);
        }
    };

    const getCliente = (clienteId) => clientes.find(c => c.id === clienteId) || {};

    const zonasUnicas = useMemo(() => {
        const zonas = [...new Set(clientes.map(c => c.zona).filter(Boolean))];
        return zonas.sort();
    }, [clientes]);

    // Filtrar pedidos (excluir entregados y cancelados por defecto)
    const pedidosFiltrados = useMemo(() => {
        return pedidos.filter(p => {
            const estado = p.estado || 'tomado';
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
    }, [pedidos, filtroEstado, filtroRepartidor, filtroZona, clientes]);

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
                    estado: pedidos.find(p => p.id === pedidoId)?.estado || 'tomado',
                    repartidor
                })
            });

            if (res.ok) {
                toastSuccess(`Repartidor: ${repartidor}`);
                await cargarDatos();
                if (!repartidores.includes(repartidor)) {
                    setRepartidores([...repartidores, repartidor]);
                }
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

    // Contadores
    const contadores = {
        tomado: pedidos.filter(p => (p.estado || 'tomado') === 'tomado').length,
        preparando: pedidos.filter(p => p.estado === 'preparando').length,
        listo: pedidos.filter(p => p.estado === 'listo').length,
        entregado: pedidos.filter(p => p.estado === 'entregado').length,
    };

    // Siguiente estado en el workflow
    const getSiguienteEstado = (estadoActual) => {
        const flujo = { 'tomado': 'preparando', 'preparando': 'listo', 'listo': 'entregado' };
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

            {/* Ayuda colapsable - SIN tip de paginación */}
            <HelpBanner
                title="¿Cómo usar la Hoja de Ruta?"
                icon="🚚"
                items={[
                    { label: 'Filtrar por estado', text: 'Clickeá las tarjetas de colores (Tomado, Preparando, etc.) para ver solo esos pedidos. Los números muestran cuántos hay en cada estado.' },
                    { label: 'Asignar repartidores', text: 'Cada pedido tiene un selector "👤 Asignar Repartidor". Elegí el nombre y se guarda automáticamente. Los pedidos sin asignar aparecen primero.' },
                    { label: 'Cambiar estados', text: 'Usá los botones de cada pedido para avanzar: Tomar → Preparar → Listo → Entregar. También podés cancelar si es necesario.' },
                    { label: 'Generar PDF', text: 'Seleccioná un repartidor y hacé clic en "📄 Generar PDF" para crear una hoja de ruta imprimible con todos sus pedidos, agrupados por zona.' },
                    { label: 'Organización', text: 'Los pedidos están agrupados por zona para optimizar la ruta de entrega.' }
                ]}
            />

            {/* Stats Cards - Clickeables como filtros */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                {['tomado', 'preparando', 'listo', 'entregado'].map(estado => {
                    const info = ESTADOS_PEDIDO[estado];
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
            <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-lg items-center" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
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
                        <option key={rep} value={rep}>{rep}</option>
                    ))}
                </select>

                {(filtroEstado || filtroZona || filtroRepartidor) && (
                    <button
                        onClick={() => { setFiltroEstado(''); setFiltroZona(''); setFiltroRepartidor(''); }}
                        className="px-3 py-2 text-sm rounded"
                        style={{ background: 'var(--color-danger)', color: 'white' }}
                    >
                        ✕ Limpiar
                    </button>
                )}

                {/* Separador */}
                <div className="h-8 w-px mx-2" style={{ background: 'var(--color-border)' }}></div>

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

            {/* Lista de pedidos */}
            {pedidosPorZona.length === 0 ? (
                <div className="text-center py-12 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                    <div className="text-4xl mb-2">📭</div>
                    <div className="font-semibold mb-1">No hay pedidos</div>
                    <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {filtroEstado ? `No hay pedidos "${ESTADOS_PEDIDO[filtroEstado].label}"` : 'Ajustá los filtros'}
                    </div>
                </div>
            ) : (
                <>
                    {pedidosPorZona.map(([zona, pedidosZona]) => (
                        <div key={zona} className="mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                            {/* Header zona */}
                            <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'var(--color-primary)', color: 'white' }}>
                                <span className="font-semibold text-sm">📍 {zona}</span>
                                <span className="text-xs opacity-80">{pedidosZona.length} pedido{pedidosZona.length !== 1 ? 's' : ''}</span>
                            </div>

                            {/* Pedidos - Vista compacta o expandida */}
                            {vistaCompacta ? (
                                // Vista COMPACTA - Más pedidos visibles
                                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                    {pedidosZona.map((p) => {
                                        const estado = p.estado || 'tomado';
                                        const estadoInfo = ESTADOS_PEDIDO[estado];
                                        const siguiente = getSiguienteEstado(estado);
                                        const productosResumen = p.productos?.slice(0, 2).map(prod => `${prod.nombre.substring(0, 15)}${prod.nombre.length > 15 ? '...' : ''} x${prod.cantidad}`).join(' • ') || '';
                                        const masProductos = (p.productos?.length || 0) > 2 ? ` +${p.productos.length - 2} más` : '';

                                        return (
                                            <div key={p.id} className="px-3 py-2 flex items-center gap-3" style={{ background: 'var(--color-bg)' }}>
                                                {/* Cliente + Estado */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm truncate">{p.cliente?.nombre || 'Cliente'}</span>
                                                        <span className="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ background: estadoInfo.bg, color: estadoInfo.color }}>
                                                            {estadoInfo.icon} {estadoInfo.label}
                                                        </span>
                                                        {p.repartidor && (
                                                            <span className="px-1.5 py-0.5 rounded text-xs whitespace-nowrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                                                                👤 {p.repartidor}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                        {p.cliente?.direccion && <span>📍 {p.cliente.direccion.substring(0, 30)}{p.cliente.direccion.length > 30 ? '...' : ''}</span>}
                                                        {p.cliente?.telefono && <span className="ml-2">📞 {p.cliente.telefono}</span>}
                                                    </div>
                                                    <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {productosResumen}{masProductos}
                                                    </div>
                                                </div>

                                                {/* Acciones */}
                                                <div className="flex gap-1 items-center flex-shrink-0">
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
                                                                list="reps-list"
                                                            />
                                                            <datalist id="reps-list">
                                                                {repartidores.map(r => <option key={r} value={r} />)}
                                                            </datalist>
                                                            <button onClick={() => asignarRepartidor(p.id, nuevoRepartidor)} className="px-2 py-1 rounded text-white text-xs" style={{ background: '#10b981' }}>✓</button>
                                                            <button onClick={() => { setAsignandoRepartidor(null); setNuevoRepartidor(''); }} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-bg-secondary)' }}>✕</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setAsignandoRepartidor(p.id)}
                                                            className="px-2 py-1 rounded text-xs"
                                                            style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
                                                        >
                                                            👤 {p.repartidor ? 'Cambiar' : 'Asignar'}
                                                        </button>
                                                    )}

                                                    {siguiente && (
                                                        <button
                                                            onClick={() => cambiarEstado(p.id, siguiente)}
                                                            className="px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
                                                            style={{ background: ESTADOS_PEDIDO[siguiente].color }}
                                                        >
                                                            {ESTADOS_PEDIDO[siguiente].icon} Marcar {ESTADOS_PEDIDO[siguiente].label}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // Vista EXPANDIDA - Más detalles
                                pedidosZona.map((p) => {
                                    const estado = p.estado || 'tomado';
                                    const estadoInfo = ESTADOS_PEDIDO[estado];
                                    const siguiente = getSiguienteEstado(estado);

                                    return (
                                        <div key={p.id} className="p-3 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                                            {/* Línea 1: Cliente + Estado + Repartidor */}
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-semibold">{p.cliente?.nombre || 'Cliente'}</span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: estadoInfo.bg, color: estadoInfo.color }}>
                                                    {estadoInfo.icon} {estadoInfo.label}
                                                </span>
                                                {p.repartidor && (
                                                    <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                                                        👤 {p.repartidor}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Línea 2: Dirección y teléfono */}
                                            <div className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                {p.cliente?.direccion && <span>📍 {p.cliente.direccion}</span>}
                                                {p.cliente?.telefono && <span className="ml-3">📞 {p.cliente.telefono}</span>}
                                            </div>

                                            {/* Línea 3: Productos */}
                                            <div className="text-xs p-2 rounded mb-2" style={{ background: 'var(--color-bg-secondary)' }}>
                                                {p.productos?.slice(0, 4).map((prod, i) => (
                                                    <span key={i}>{prod.nombre} x{prod.cantidad}{i < Math.min(p.productos.length, 4) - 1 ? ' • ' : ''}</span>
                                                ))}
                                                {p.productos?.length > 4 && <span className="opacity-60"> +{p.productos.length - 4} más</span>}
                                            </div>

                                            {/* Línea 4: Acciones */}
                                            <div className="flex gap-2 flex-wrap">
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
                                                            list="reps-list"
                                                        />
                                                        <datalist id="reps-list">
                                                            {repartidores.map(r => <option key={r} value={r} />)}
                                                        </datalist>
                                                        <button onClick={() => asignarRepartidor(p.id, nuevoRepartidor)} className="px-2 py-1 rounded text-white text-sm" style={{ background: '#10b981' }}>✓</button>
                                                        <button onClick={() => { setAsignandoRepartidor(null); setNuevoRepartidor(''); }} className="px-2 py-1 rounded text-sm" style={{ background: 'var(--color-bg-secondary)' }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setAsignandoRepartidor(p.id)}
                                                        className="px-3 py-1 rounded text-sm"
                                                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
                                                    >
                                                        👤 {p.repartidor ? 'Cambiar' : 'Asignar'}
                                                    </button>
                                                )}

                                                {siguiente && (
                                                    <button
                                                        onClick={() => cambiarEstado(p.id, siguiente)}
                                                        className="px-3 py-1 rounded text-sm font-medium text-white"
                                                        style={{ background: ESTADOS_PEDIDO[siguiente].color }}
                                                    >
                                                        {ESTADOS_PEDIDO[siguiente].icon} Marcar {ESTADOS_PEDIDO[siguiente].label}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ))}

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 p-3 rounded" style={{ background: 'var(--color-bg-secondary)' }}>
                            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                {startIndex + 1}-{Math.min(startIndex + itemsPerPage, pedidosFiltrados.length)} de {pedidosFiltrados.length}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 rounded text-sm"
                                    style={{ background: currentPage === 1 ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: currentPage === 1 ? 'var(--color-text-muted)' : 'white' }}
                                >
                                    ← Anterior
                                </button>
                                <span className="px-3 py-1 text-sm">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 rounded text-sm"
                                    style={{ background: currentPage === totalPages ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: currentPage === totalPages ? 'var(--color-text-muted)' : 'white' }}
                                >
                                    Siguiente →
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
