import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [mostrarGenerados, setMostrarGenerados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [loadingAccion, setLoadingAccion] = useState(false);
  const pedidosPorPagina = 10;

  useEffect(() => {
    cargarPedidos();
    obtenerPerfil();
  }, [mostrarGenerados]);

  const obtenerPerfil = async () => {
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/me`);
    if (res.ok) {
      const data = await res.json();
      setUserRole(data.rol);
      setUsername(data.username);
    }
  };

  const cargarPedidos = async () => {
    setCargando(true);
    try {
      const url = mostrarGenerados
        ? `${import.meta.env.VITE_API_URL}/pedidos/generados`
        : `${import.meta.env.VITE_API_URL}/pedidos/pendientes`;
      const res = await fetchConToken(url);
      if (res.ok) {
        const data = await res.json();
        const ordenados = data.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        setPedidos(ordenados);
        const unicos = [...new Set(data.map(p => p.creado_por || ''))];
        setUsuarios(unicos.filter(u => u));
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar pedidos');
    }
    setCargando(false);
  };

  const pedidosFiltrados = pedidos.filter(p =>
    userRole !== 'admin'
      ? p.creado_por === username
      : usuarioSeleccionado
      ? p.creado_por === usuarioSeleccionado
      : true
  );

  const totalPaginas = Math.ceil(pedidosFiltrados.length / pedidosPorPagina);
  const pedidosPagina = pedidosFiltrados.slice((pagina - 1) * pedidosPorPagina, pagina * pedidosPorPagina);

  const totalUnidades = pedidosFiltrados.reduce((acc, p) => acc + p.productos.reduce((s, prod) => s + parseFloat(prod.cantidad || 0), 0), 0);
  const totalProductos = pedidosFiltrados.reduce((acc, p) => acc + p.productos.length, 0);

  const exportarExcel = () => {
    const datos = pedidosFiltrados.map(p => ({
      ID: p.id,
      Cliente: p.cliente?.nombre || '',
      Teléfono: p.cliente?.telefono || '',
      Fecha: p.fecha,
      Observaciones: p.observaciones,
      Productos: p.productos.map(pr => `${pr.nombre} - ${pr.cantidad} ${pr.tipo}`).join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
      type: 'application/octet-stream',
    });
    saveAs(blob, `pedidos_${mostrarGenerados ? 'generados' : 'pendientes'}.xlsx`);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-blue-600 mb-4">Historial de Pedidos</h2>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className={`px-4 py-1 rounded ${!mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={() => setMostrarGenerados(false)}>Pendientes</button>
        <button className={`px-4 py-1 rounded ${mostrarGenerados ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={() => setMostrarGenerados(true)}>Generados</button>
        {userRole === 'admin' && (
          <select
            value={usuarioSeleccionado}
            onChange={e => setUsuarioSeleccionado(e.target.value)}
            className="border p-1 rounded"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u} value={u}>
                {u === username ? '🧍 Mis pedidos' : u}
              </option>
            ))}
          </select>
        )}
        <button onClick={exportarExcel} className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center">
          📊 Exportar Excel
        </button>
      </div>

      {cargando ? (
        <p>Cargando pedidos...</p>
      ) : pedidosFiltrados.length === 0 ? (
        <p>No hay pedidos para mostrar.</p>
      ) : (
        <>
          {pedidosPagina.map(pedido => (
            <div key={pedido.id} className="bg-white shadow rounded p-4 mb-4">
              <p className="font-semibold">Pedido #{pedido.id}</p>
              {userRole === 'admin' && (
                <p className="text-sm text-purple-500">Creado por: {pedido.creado_por || '—'}</p>
              )}
              <p>Cliente: {pedido.cliente?.nombre}</p>
              <p>Fecha: {new Date(pedido.fecha).toLocaleString()}</p>
              <p>Observaciones: {pedido.observaciones}</p>
              <p className="text-sm text-blue-600">Total productos: {pedido.productos.length} | Total unidades: {pedido.productos.reduce((sum, p) => sum + parseFloat(p.cantidad || 0), 0)}</p>
              <ul className="list-disc pl-6 mt-2">
                {pedido.productos.map((prod, i) => (
                  <li key={i}>{prod.nombre} - {prod.cantidad} {prod.tipo}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 rounded bg-gray-200">Anterior</button>
            <span>{pagina}</span>
            <button disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 rounded bg-gray-200">Siguiente</button>
          </div>
        </>
      )}
    </div>
  );
}
