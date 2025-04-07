import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';

export default function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [productosPedido, setProductosPedido] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

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
        toast.error('Error al cargar datos');
        console.error(err);
      }
    };

    cargarDatos();
  }, []);

  const agregarProducto = () => {
    setProductosPedido([...productosPedido, { producto: null, cantidad: 1, tipo: 'unidad' }]);
  };

  const eliminarProducto = (index) => {
    const copia = [...productosPedido];
    copia.splice(index, 1);
    setProductosPedido(copia);
  };

  const actualizarProducto = (index, campo, valor) => {
    const copia = [...productosPedido];
    if (campo === 'producto') {
      copia[index].producto = valor;
    } else {
      copia[index][campo] = valor;
    }
    setProductosPedido(copia);
  };

  const enviarPedido = async () => {
    if (!clienteSeleccionado || productosPedido.length === 0) {
      toast.error('Debes seleccionar un cliente y al menos un producto');
      return;
    }

    const payload = {
      cliente_id: clienteSeleccionado.value,
      observaciones,
      productos: productosPedido.map(p => ({
        producto_id: p.producto.value,
        cantidad: parseFloat(p.cantidad),
        tipo: p.tipo
      })),
      pdf_generado: false,
      fecha: new Date().toISOString()
    };

    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('✅ Pedido enviado con éxito');
        setClienteSeleccionado(null);
        setProductosPedido([]);
        setObservaciones('');
      } else {
        const err = await res.text();
        toast.error(`❌ Error: ${err}`);
      }
    } catch (err) {
      toast.error('❌ Error de red');
    } finally {
      setLoading(false);
    }
  };

  const clienteOptions = clientes.map(c => ({
    value: c.id,
    label: c.nombre
  }));

  const productoOptions = productos.map(p => ({
    value: p.id,
    label: `${p.nombre} ($${p.precio})`
  }));

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Nuevo Pedido</h2>

      <div className="mb-4">
        <label className="block font-medium">Cliente</label>
        <Select
          options={clienteOptions}
          value={clienteSeleccionado}
          onChange={setClienteSeleccionado}
          isDisabled={loading}
          placeholder="Seleccionar cliente"
        />
      </div>

      {productosPedido.map((p, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2 items-center">
          <Select
            options={productoOptions}
            value={p.producto}
            onChange={(val) => actualizarProducto(i, 'producto', val)}
            placeholder="Producto"
            className="flex-1"
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
            className="bg-red-600 text-white px-2 py-1 rounded"
          >
            X
          </button>
        </div>
      ))}

      <button
        onClick={agregarProducto}
        disabled={loading}
        className="bg-gray-200 px-4 py-1 rounded mb-4"
      >
        Agregar Producto
      </button>

      <label className="block font-medium">Observaciones</label>
      <textarea
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        className="w-full border p-2 rounded mb-4"
        placeholder="Observaciones del pedido"
      />

      <button
        onClick={enviarPedido}
        disabled={loading}
        className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Enviando...' : 'Enviar Pedido'}
      </button>
    </div>
  );
}
