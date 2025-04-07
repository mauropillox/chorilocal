import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';

export default function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [productosPedido, setProductosPedido] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);

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
    setProductosPedido([...productosPedido, { producto_id: '', cantidad: 1, tipo: 'unidad', productoObj: null }]);
  };

  const eliminarProducto = (index) => {
    setProductosPedido(productosPedido.filter((_, i) => i !== index));
  };

  const actualizarProducto = (index, campo, valor) => {
    const copia = [...productosPedido];
    if (campo === 'producto_id') {
      copia[index].producto_id = valor.value;
      copia[index].productoObj = valor;
    } else {
      copia[index][campo] = valor;
    }
    setProductosPedido(copia);
  };

  const validarFormulario = () => {
    const nuevosErrores = {};
    if (!clienteId) nuevosErrores.cliente = 'Debes seleccionar un cliente.';
    if (productosPedido.length === 0) nuevosErrores.productos = 'Debes agregar al menos un producto.';

    const ids = new Set();
    productosPedido.forEach((prod, i) => {
      if (!prod.producto_id) nuevosErrores[`producto_${i}`] = 'Producto requerido.';
      else if (ids.has(prod.producto_id)) nuevosErrores[`producto_${i}`] = 'Producto duplicado.';
      else ids.add(prod.producto_id);

      if (!prod.cantidad || isNaN(prod.cantidad) || prod.cantidad <= 0) {
        nuevosErrores[`cantidad_${i}`] = 'Cantidad inválida.';
      }

      if (!prod.tipo) nuevosErrores[`tipo_${i}`] = 'Tipo requerido.';
    });

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const enviarPedido = async () => {
    if (!validarFormulario() || loading) return;

    setLoading(true);

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
        setClienteId('');
        setProductosPedido([]);
        setObservaciones('');
        setErrores({});
        setSelectedCliente(null);
      } else {
        const err = await res.text();
        setMensaje(`❌ Error al enviar el pedido: ${err}`);
      }
    } catch (err) {
      console.error('Error de red al enviar pedido:', err);
      setMensaje('❌ Error de red al enviar el pedido');
    } finally {
      setLoading(false);
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  const clienteOptions = clientes.map(c => ({
    value: c.id,
    label: c.nombre
  }));

  const productoOptions = productos.map(p => ({
    value: p.id,
    label: p.nombre
  }));

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Nuevo Pedido</h2>

      {mensaje && <p className="mb-4 text-green-600">{mensaje}</p>}

      <label className="block font-medium mb-1">Cliente</label>
      <Select
        options={clienteOptions}
        value={selectedCliente}
        onChange={(option) => {
          setSelectedCliente(option);
          setClienteId(option?.value || '');
        }}
        placeholder="Seleccionar cliente..."
        className="mb-2"
      />
      {errores.cliente && <p className="text-red-600 text-sm mb-2">{errores.cliente}</p>}

      {productosPedido.map((p, i) => (
        <div key={i} className="flex flex-col sm:flex-row items-center gap-2 mb-2">
          <Select
            options={productoOptions}
            value={p.productoObj}
            onChange={(val) => actualizarProducto(i, 'producto_id', val)}
            placeholder="Producto"
            className="w-full sm:w-64"
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={p.cantidad}
            onChange={(e) => actualizarProducto(i, 'cantidad', e.target.value)}
            className="w-24 border p-1 rounded"
            placeholder="Cantidad"
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
          <div className="flex flex-col text-xs text-red-600">
            {errores[`producto_${i}`] && <span>{errores[`producto_${i}`]}</span>}
            {errores[`cantidad_${i}`] && <span>{errores[`cantidad_${i}`]}</span>}
            {errores[`tipo_${i}`] && <span>{errores[`tipo_${i}`]}</span>}
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
        disabled={loading}
        className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Enviando...' : 'Enviar Pedido'}
      </button>
    </div>
  );
}
