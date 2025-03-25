import { useState, useEffect } from 'react';
import Select from 'react-select';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/productos")
      .then(res => res.json())
      .then(data => setProductos(data));
  }, []);

  const productoOptions = productos.map(p => ({
    value: p.id,
    label: `${p.nombre} ($${p.precio})`
  }));

  const agregarProducto = async () => {
    if (!nombre || !precio) return alert("Debe ingresar el nombre y el precio del producto");

    const res = await fetch("http://localhost:8000/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, precio: parseFloat(precio) })
    });

    if (res.ok) {
      const nuevoProducto = await res.json();
      setProductos([...productos, nuevoProducto]);
      setNombre('');
      setPrecio('');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Productos</h2>

      {/* Dropdown para seleccionar producto */}
      <div className="flex flex-col gap-2 mb-4">
        <label className="text-sm font-medium">Seleccionar producto:</label>
        <Select
          options={productoOptions}
          value={selectedProducto}
          onChange={setSelectedProducto}
          className="w-full"
          placeholder="Seleccionar producto"
          theme={(theme) => ({
            ...theme,
            colors: {
              ...theme.colors,
              primary: "#3b82f6", // color de borde de selección
            },
          })}
        />
      </div>

      {/* Formularios para agregar producto */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="border p-2 rounded mr-2"
        />
        <input
          type="number"
          placeholder="Precio"
          value={precio}
          onChange={e => setPrecio(e.target.value)}
          className="border p-2 rounded"
        />
        <button onClick={agregarProducto} className="bg-green-600 text-white px-4 py-2 rounded ml-2">
          Agregar
        </button>
      </div>

    
   
    </div>
  );
}
