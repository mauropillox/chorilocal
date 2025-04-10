import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';

export default function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarClientes();
    cargarProductos();
  }, []);

  const cargarClientes = async () => {
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/clientes`);
      if (res.ok) {
        const data = await res.json();
        setClientes(data);
      } else {
        toast.error("Error al cargar clientes");
      }
    } catch (err) {
      toast.error("Error de red al cargar clientes");
      console.error(err);
    }
  };

  const cargarProductos = async () => {
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos`);
      if (res.ok) {
        const data = await res.json();
        setProductos(data);
      } else {
        toast.error("Error al cargar productos");
      }
    } catch (err) {
      toast.error("Error de red al cargar productos");
      console.error(err);
    }
  };

  const agregarProducto = () => {
    setProductosSeleccionados(prev => [
      ...prev,
      { producto: null, cantidad: '', tipo: 'unidad' }
    ]);
    toast.success("Producto agregado al pedido");
  };

  const actualizarProducto = (index, campo, valor) => {
    const actualizados = [...productosSeleccionados];
    actualizados[index][campo] = valor;
    setProductosSeleccionados(actualizados);
  };

  const eliminarProducto = (index) => {
    const actualizados = [...productosSeleccionados];
    actualizados.splice(index, 1);
    setProductosSeleccionados(actualizados);
  };

  const enviarPedido = async () => {
    if (!clienteSeleccionado) return toast.error("Seleccioná un cliente");
    if (productosSeleccionados.length === 0) return toast.error("Agregá al menos un producto");

    const productosValidos = productosSeleccionados.every(p =>
      p.producto && p.cantidad > 0 && ["unidad", "caja", "kilo", "gancho"].includes(p.tipo)
    );
    if (!productosValidos) return toast.error("Revisá los productos: deben tener todos los campos válidos");

    const payload = {
      cliente_id: clienteSeleccionado.value,
      observaciones,
      productos: productosSeleccionados.map(p => ({
        producto_id: p.producto.value,
        cantidad: parseFloat(p.cantidad),
        tipo: p.tipo
      }))
    };

    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("✅ Pedido enviado con éxito");
        setClienteSeleccionado(null);
        setProductosSeleccionados([]);
        setObservaciones('');
      } else {
        const error = await res.text();
        console.error(error);
        toast.error("Error al enviar el pedido");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error de red al enviar pedido");
    } finally {
      setLoading(false);
    }
  };

  const clienteOptions = clientes.map(c => ({
    value: c.id,
    label: `${c.nombre} (Tel: ${c.telefono || 'Sin teléfono'}, Dir: ${c.direccion || 'Sin dirección'})`
  }));

  const productoOptions = productos.map(p => ({
    value: p.id,
    label: `${p.nombre} ($${p.precio})`
  }));

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Nuevo Pedido</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Cliente:</label>
        <Select
          options={clienteOptions}
          value={clienteSeleccionado}
          onChange={setClienteSeleccionado}
          isDisabled={loading}
          className="w-full"
          placeholder="Seleccionar cliente"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Observaciones:</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          className="border p-2 rounded w-full"
          disabled={loading}
        />
      </div>

      <div className="mb-4">
        <h3 className="font-medium mb-2">Productos:</h3>
        {productosSeleccionados.map((p, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-2 mb-2 items-center">
            <Select
              options={productoOptions}
              value={p.producto}
              onChange={(valor) => actualizarProducto(index, 'producto', valor)}
              placeholder="Producto"
              className="flex-1"
            />
            <input
              type="number"
              step="0.5"
              placeholder="Cantidad"
              value={p.cantidad}
              onChange={(e) => actualizarProducto(index, 'cantidad', e.target.value)}
              className="border p-2 rounded w-24"
            />
            <select
              value={p.tipo}
              onChange={(e) => actualizarProducto(index, 'tipo', e.target.value)}
              className="border p-2 rounded"
            >
              <option value="unidad">Unidad</option>
              <option value="caja">Caja</option>
              <option value="kilo">Kilo</option>
              <option value="gancho">Gancho</option>
              <option value="tira">Tira</option>
            </select>
            <button
              onClick={() => eliminarProducto(index)}
              className="text-red-600 hover:underline text-sm"
            >
              Eliminar
            </button>
          </div>
        ))}

        <button
          onClick={agregarProducto}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + Agregar producto
        </button>
      </div>

      <button
        onClick={enviarPedido}
        disabled={loading}
        className={`w-full py-2 rounded text-white font-semibold ${loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
      >
        Enviar Pedido
      </button>
    </div>
  );
}
