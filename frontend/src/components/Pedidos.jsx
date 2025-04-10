import { useEffect, useState } from 'react';
import { fetchConToken } from '../auth';
import Select from 'react-select';
import { toast } from 'react-toastify';

export default function Pedidos() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const unidades = ['unidad', 'kilo', 'caja', 'bolsa', 'paquete', 'gancho', 'Tira'];

  useEffect(() => {
    const cargar = async () => {
      const [cRes, pRes] = await Promise.all([
        fetchConToken(`${import.meta.env.VITE_API_URL}/clientes`),
        fetchConToken(`${import.meta.env.VITE_API_URL}/productos`)
      ]);
      const [cData, pData] = await Promise.all([cRes.json(), pRes.json()]);
      setClientes(cData);
      setProductos(pData);
    };
    cargar();
  }, []);

  const agregarProducto = () => {
    if (!seleccionado) return;
    setItems([...items, {
      producto_id: seleccionado.id,
      nombre: seleccionado.nombre,
      cantidad: 1,
      tipo: 'unidad'
    }]);
    setSeleccionado(null);
  };

  const eliminarItem = idx => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const actualizarItem = (idx, campo, valor) => {
    const nuevos = [...items];
    nuevos[idx][campo] = campo === 'cantidad' ? parseFloat(valor) : valor;
    setItems(nuevos);
  };

  const enviarPedido = async () => {
    if (!cliente || items.length === 0) {
      toast.warning('Seleccioná cliente y productos');
      return;
    }

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    const body = {
      cliente_id: cliente.id,
      observaciones,
      productos: items.map(i => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        tipo: i.tipo.toLowerCase()  // 🔥 CORREGIDO: pasar a minúscula
      })),
      pdf_generado: 0,
      usuario_id: usuario.id || null
    };

    setLoading(true);
    const r = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/pedidos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    setLoading(false);

    if (r.ok) {
      toast.success('Pedido enviado');
      setCliente(null);
      setItems([]);
      setObservaciones('');
    } else {
      toast.error('Error al enviar');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-blue-600 mb-4">Nuevo Pedido</h2>

      <div className="mb-3">
        <label className="block mb-1 font-medium">Cliente:</label>
        <Select
          value={cliente ? { label: cliente.nombre, value: cliente.id } : null}
          onChange={opt => {
            const cli = clientes.find(c => c.id === opt.value);
            setCliente(cli);
          }}
          options={clientes.map(c => ({ label: `${c.nombre} (Tel: ${c.telefono}, Dir: ${c.direccion})`, value: c.id }))}
          placeholder="Seleccionar cliente..."
        />
      </div>

      <div className="mb-3">
        <label className="block mb-1 font-medium">Observaciones:</label>
        <textarea
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-1 font-medium">Productos:</label>
        <div className="flex gap-2">
          <Select
            className="w-full"
            value={seleccionado ? { label: `${seleccionado.nombre}`, value: seleccionado.id } : null}
            onChange={opt => {
              const prod = productos.find(p => p.id === opt.value);
              setSeleccionado(prod);
            }}
            options={productos.map(p => ({
              label: `${p.nombre} ($${p.precio})`,
              value: p.id
            }))}
            placeholder="Seleccionar producto..."
          />
          <button onClick={agregarProducto} className="bg-blue-600 text-white px-4 rounded">+ Agregar producto</button>
        </div>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 mb-2">
          <span className="w-1/3">{item.nombre}</span>
          <input
            type="number"
            value={item.cantidad}
            min="0"
            step="0.01"
            className="border p-1 w-20"
            onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
          />
          <select
            value={item.tipo}
            onChange={e => actualizarItem(idx, 'tipo', e.target.value)}
            className="border p-1"
          >
            {unidades.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <button onClick={() => eliminarItem(idx)} className="text-red-600 text-sm">Eliminar</button>
        </div>
      ))}

      <button
        onClick={enviarPedido}
        disabled={loading}
        className="mt-4 bg-green-600 text-white px-6 py-2 rounded"
      >
        Enviar Pedido
      </button>
    </div>
  );
}
