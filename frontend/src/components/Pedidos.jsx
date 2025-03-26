import { useState, useEffect } from 'react';

export default function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [productos, setProductos] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/clientes`)
      .then(res => res.json())
      .then(data => setClientes(data));

    fetch(`${import.meta.env.VITE_API_URL}/productos`)
      .then(res => res.json())
      .then(data => setProductos(data));
  }, []);

  const agregarProducto = (producto) => {
    if (!productosSeleccionados.some(p => p.id === producto.id)) {
      setProductosSeleccionados([...productosSeleccionados, { ...producto, cantidad: 1 }]);
    }
  };

  const cambiarCantidad = (id, cantidad) => {
    setProductosSeleccionados(productosSeleccionados.map(p =>
      p.id === id ? { ...p, cantidad: parseInt(cantidad) || 1 } : p
    ));
  };

  const eliminarProducto = (id) => {
    setProductosSeleccionados(productosSeleccionados.filter(p => p.id !== id));
  };

  const guardarPedido = async () => {
    if (!clienteId || productosSeleccionados.length === 0) {
      alert("Seleccioná un cliente y al menos un producto");
      return;
    }

    const cliente = clientes.find(c => c.id === parseInt(clienteId));

    const res = await fetch(`${import.meta.env.VITE_API_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente,
        productos: productosSeleccionados
      })
    });

    if (res.ok) {
      alert("Pedido guardado");
      setClienteId('');
      setProductosSeleccionados([]);
    }
  };

  const productosFiltrados = busquedaProducto
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-blue-800">Crear Pedido</h2>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Seleccionar cliente:</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">-- Elegí un cliente --</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.telefono && `(${c.telefono})`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Buscar productos:</label>
        <input
          type="text"
          value={busquedaProducto}
          onChange={(e) => setBusquedaProducto(e.target.value)}
          placeholder="Buscar por nombre"
          className="w-full border p-2 rounded mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Productos disponibles:</label>
        <ul className="pl-4 space-y-2 mt-2">
          {productosFiltrados.length > 0 ? (
            productosFiltrados.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => agregarProducto(p)}
                  className="w-full text-left p-2 bg-blue-600 text-white rounded mb-2"
                >
                  {p.nombre} (${p.precio})
                </button>
              </li>
            ))
          ) : (
            <li>No se encontraron productos</li>
          )}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium">Productos seleccionados:</h3>
        <ul className="pl-4 space-y-2 mt-2">
          {productosSeleccionados.length > 0 ? (
            productosSeleccionados.map(p => (
              <li key={p.id} className="flex justify-between items-center">
                <span>{p.nombre} (${p.precio})</span>
                <input
                  type="number"
                  min="1"
                  value={p.cantidad}
                  onChange={(e) => cambiarCantidad(p.id, e.target.value)}
                  className="w-16 p-1 text-center"
                />
                <button
                  onClick={() => eliminarProducto(p.id)}
                  className="text-red-600 text-sm"
                >
                  Eliminar
                </button>
              </li>
            ))
          ) : (
            <li>No has seleccionado productos</li>
          )}
        </ul>
      </div>

      <button
        onClick={guardarPedido}
        className="w-full mt-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Guardar Pedido
      </button>
    </div>
  );
}