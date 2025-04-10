import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export default function HistorialPedidos() {
  /* ───────────── state ───────────── */
  const [pedidos, setPedidos]       = useState([]);
  const [mostrarGenerados, setMostrar] = useState(false);
  const [cargando, setCargando]     = useState(false);
  const [pagina, setPagina]         = useState(1);
  const [usuarios, setUsuarios]     = useState([]);
  const [usuarioSel, setUsuarioSel] = useState('');
  const [perfil, setPerfil]         = useState({ username: '', rol: '' });
  const [loadingAccion, setLoading] = useState(false);
  const POR_PAGINA = 10;

  /* ───────────── helpers ───────────── */
  const decodificarToken = () => {
    const t = localStorage.getItem('token');
    if (!t) return {};
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      return { username: payload.username || '', rol: payload.rol || '' };
    } catch { return {}; }
  };

  /* ───────────── efectos ───────────── */
  useEffect(() => {
    cargarPerfil();
    cargarPedidos();
  }, [mostrarGenerados]);

  const cargarPerfil = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('usuario') || '{}');
      if (stored.username) return setPerfil(stored);
    } catch {/* ignore */}
    const dec = decodificarToken();
    if (dec.username) setPerfil(dec);
  };

  const cargarPedidos = async () => {
    setCargando(true);
    const tipo = mostrarGenerados ? 'generados' : 'pendientes';
    try {
      const r = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos/${tipo}`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      const normalizados = data.map(p => ({ ...p, creadoPor: p.usuario_username || '—' }));
      setPedidos(normalizados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      setUsuarios([...new Set(normalizados.map(p => p.creadoPor).filter(u => u !== '—'))]);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally { setCargando(false); }
  };

  /* ───────────── filtros ───────────── */
  const pedidosFiltrados = pedidos.filter(p => {
    if (perfil.rol === 'admin') return usuarioSel ? p.creadoPor === usuarioSel : true;
    return perfil.username ? p.creadoPor === perfil.username : true;
  });

  /* ───────────── acciones ───────────── */
  const marcarGenerado = async id => {
    setLoading(true);
    const r = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/pedidos/${id}/estado`,
      {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ pdf_generado: true })
      }
    );
    r.ok
      ? toast.success(`✅ Pedido #${id} marcado como generado`, { icon: '✅', className: 'animate-bounce' })
      : toast.error('Error al marcar');
    await cargarPedidos();
    setLoading(false);
  };

  const eliminarPedido = async id => {
    if (!confirm('¿Eliminar pedido?')) return;
    setLoading(true);
    const r = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/pedidos/${id}`,
      { method: 'DELETE' }
    );
    r.ok ? toast.success('Pedido eliminado') : toast.error('Error');
    await cargarPedidos();
    setLoading(false);
  };

  /* ───────────── exportar ───────────── */
  const exportarExcel = () => {
    if (pedidosFiltrados.length === 0) return toast.info('Sin datos');
    const rows = pedidosFiltrados.flatMap(p =>
      p.productos.map(pr => ({
        Pedido  : `#${p.id}`,
        Cliente : p.cliente_nombre || '',
        Fecha   : new Date(p.fecha).toLocaleString(),
        Producto: pr.nombre,
        Cantidad: pr.cantidad,
        Tipo    : pr.tipo,
        Usuario : p.creadoPor
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    saveAs(
      new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]),
      `pedidos_${mostrarGenerados ? 'generados' : 'pendientes'}.xlsx`
    );
  };

  /* ───────────── paginación ───────────── */
  const totalPags = Math.ceil(pedidosFiltrados.length / POR_PAGINA);
  const pageData  = pedidosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  /* ───────────── UI ───────────── */
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-blue-600 mb-4">Historial de Pedidos</h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setMostrar(false)}  className={`px-4 py-1 rounded ${!mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Pendientes</button>
        <button onClick={() => setMostrar(true)}   className={`px-4 py-1 rounded ${ mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Generados</button>

        {perfil.rol === 'admin' && (
          <select value={usuarioSel} onChange={e => setUsuarioSel(e.target.value)} className="border p-1 rounded">
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u} value={u}>{u === perfil.username ? '🧍 Mis pedidos' : u}</option>
            ))}
          </select>
        )}

        <button onClick={exportarExcel} className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center">
          📊 Exportar Excel
        </button>
      </div>

      {/* Listado */}
      {cargando ? (
        <p>Cargando…</p>
      ) : pageData.length === 0 ? (
        <p>No hay pedidos.</p>
      ) : (
        <>
          {pageData.map(p => (
            <div key={p.id} className="bg-white shadow rounded p-4 mb-4">
              <p className="font-semibold">Pedido #{p.id}</p>
              {perfil.rol === 'admin' && <p className="text-sm text-purple-600">Creado por: {p.creadoPor}</p>}
              <p>Cliente: {p.cliente_nombre}</p>
              <p>Fecha: {new Date(p.fecha).toLocaleString()}</p>
              {p.observaciones && <p>Obs.: {p.observaciones}</p>}

              <ul className="list-disc pl-6 mt-2 text-sm">
                {p.productos.map((pr, i) => (
                  <li key={i}>{pr.nombre} - {pr.cantidad} {pr.tipo}</li>
                ))}
              </ul>

              {!mostrarGenerados && (
                <div className="flex gap-2 mt-3">
                  <button disabled={loadingAccion} onClick={() => marcarGenerado(p.id)} className="bg-green-600 text-white px-2 py-1 rounded text-sm">
                    Marcar generado
                  </button>
                  <button disabled={loadingAccion} onClick={() => eliminarPedido(p.id)} className="bg-red-600 text-white px-2 py-1 rounded text-sm">
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Paginación */}
          <div className="flex justify-center gap-2">
            <button disabled={pagina === 1}         onClick={() => setPagina(p => p - 1)} className="px-3 py-1 bg-gray-200 rounded">Anterior</button>
            <span>{pagina}</span>
            <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 bg-gray-200 rounded">Siguiente</button>
          </div>
        </>
      )}
    </div>
  );
}
