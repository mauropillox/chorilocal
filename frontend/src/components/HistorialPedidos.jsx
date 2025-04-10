import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export default function HistorialPedidos() {
  // ────── state ──────
  const [pedidos, setPedidos] = useState([]);
  const [mostrarGenerados, setMostrarGenerados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSel, setUsuarioSel] = useState('');
  const [perfil, setPerfil] = useState({ username: '', rol: '' });
  const [loadingAccion, setLoadingAccion] = useState(false);
  const pedidosPorPagina = 10;

  // ────── efectos ──────
  useEffect(() => {
    cargarPerfil();
    cargarPedidos();
  }, [mostrarGenerados]);

  const cargarPerfil = async () => {
    const r = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/me`);
    if (r.ok) {
      const d = await r.json();
      setPerfil({ username: d.username, rol: d.rol });
    }
  };

  const cargarPedidos = async () => {
    setCargando(true);
    const tipo = mostrarGenerados ? 'generados' : 'pendientes';
    try {
      const r = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos/${tipo}`);
      if (r.ok) {
        const d = await r.json();
        setPedidos(d.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        // lista única de usuarios (para el filtro admin)
        const u = [...new Set(d.map(p => p.creado_por).filter(Boolean))];
        setUsuarios(u);
      } else toast.error('Error al cargar pedidos');
    } catch {
      toast.error('Error de red');
    } finally {
      setCargando(false);
    }
  };

  // ────── filtros ──────
  const pedidosFiltrados = pedidos.filter(p => {
    if (perfil.rol !== 'admin') return p.creado_por === perfil.username;
    if (usuarioSel) return p.creado_por === usuarioSel;
    return true;
  });

  // ────── acciones ──────
  const marcarGenerado = async id => {
    setLoadingAccion(true);
    const r = await fetchConToken(`/pedidos/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_generado: true })
    });
    r.ok ? toast.success(`Pedido #${id} marcado como generado`) : toast.error('Error');
    await cargarPedidos();
    setLoadingAccion(false);
  };

  const eliminarPedido = async id => {
    if (!confirm('¿Eliminar pedido?')) return;
    setLoadingAccion(true);
    const r = await fetchConToken(`/pedidos/${id}`, { method: 'DELETE' });
    r.ok ? toast.success('Pedido eliminado') : toast.error('Error');
    await cargarPedidos();
    setLoadingAccion(false);
  };

  // ────── exportar ──────
  const exportarExcel = () => {
    if (pedidosFiltrados.length === 0) return toast.info('Sin datos');
    const rows = pedidosFiltrados.flatMap(p =>
      p.productos.map(pr => ({
        Pedido: `#${p.id}`,
        Cliente: p.cliente?.nombre ?? '',
        Fecha: new Date(p.fecha).toLocaleString(),
        Producto: pr.nombre,
        Cantidad: pr.cantidad,
        Tipo: pr.tipo,
        Usuario: p.creado_por
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const blob = new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]);
    saveAs(blob, `pedidos_${mostrarGenerados ? 'generados' : 'pendientes'}.xlsx`);
  };

  // ────── paginación ─────
  const totalPags = Math.ceil(pedidosFiltrados.length / pedidosPorPagina);
  const paginaDatos = pedidosFiltrados.slice((pagina - 1) * pedidosPorPagina, pagina * pedidosPorPagina);

  // ────── UI ─────
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-blue-600 mb-4">Historial de Pedidos</h2>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <button onClick={() => setMostrarGenerados(false)}
          className={`px-4 py-1 rounded ${!mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Pendientes</button>
        <button onClick={() => setMostrarGenerados(true)}
          className={`px-4 py-1 rounded ${mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Generados</button>

        {perfil.rol === 'admin' && (
          <select value={usuarioSel} onChange={e => setUsuarioSel(e.target.value)} className="border p-1 rounded">
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u} value={u}>{u === perfil.username ? '🧍 Mis pedidos' : u}</option>
            ))}
          </select>
        )}

        <button onClick={exportarExcel}
          className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center">
          📊 Exportar Excel
        </button>
      </div>

      {/* Lista */}
      {cargando ? <p>Cargando…</p> : paginaDatos.length === 0 ? <p>No hay pedidos.</p> : (
        <>
          {paginaDatos.map(p => (
            <div key={p.id} className="bg-white shadow rounded p-4 mb-4">
              <p className="font-semibold">Pedido #{p.id}</p>
              {perfil.rol === 'admin' && <p className="text-sm text-purple-600">Creado por: {p.creado_por}</p>}
              <p>Cliente: {p.cliente?.nombre ?? '—'}</p>
              <p>Fecha: {new Date(p.fecha).toLocaleString()}</p>
              {p.observaciones && <p>Obs.: {p.observaciones}</p>}
              <ul className="list-disc pl-6 mt-2 text-sm">
                {p.productos.map((pr, i) => (
                  <li key={i}>{pr.nombre} - {pr.cantidad} {pr.tipo}</li>
                ))}
              </ul>

              {!mostrarGenerados && (
                <div className="flex gap-2 mt-3">
                  <button disabled={loadingAccion} onClick={() => marcarGenerado(p.id)}
                    className="bg-green-600 text-white px-2 py-1 rounded text-sm">Marcar generado</button>
                  <button disabled={loadingAccion} onClick={() => eliminarPedido(p.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded text-sm">Eliminar</button>
                </div>
              )}
            </div>
          ))}

          {/* Paginación */}
          <div className="flex justify-center gap-2">
            <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}
              className="px-3 py-1 bg-gray-200 rounded">Anterior</button>
            <span>{pagina}</span>
            <button disabled={pagina === totalPags} onClick={() => setPagina(pagina + 1)}
              className="px-3 py-1 bg-gray-200 rounded">Siguiente</button>
          </div>
        </>
      )}
    </div>
  );
}
