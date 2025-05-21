import { useEffect, useState, useMemo } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [nombre, setNombre]       = useState('');
  const [precio, setPrecio]       = useState(0);          // 🔹 oculto; se usa para editar
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ───────── cargar ───────── */
  useEffect(() => { cargarProductos(); }, []);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos`);
      if (res.ok) setProductos(await res.json());
      else alert('Error al cargar productos');
    } catch (err) {
      console.error('Error al cargar productos:', err);
    } finally { setLoading(false); }
  };

  /* ───────── alta / edición ───────── */
  const agregarProducto = async () => {
    if (!nombre) return alert('Debe ingresar un nombre');

    const payload = {
      nombre,
      // precio = 0 para nuevos; se mantiene sin cambios en edición
      precio: selectedProducto ? precio : 0
    };

    let url    = `${import.meta.env.VITE_API_URL}/productos`;
    let method = 'POST';
    if (selectedProducto) {
      url    = `${import.meta.env.VITE_API_URL}/productos/${selectedProducto.value}`;
      method = 'PUT';
    }

    setLoading(true);
    try {
      const res = await fetchConToken(url, {
        method,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await cargarProductos();
        setNombre('');
        setPrecio(0);
        setSelectedProducto(null);
      } else alert('Error al guardar producto');
    } catch (err) {
      console.error('Error al guardar producto:', err);
    } finally { setLoading(false); }
  };

  /* ───────── eliminar ───────── */
  const eliminarProducto = async (id) => {
    if (!confirm('¿Estás seguro que querés eliminar este producto?')) return;
    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await cargarProductos();
        setSelectedProducto(null);
      } else alert('Error al eliminar producto');
    } catch (err) {
      console.error('Error al eliminar producto:', err);
    } finally { setLoading(false); }
  };

  /* ───────── opciones del Select ───────── */
  const productoOptions = useMemo(() =>
    productos.map(p => ({
      value : p.id,
      label : p.nombre,            // 👈 se quita el precio
      nombre: p.nombre,
      precio: p.precio
    })), [productos]);

  const cargarProductoParaEditar = (producto) => {
    setSelectedProducto(producto);
    setNombre(producto.nombre);
    setPrecio(producto.precio);
  };

  /* ───────── UI ───────── */
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Gestión de Productos</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Seleccionar producto:</label>
        <Select
          options={productoOptions}
          value={selectedProducto}
          onChange={cargarProductoParaEditar}
          isDisabled={loading}
          className="w-full"
          placeholder="Seleccionar producto"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
          disabled={loading}
        />
        {/* 🔸 Se ocultó el campo Precio */}
        <button
          onClick={agregarProducto}
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {selectedProducto ? 'Actualizar' : 'Agregar'}
        </button>
        {selectedProducto && (
          <>
            <button
              onClick={() => {
                setNombre('');
                setPrecio(0);
                setSelectedProducto(null);
              }}
              disabled={loading}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => eliminarProducto(selectedProducto.value)}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
