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
      .then(setClientes);

    fetch(`${import.meta.env.VITE_API_URL}/productos`)
      .then(res => res.json())
      .then(setProductos);
  }, []);

  const agregarProducto = (producto) => {
    if (!productosSeleccionados.some(p => p.id === producto.id)) {
      setProductosSeleccionados([
        ...productosSeleccionados,
        { ...producto, cantidad: 1, tipo: 'unidad' }
      ]);
    }
  };

  const cambiarCantidad = (id, cantidad) => {
    setProductosSeleccionados(productosSeleccionados.map(p =>
      p.id === id ? { ...p, cantidad: parseFloat(cantidad) || 0 } : p
    ));
  };

  const cambiarTipo = (id, tipo) => {
    setProductosSeleccionados(productosSeleccionados.map(p =>
      p.id === id ? { ...p, tipo } : p
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
      body: JSON.stringify({ cliente, productos: productosSeleccionados })
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

      <div>
        <label className="text-sm font-medium">Seleccionar cliente:</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">-- Elegí un cliente --</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={busquedaProducto}
        onChange={(e) => setBusquedaProducto(e.target.value)}
        placeholder="Buscar productos..."
        className="w-full border p-2 rounded"
      />

      <div className="grid gap-2">
        {productosFiltrados.map(p => (
          <button
            key={p.id}
            onClick={() => agregarProducto(p)}
            className="bg-blue-600 text-white p-2 rounded"
          >
            {p.nombre} (${p.precio})
          </button>
        ))}
      </div>

      {productosSeleccionados.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">🧊 Productos seleccionados</h3>
          <ul className="space-y-2">
            {productosSeleccionados.map(p => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1">{p.nombre}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={p.cantidad}
                  onChange={(e) => cambiarCantidad(p.id, e.target.value)}
                  className="w-20 border p-1"
                />
                <select
                  value={p.tipo}
                  onChange={(e) => cambiarTipo(p.id, e.target.value)}
                  className="border p-1"
                >
                  <option value="unidad">Unidad</option>
                  <option value="caja">Caja</option>
                </select>
                <button
                  onClick={() => eliminarProducto(p.id)}
                  className="text-red-500 text-sm"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={guardarPedido}
        className="w-full mt-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Guardar Pedido
      </button>
    </div>
  );
}
