import React, { useEffect, useState } from "react";
import fetchConToken from "../helpers/fetchConToken";

const Pedidos = () => {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pedido, setPedido] = useState({
    cliente_id: "",
    productos: [],
    observaciones: "",
  });
  const [nuevoProducto, setNuevoProducto] = useState({
    producto_id: "",
    cantidad: 1,
    tipo: "unidad",
  });
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const resClientes = await fetchConToken("/clientes");
      const resProductos = await fetchConToken("/productos");
      setClientes(await resClientes.json());
      setProductos(await resProductos.json());
    };
    fetchData();
  }, []);

  const handleAgregarProducto = () => {
    if (!nuevoProducto.producto_id) return;
    setPedido({
      ...pedido,
      productos: [...pedido.productos, nuevoProducto],
    });
    setNuevoProducto({ producto_id: "", cantidad: 1, tipo: "unidad" });
  };

  const handleEnviarPedido = async () => {
    if (!pedido.cliente_id || pedido.productos.length === 0) {
      setMensaje("Completa todos los campos antes de enviar.");
      return;
    }

    setLoading(true);
    setMensaje("");

    try {
      const res = await fetchConToken("/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });

      const data = await res.json();
      if (res.ok) {
        setMensaje("✅ Pedido enviado correctamente.");
        setPedido({ cliente_id: "", productos: [], observaciones: "" });
      } else {
        setMensaje("❌ Error al enviar el pedido: " + JSON.stringify(data));
      }
    } catch (err) {
      setMensaje("❌ Error de red al enviar el pedido.");
    }

    setLoading(false);
  };

  const handleEliminarProducto = (index) => {
    const nuevos = [...pedido.productos];
    nuevos.splice(index, 1);
    setPedido({ ...pedido, productos: nuevos });
  };

  const clientesFiltrados = clientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

  const productosFiltrados = productos.filter((producto) =>
    producto.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Nuevo Pedido</h2>

      {mensaje && <div className="mb-4 text-red-500">{mensaje}</div>}

      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="text"
          placeholder="🔍 Buscar cliente..."
          className="border p-2"
          value={busquedaCliente}
          onChange={(e) => setBusquedaCliente(e.target.value)}
        />
        <input
          type="text"
          placeholder="🔍 Buscar producto..."
          className="border p-2"
          value={busquedaProducto}
          onChange={(e) => setBusquedaProducto(e.target.value)}
        />
      </div>

      <select
        className="w-full border p-2 mb-2"
        value={pedido.cliente_id}
        onChange={(e) => setPedido({ ...pedido, cliente_id: e.target.value })}
      >
        <option value="">Seleccionar cliente</option>
        {clientesFiltrados.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <select
          className="border p-2"
          value={nuevoProducto.producto_id}
          onChange={(e) =>
            setNuevoProducto({ ...nuevoProducto, producto_id: e.target.value })
          }
        >
          <option value="">Buscar producto...</option>
          {productosFiltrados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="border p-2"
          step="0.5"
          value={nuevoProducto.cantidad}
          onChange={(e) =>
            setNuevoProducto({
              ...nuevoProducto,
              cantidad: parseFloat(e.target.value),
            })
          }
        />
        <select
          className="border p-2"
          value={nuevoProducto.tipo}
          onChange={(e) =>
            setNuevoProducto({ ...nuevoProducto, tipo: e.target.value })
          }
        >
          <option value="unidad">Unidad</option>
          <option value="caja">Caja</option>
        </select>
      </div>

      <button
        onClick={handleAgregarProducto}
        className="bg-gray-200 px-3 py-1 rounded mb-4"
      >
        Agregar Producto
      </button>

      <ul className="mb-4">
        {pedido.productos.map((p, i) => {
          const prod = productos.find((x) => x.id == p.producto_id);
          return (
            <li key={i}>
              {prod?.nombre} - {p.cantidad} {p.tipo}{" "}
              <button
                className="text-red-500 ml-2"
                onClick={() => handleEliminarProducto(i)}
              >
                ❌
              </button>
            </li>
          );
        })}
      </ul>

      <textarea
        placeholder="Observaciones"
        className="w-full border p-2 mb-4"
        value={pedido.observaciones}
        onChange={(e) =>
          setPedido({ ...pedido, observaciones: e.target.value })
        }
      />

      <button
        onClick={handleEnviarPedido}
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? "Enviando..." : "Enviar Pedido"}
      </button>
    </div>
  );
};

export default Pedidos;
