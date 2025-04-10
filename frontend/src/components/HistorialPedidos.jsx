import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

export default function HistorialPedidos() {
  const { user } = useAuth();

  const [pedidos, setPedidos] = useState([]);
  const [mostrarGenerados, setMostrarGenerados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loadingAccion, setLoadingAccion] = useState(false);
  const pedidosPorPagina = 10;

  useEffect(() => {
    cargarPedidos();
  }, [mostrarGenerados]);

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
      } else {
        const error = await res.text();
        console.error('Error al cargar pedidos:', error);
        toast.error('❌ Error al cargar pedidos');
      }
    } catch (err) {
      console.error('Error de red:', err);
      toast.error('❌ Error de red al cargar pedidos');
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    setLoadingAccion(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_generado: nuevoEstado }),
      });
      if (res.ok) {
        toast.success(`Estado del pedido #${id} actualizado`);
        await cargarPedidos();
      } else {
        const error = await res.text();
        console.error('Error al cambiar estado del pedido:', error);
        toast.error('❌ Error al cambiar estado del pedido');
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      toast.error('❌ Error al cambiar estado del pedido');
    } finally {
      setLoadingAccion(false);
    }
  };

  const eliminarPedido = async (id) => {
    if (!confirm("¿Seguro que querés eliminar este pedido?")) return;
    setLoadingAccion(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPedidos((prev) => prev.filter(p => p.id !== id));
        toast.success(`Pedido #${id} eliminado`);
      } else {
        const error = await res.text();
        console.error('Error al eliminar pedido:', error);
        toast.error('❌ Error al eliminar el pedido');
      }
    } catch (err) {
      console.error('Error al eliminar el pedido:', err);
      toast.error('❌ Error al eliminar el pedido');
    } finally {
      setLoadingAccion(false);
    }
  };

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const generarPDF = async () => {
    if (seleccionados.length === 0) return toast.info("Seleccioná al menos un pedido");

    setLoadingAccion(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_ids: seleccionados }),
      });

      if (!res.ok) throw new Error('Error al generar PDF');

      const disposition = res.headers.get("Content-Disposition");
      let filename = "archivo.pdf";

      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`✅ PDF generado: ${filename}`);
      setSeleccionados([]);
      await cargarPedidos();
    } catch (err) {
      console.error(err);
      toast.error("❌ Ocurrió un error al generar el PDF");
    } finally {
      setLoadingAccion(false);
    }
  };

  const totalPaginas = Math.ceil(pedidos.length / pedidosPorPagina);
  const pedidosPaginados = pedidos.slice((pagina - 1) * pedidosPorPagina, pagina * pedidosPorPagina);

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Historial de Pedidos</h2>

      <div className="flex gap-4 mb-6">
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
      </div>

      {mostrarGenerados && seleccionados.length > 0 && (
        <button
          onClick={generarPDF}
          disabled={loadingAccion}
          className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          📄 Generar PDF de {seleccionados.length} pedido(s)
        </button>
      )}

      {cargando ? (
        <p className="text-gray-500">Cargando pedidos...</p>
      ) : pedidosPaginados.length === 0 ? (
        <p className="text-gray-500">No hay pedidos en esta categoría.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {pedidosPaginados.map((pedido) => (
              <li key={pedido.id} className="border p-4 rounded shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50">
                <div>
                  <p className="font-semibold">Pedido #{pedido.id}</p>
                  {user?.rol === "admin" && (
                    <p className="text-sm text-purple-600">Creado por: {pedido.usuario_username}</p>
                  )}
                  <p className="text-sm text-gray-600">Cliente: {pedido.cliente_nombre || 'Sin nombre'}</p>
                  {pedido.fecha && <p className="text-sm text-gray-500">Fecha: {new Date(pedido.fecha).toLocaleString()}</p>}
                  {pedido.observaciones && <p className="text-sm text-gray-500">Observaciones: {pedido.observaciones}</p>}
                  <ul className="text-sm text-gray-700 list-disc pl-4 mt-1">
                    {pedido.productos?.map((p, i) => (
                      <li key={i}>{p.nombre} - {p.cantidad} {p.tipo}</li>
                    ))}
                  </ul>
                </div>

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
            ))}
          </ul>

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
