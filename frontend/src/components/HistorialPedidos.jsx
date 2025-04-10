import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function HistorialPedidos() {
  const { user } = useAuth();

  // ───────── State ─────────
  const [pedidos, setPedidos] = useState([]);
  const [mostrarGenerados, setMostrarGenerados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loadingAccion, setLoadingAccion] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState('todos');

  const pedidosPorPagina = 10;

  // ───────── Efectos ─────────
  useEffect(() => {
    if (user?.rol === 'admin') cargarUsuarios();
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [mostrarGenerados, usuarioFiltro]);

  // ───────── Cargar usuarios (solo admin) ─────────
  const cargarUsuarios = async () => {
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios`);
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ───────── Cargar pedidos ─────────
  const cargarPedidos = async () => {
    setCargando(true);
    try {
      const base = mostrarGenerados ? 'generados' : 'pendientes';
      let url = `${import.meta.env.VITE_API_URL}/pedidos/${base}`;

      // admin filtrando por usuario
      if (user?.rol === 'admin' && usuarioFiltro !== 'todos') {
        url += `?user_id=${usuarioFiltro}`;
      }

      const res = await fetchConToken(url);
      if (res.ok) {
        const data = await res.json();
        const ordenados = data.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        setPedidos(ordenados);
      } else toast.error('❌ Error al cargar pedidos');
    } catch (err) {
      toast.error('❌ Error de red al cargar pedidos');
    } finally {
      setCargando(false);
    }
  };

  // ───────── Cambiar estado, eliminar, etc. (sin cambios) ─────────
  // … (copiar funciones cambiarEstado, eliminarPedido, toggleSeleccion, generarPDF) …

  const cambiarEstado = async (id, nuevoEstado) => { /* igual que antes */ };
  const eliminarPedido = async (id) => { /* igual que antes */ };
  const toggleSeleccion = (id) => { /* igual que antes */ };
  const generarPDF = async () => { /* igual que antes */ };

  // ───────── Exportar a Excel ─────────
  const exportarExcel = () => {
    if (pedidos.length === 0) return toast.info('No hay datos para exportar');
    const rows = pedidos.map(p => ({
      ID: p.id,
      Cliente: p.cliente_nombre,
      Usuario: p.usuario_username,
      Fecha: p.fecha ? new Date(p.fecha).toLocaleString() : '',
      Observaciones: p.observaciones || '',
      TotalItems: p.productos?.reduce((s, pr) => s + pr.cantidad, 0) || 0,
      Productos: p.productos?.map(pr => `${pr.nombre} (${pr.cantidad} ${pr.tipo})`).join(' | ')
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([buf]), 'pedidos.xlsx');
  };

  // ───────── Paginación ─────────
  const totalPaginas = Math.ceil(pedidos.length / pedidosPorPagina);
  const pedidosPaginados = pedidos.slice((pagina - 1) * pedidosPorPagina, pagina * pedidosPorPagina);

  // ───────── Render ─────────
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Historial de Pedidos</h2>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <button
          onClick={() => { setMostrarGenerados(false); setPagina(1); }}
          className={`px-4 py-2 rounded font-medium ${!mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Pendientes
        </button>
        <button
          onClick={() => { setMostrarGenerados(true); setPagina(1); }}
          className={`px-4 py-2 rounded font-medium ${mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Generados
        </button>

        {/* Filtro usuario (solo admin) */}
        {user?.rol === 'admin' && (
          <select
            value={usuarioFiltro}
            onChange={e => { setUsuarioFiltro(e.target.value); setPagina(1); }}
            className="border p-2 rounded"
          >
            <option value="todos">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
        )}

        {/* Exportar */}
        <button
          onClick={exportarExcel}
          className="ml-auto bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📊 Exportar Excel
        </button>
      </div>

      {/* Botón PDF (igual que antes) */}
      {mostrarGenerados && seleccionados.length > 0 && (
        <button
          onClick={generarPDF}
          disabled={loadingAccion}
          className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          📄 Generar PDF de {seleccionados.length} pedido(s)
        </button>
      )}

      {/* Lista */}
      {cargando ? (
        <p className="text-gray-500">Cargando pedidos...</p>
      ) : pedidosPaginados.length === 0 ? (
        <p className="text-gray-500">No hay pedidos en esta categoría.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {pedidosPaginados.map((pedido) => {
              const total = pedido.productos?.reduce((s, pr) => s + pr.cantidad, 0) || 0;
              return (
                <li key={pedido.id} className="border p-4 rounded shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50">
                  <div>
                    <p className="font-semibold">Pedido #{pedido.id}</p>
                    {user?.rol === "admin" && (
                      <p className="text-sm text-purple-600">Creado por: {pedido.usuario_username}</p>
                    )}
                    <p className="text-sm text-gray-600">Cliente: {pedido.cliente_nombre || 'Sin nombre'}</p>
                    {pedido.fecha && <p className="text-sm text-gray-500">Fecha: {new Date(pedido.fecha).toLocaleString()}</p>}
                    {pedido.observaciones && <p className="text-sm text-gray-500">Observaciones: {pedido.observaciones}</p>}
                    <p className="text-sm text-blue-600 mt-1">Total ítems: {total}</p>
                    <ul className="text-sm text-gray-700 list-disc pl-4 mt-1">
                      {pedido.productos?.map((p, i) => (
                        <li key={i}>{p.nombre} - {p.cantidad} {p.tipo}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Botones acción (sin cambios) */}
                  <div className="flex gap-2 mt-3 md:mt-0">
                    {mostrarGenerados && (
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(pedido.id)}
                        onChange={() => toggleSeleccion(pedido.id)}
                        disabled={loadingAccion}
                      />
                    )}
                    {!pedido.pdf_generado && (
                      <button
                        onClick={() => cambiarEstado(pedido.id, true)}
                        disabled={loadingAccion}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        Marcar como generado
                      </button>
                    )}
                    {pedido.pdf_generado && (
                      <button
                        onClick={() => cambiarEstado(pedido.id, false)}
                        disabled={loadingAccion}
                        className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Marcar como pendiente
                      </button>
                    )}
                    {!pedido.pdf_generado && (
                      <button
                        onClick={() => eliminarPedido(pedido.id)}
                        disabled={loadingAccion}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Paginación */}
          <div className="flex justify-center mt-6 gap-2">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">Anterior</button>
            {[...Array(totalPaginas)].map((_, i) => (
              <button key={i} onClick={() => setPagina(i + 1)} className={`px-3 py-1 text-sm rounded ${pagina === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">Siguiente</button>
          </div>
        </>
      )}
    </div>
  );
}
