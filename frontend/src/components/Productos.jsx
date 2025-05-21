import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ─── Cargar productos ─── */
  useEffect(() => { cargarProductos(); }, []);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos`);
      if (res.ok) setProductos(await res.json());
      else alert('Error al cargar productos');
    } catch (e) { console.error(e); }
    finally     { setLoading(false); }
  };

  /* ─── Alta / edición ─── */
  const guardarProducto = async () => {
    if (!nombre.trim()) return alert('Ingresa un nombre');

    const url    = selectedProducto
      ? `${import.meta.env.VITE_API_URL}/productos/${selectedProducto.value}`
      : `${import.meta.env.VITE_API_URL}/productos`;
    const method = selectedProducto ? 'PUT' : 'POST';

    setLoading(true);
    try {
      const res = await fetchConToken(url, {
        method,
        body: JSON.stringify({ nombre })
      });
      if (res.ok) {
        await cargarProductos();
        setNombre('');
        setSelectedProducto(null);
      } else alert('Error al guardar producto');
    } catch (e) { console.error(e); }
    finally     { setLoading(false); }
  };

  /* ─── Eliminar ─── */
  const eliminarProducto = async () => {
    if (!selectedProducto) return;
    if (!confirm('¿Eliminar producto?')) return;

    setLoading(true);
    try {
      await fetchConToken(
        `${import.meta.env.VITE_API_URL}/productos/${selectedProducto.value}`,
        { method: 'DELETE' }
      );
      await cargarProductos();
      setNombre('');
      setSelectedProducto(null);
    } catch (e) { console.error(e); }
    finally     { setLoading(false); }
  };

  /* ─── Options del select ─── */
  const productoOptions = useMemo(() =>
    productos.map(p => ({ value: p.id, label: p.nombre })), [productos]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Gestión de Productos</h2>

      <label className="block text-sm mb-1">Seleccionar producto:</label>
      <Select
        options={productoOptions}
        value={selectedProducto}
        onChange={opt => {
          setSelectedProducto(opt);
          const prod = productos.find(p => p.id === opt?.value);
          setNombre(prod?.nombre ?? '');
        }}
        isDisabled={loading}
        className="mb-4"
        placeholder="Seleccionar producto"
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          className="border p-2 rounded w-full sm:w-auto"
          placeholder="Nombre"
          value={nombre}
          disabled={loading}
          onChange={e => setNombre(e.target.value)}
        />

        <button
          onClick={guardarProducto}
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {selectedProducto ? 'Actualizar' : 'Agregar'}
        </button>

        {selectedProducto && (
          <>
            <button
              onClick={() => { setNombre(''); setSelectedProducto(null); }}
              disabled={loading}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={eliminarProducto}
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
