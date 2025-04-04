// Pedidos.jsx
import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';

export default function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [productosPedido, setProductosPedido] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [errores, setErrores] = useState({});

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resClientes, resProductos] = await Promise.all([
          fetchConToken(`${import.meta.env.VITE_API_URL}/clientes`),
          fetchConToken(`${import.meta.env.VITE_API_URL}/productos`)
        ]);

        if (resClientes.ok && resProductos.ok) {
          const dataClientes = await resClientes.json();
          const dataProductos = await resProductos.json();
          setClientes(dataClientes);
          setProductos(dataProductos);
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
      }
    };

    cargarDatos();
  }, []);

  const agregarProducto = () => {
    setProductosPedido([...productosPedido, { producto_id: '', cantidad: 1, tipo: 'unidad' }]);
  };

  const eliminarProducto = (index) => {
    setProductosPedido(productosPedido.filter((_, i) => i !== index));
  };

  const actualizarProducto = (index, campo, valor) => {
    const copia = [...productosPedido];
    copia[index][campo] = campo === 'producto_id' ? parseInt(valor) : valor;
    setProductosPedido(copia);
  };

  const validarFormulario = () => {
    const nuevosErrores = {};
    if (!clienteId) {
      nuevosErrores.cliente = 'Debes seleccionar un cliente.';
    }

    if (productosPedido.length === 0) {
      nuevosErrores.productos = 'Debes agregar al menos un producto.';
    }

    const ids = new Set();
    productosPedido.forEach((prod, i) => {
      if (!prod.producto_id) {
        nuevosErrores[`producto_${i}`] = 'Producto requerido.';
      } else if (ids.has(prod.producto_id)) {
        nuevosErrores[`producto_${i}`] = 'Producto duplicado.';
      } else {
        ids.add(prod.producto_id);
      }

      if (!prod.cantidad || isNaN(prod.cantidad) || prod.cantidad <= 0) {
        nuevosErrores[`cantidad_${i}`] = 'Cantidad inválida.';
      }

      if (!prod.tipo) {
        nuevosErrores[`tipo_${i}`] = 'Tipo requerido.';
      }
    });

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const enviarPedido = async () => {
    if (!validarFormulario()) return;

    const payload = {
      cliente_id: parseInt(clienteId),
      observaciones,
      productos: productosPedido.map(p => ({
        producto_id: parseInt(p.producto_id),
        cantidad: parseFloat(p.cantidad),
        tipo: p.tipo
      })),
      pdf_generado: false,
      fecha: new Date().toISOString()
    };

    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMensaje('✅ Pedido enviado con éxito');
        // Limpiar formulario
        setClienteId('');
        setProductosPedido([]);
        setObservaciones('');
        setErrores({});
        setTimeout(() => setMensaje(''), 3000);
      } else {
        const err = await res.text();
        setMensaje(`❌ Error al enviar el pedido: ${err}`);
      }
    } catch (err) {
      console.error('Error de red al enviar pedido:', err);
      setMensaje('❌ Error de red al enviar el pedido');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Nuevo Pedido</h2>

      {mensaje && <p className="mb-4 text-green-600">{mensaje}</p>}

      <label className="block font-medium">Cliente</label>
      <select
        className="w-full mb-2 p-2 border rounded"
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
      >
        <option value="">Seleccionar cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      {errores.cliente && <p className="text-red-600 text-sm mb-2">{errores.cliente}</p>}

      {productosPedido.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <select
            value={p.producto_id}
            onChange={(e) => actualizarProducto(i, 'producto_id', e.target.value)}
            className="border p-1 rounded"
          >
            <option value="">Producto</option>
            {productos.map(prod => (
              <option key={prod.id} value={prod.id}>{prod.nombre}</option>
            ))}
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={p.cantidad}
            onChange={(e) => actualizarProducto(i, 'cantidad', e.target.value)}
            className="w-16 border p-1 rounded"
          />
          <select
            value={p.tipo}
            onChange={(e) => actualizarProducto(i, 'tipo', e.target.value)}
            className="border p-1 rounded"
          >
            <option value="unidad">Unidad</option>
            <option value="caja">Caja</option>
          </select>
          <button
            onClick={() => eliminarProducto(i)}
            className="bg-red-600 text-white px-2 rounded"
          >
            X
          </button>
          <div className="flex flex-col">
            {errores[`producto_${i}`] && <p className="text-red-600 text-xs">{errores[`producto_${i}`]}</p>}
            {errores[`cantidad_${i}`] && <p className="text-red-600 text-xs">{errores[`cantidad_${i}`]}</p>}
            {errores[`tipo_${i}`] && <p className="text-red-600 text-xs">{errores[`tipo_${i}`]}</p>}
          </div>
        </div>
      ))}
      {errores.productos && <p className="text-red-600 text-sm mb-2">{errores.productos}</p>}

      <button
        onClick={agregarProducto}
        className="bg-gray-200 px-4 py-1 rounded mb-4"
      >
        Agregar Producto
      </button>

      <label className="block font-medium">Observaciones</label>
      <textarea
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        className="w-full border p-2 rounded mb-4"
      />

      <button
        onClick={enviarPedido}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Enviar Pedido
      </button>
    </div>
  );
}
