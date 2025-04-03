// Productos.jsx
import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos`);
    if (res.ok) {
      const data = await res.json();
      setProductos(data);
    } else {
      console.error("Error al cargar productos");
    }
  };

  const agregarProducto = async () => {
    if (!nombre || !precio) return alert('Debe ingresar nombre y precio');

    const payload = { nombre, precio: parseFloat(precio) };
    let url = `${import.meta.env.VITE_API_URL}/productos`;
    let method = 'POST';

    if (selectedProducto) {
      url = `${import.meta.env.VITE_API_URL}/productos/${selectedProducto.value}`;
      method = 'PUT';
    }

    const res = await fetchConToken(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await cargarProductos();
      setNombre('');
      setPrecio('');
      setSelectedProducto(null);
    } else {
      alert("Error al guardar producto");
    }
  };

  const eliminarProducto = async (id) => {
    if (!confirm('¿Estás seguro que querés eliminar este producto?')) return;

    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      setProductos(productos.filter(p => p.id !== id));
      setSelectedProducto(null);
    } else {
      alert("Error al eliminar producto");
    }
  };

  const productoOptions = productos.map(p => ({
    value: p.id,
    label: `${p.nombre} ($${p.precio})`,
    nombre: p.nombre,
    precio: p.precio
  }));

  const cargarProductoParaEditar = (producto) => {
    setSelectedProducto(producto);
    setNombre(producto.nombre);
    setPrecio(producto.precio);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Gestión de Productos</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Seleccionar producto:</label>
        <Select
          options={productoOptions}
          value={selectedProducto}
          onChange={cargarProductoParaEditar}
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
        />
        <input
          type="number"
          step="0.01"
          placeholder="Precio"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
        />
        <button
          onClick={agregarProducto}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {selectedProducto ? 'Actualizar' : 'Agregar'}
        </button>
        {selectedProducto && (
          <button
            onClick={() => {
              setNombre('');
              setPrecio('');
              setSelectedProducto(null);
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Cancelar
          </button>
        )}
        {selectedProducto && (
          <button
            onClick={() => eliminarProducto(selectedProducto.value)}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
