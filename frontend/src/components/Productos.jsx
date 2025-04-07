// Productos.jsx
import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';
import { toast } from 'react-toastify';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos`);
      if (res.ok) {
        const data = await res.json();
        setProductos(data);
      } else {
        toast.error("❌ Error al cargar productos");
      }
    } catch (err) {
      console.error("Error de red:", err);
      toast.error("❌ Error de red al cargar productos");
    }
  };

  const agregarProducto = async () => {
    if (!nombre || !precio) {
      toast.info("⚠️ Ingresá nombre y precio");
      return;
    }

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
      toast.success(selectedProducto ? "✅ Producto actualizado" : "✅ Producto agregado");
      await cargarProductos();
      limpiarFormulario();
    } else {
      toast.error("❌ Error al guardar producto");
    }
  };

  const eliminarProducto = async (id) => {
    if (!confirm("¿Estás seguro que querés eliminar este producto?")) return;

    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/productos/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      toast.success("🗑️ Producto eliminado");
      await cargarProductos();
      limpiarFormulario();
    } else {
      toast.error("❌ Error al eliminar producto");
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setPrecio('');
    setSelectedProducto(null);
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
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">Gestión de Productos</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Buscar producto</label>
        <Select
          options={productoOptions}
          value={selectedProducto}
          onChange={cargarProductoParaEditar}
          className="w-full"
          placeholder="Seleccionar producto para editar"
          isClearable
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
          <>
            <button
              onClick={limpiarFormulario}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => eliminarProducto(selectedProducto.value)}
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
