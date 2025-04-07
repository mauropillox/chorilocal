// Pedidos.jsx
import React, { useState, useEffect } from "react";
import Select from "react-select";
import fetchConToken from "../utils/fetchConToken";

function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [productosPedido, setProductosPedido] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const resClientes = await fetchConToken("/clientes");
        const resProductos = await fetchConToken("/productos");
        setClientes(resClientes);
        setProductos(resProductos);
      } catch (error) {
        console.error("Error cargando datos:", error);
      }
    };
    cargarDatos();
  }, []);

  const agregarProducto = () => {
    setProductosPedido([...productosPedido, { producto_id: null, cantidad: 1, tipo: "unidad" }]);
  };

  const actualizarProducto = (index, campo, valor) => {
    const copia = [...productosPedido];
    copia[index][campo] = valor;
    setProductosPedido(copia);
  };

  const eliminarProducto = (index) => {
    const copia = [...productosPedido];
    copia.splice(index, 1);
    setProductosPedido(copia);
  };

  const enviarPedido = async () => {
    setLoading(true);
    setMensaje("");
    try {
      const pedido = {
        cliente_id: clienteSeleccionado?.id,
        observaciones,
        productos: productosPedido,
      };

      const res = await fetchConToken("/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });

      if (!res.ok) throw new Error("Error al enviar el pedido");

      setMensaje("✅ Pedido enviado correctamente.");
      setClienteSeleccionado(null);
      setProductosPedido([]);
      setObservaciones("");
    } catch (error) {
      setMensaje("❌ Error al enviar el pedido.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Nuevo Pedido</h2>

      {mensaje && <div className="mb-4 text-red-500">{mensaje}</div>}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="🔍 Buscar cliente..."
          className="p-2 border rounded"
          value={busquedaCliente}
          onChange={(e) => setBusquedaCliente(e.target.value)}
        />
        <input
          type="text"
          placeholder="🔍 Buscar producto..."
          className="p-2 border rounded"
          value={busquedaProducto}
          onChange={(e) => setBusquedaProducto(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <select
          className="p-2 border rounded w-full"
          value={clienteSeleccionado?.id || ""}
          onChange={(e) =>
            setClienteSeleccionado(clientes.find((c) => c.id === parseInt(e.target.value)))
          }
        >
          <option value="">Seleccionar cliente</option>
          {clientesFiltrados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {productosPedido.map((p, index) => (
        <div className="flex gap-2 items-center mb-2" key={index}>
          <select
            className="border p-2 rounded"
            value={p.producto_id || ""}
            onChange={(e) => actualizarProducto(index, "producto_id", parseInt(e.target.value))}
          >
            <option value="">Producto</option>
            {productosFiltrados.map((prod) => (
              <option key={prod.id} value={prod.id}>
                {prod.nombre}
              </option>
            ))}
          </select>

          <input
            type="number"
            className="border p-2 w-20 rounded"
            value={p.cantidad}
            min={0.5}
            step={0.5}
            onChange={(e) => actualizarProducto(index, "cantidad", parseFloat(e.target.value))}
          />

          <select
            className="border p-2 rounded"
            value={p.tipo}
            onChange={(e) => actualizarProducto(index, "tipo", e.target.value)}
          >
            <option value="unidad">Unidad</option>
            <option value="caja">Caja</option>
          </select>

          <button
            onClick={() => eliminarProducto(index)}
            className="text-white bg-red-500 px-2 py-1 rounded"
          >
            X
          </button>
        </div>
      ))}

      <button
        onClick={agregarProducto}
        className="bg-gray-200 px-4 py-2 rounded mb-4"
      >
        Agregar Producto
      </button>

      <textarea
        className="w-full border p-2 mb-4 rounded"
        rows="3"
        placeholder="Observaciones"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
      />

      <button
        onClick={enviarPedido}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Enviando..." : "Enviar Pedido"}
      </button>
    </div>
  );
}

export default Pedidos;
