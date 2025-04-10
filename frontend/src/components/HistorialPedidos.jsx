import { useEffect, useState } from "react";
import { fetchConToken } from "../helpers/fetch";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

const HistorialPedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState("pendientes");
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const esAdmin = usuario?.rol === "admin";

  useEffect(() => {
    cargarPedidos();
    if (esAdmin) cargarUsuarios();
  }, [filtro]);

  const cargarPedidos = async () => {
    const tipo = filtro === "pendientes" ? "pendientes" : "generados";
    const res = await fetchConToken(`/pedidos/${tipo}`);
    const data = await res.json();
    setPedidos(data);
  };

  const cargarUsuarios = async () => {
    const res = await fetchConToken("/usuarios");
    const data = await res.json();
    setUsuarios(data.filter((u) => u.username !== "admin"));
  };

  const marcarGenerado = async (id) => {
    await fetchConToken(`/pedidos/${id}/pdf`, { method: "PUT" });
    cargarPedidos();
  };

  const eliminarPedido = async (id) => {
    if (confirm("¿Eliminar este pedido?")) {
      await fetchConToken(`/pedidos/${id}`, { method: "DELETE" });
      cargarPedidos();
    }
  };

  const exportarExcel = () => {
    const pedidosFiltrados = pedidosFiltradosPorUsuario();
    const data = pedidosFiltrados.flatMap((pedido) =>
      pedido.productos.map((prod) => ({
        Pedido: `#${pedido.id}`,
        Cliente: pedido.cliente?.nombre || "—",
        Fecha: pedido.fecha,
        Observaciones: pedido.observaciones,
        Producto: prod.nombre,
        Cantidad: prod.cantidad,
        Tipo: prod.tipo,
        Usuario: pedido.usuario_username || "—",
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(blob, `historial_pedidos_${filtro}.xlsx`);
  };

  const pedidosFiltradosPorUsuario = () => {
    if (!esAdmin || usuarioFiltro === "mios") {
      return pedidos.filter((p) => p.usuario_id === usuario.id);
    }
    if (usuarioFiltro !== "todos") {
      return pedidos.filter((p) => p.usuario_id === parseInt(usuarioFiltro));
    }
    return pedidos;
  };

  const paginados = pedidosFiltradosPorUsuario().slice(
    (pagina - 1) * porPagina,
    pagina * porPagina
  );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-blue-600 mb-4">
        Historial de Pedidos
      </h2>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <button
          className={`px-4 py-1 rounded ${
            filtro === "pendientes" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setFiltro("pendientes")}
        >
          Pendientes
        </button>
        <button
          className={`px-4 py-1 rounded ${
            filtro === "generados" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setFiltro("generados")}
        >
          Generados
        </button>

        {esAdmin && (
          <select
            className="ml-2 border px-2 py-1 rounded"
            value={usuarioFiltro}
            onChange={(e) => {
              setUsuarioFiltro(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
            <option value="mios">Solo míos</option>
          </select>
        )}

        <button
          className="ml-auto px-4 py-1 bg-green-500 text-white rounded flex items-center gap-1"
          onClick={exportarExcel}
        >
          📊 Exportar Excel
        </button>
      </div>

      {paginados.map((pedido) => {
        const totalUnidades = pedido.productos.reduce(
          (acc, p) => acc + parseFloat(p.cantidad || 0),
          0
        );
        return (
          <div
            key={pedido.id}
            className="border rounded p-4 mb-4 bg-white shadow"
          >
            <p className="font-bold">Pedido #{pedido.id}</p>
            {esAdmin && (
              <p className="text-sm text-purple-700 mb-1">
                Creado por: {pedido.usuario_username || "—"}
              </p>
            )}
            <p>
              <span className="font-semibold">Cliente:</span>{" "}
              {pedido.cliente?.nombre || "—"}
            </p>
            <p>
              <span className="font-semibold">Fecha:</span> {pedido.fecha}
            </p>
            <p>
              <span className="font-semibold">Observaciones:</span>{" "}
              {pedido.observaciones || "—"}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Total productos: {pedido.productos.length} | Total unidades:{" "}
              {totalUnidades}
            </p>
            <ul className="list-disc list-inside text-sm mt-2">
              {pedido.productos.map((prod, i) => (
                <li key={i}>
                  {prod.nombre} - {prod.cantidad} {prod.tipo}
                </li>
              ))}
            </ul>
            {filtro === "pendientes" && (
              <div className="flex gap-2 mt-4">
                <button
                  className="bg-green-500 text-white px-2 py-1 rounded"
                  onClick={() => marcarGenerado(pedido.id)}
                >
                  Marcar como generado
                </button>
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => eliminarPedido(pedido.id)}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-center mt-4 gap-2">
        <button
          disabled={pagina === 1}
          className="px-2 py-1 bg-gray-200 rounded"
          onClick={() => setPagina((p) => p - 1)}
        >
          Anterior
        </button>
        <span className="px-2 py-1 bg-blue-100 rounded">{pagina}</span>
        <button
          disabled={
            pagina * porPagina >= pedidosFiltradosPorUsuario().length
          }
          className="px-2 py-1 bg-gray-200 rounded"
          onClick={() => setPagina((p) => p + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default HistorialPedidos;
