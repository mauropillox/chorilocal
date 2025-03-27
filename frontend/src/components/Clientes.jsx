import { useState, useEffect } from 'react';
import Select from 'react-select';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/clientes`)
      .then(res => res.json())
      .then(data => setClientes(data));
  }, []);

  const resetFormulario = () => {
    setNombre('');
    setTelefono('');
    setDireccion('');
    setSelectedCliente(null);
  };

  const agregarOEditarCliente = async () => {
    if (!nombre) return alert("Debe ingresar un nombre");

    if (selectedCliente) {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/clientes/${selectedCliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono, direccion })
      });
      if (res.ok) {
        const actualizado = await res.json();
        setClientes(clientes.map(c => c.id === actualizado.id ? actualizado : c));
        resetFormulario();
      }
    } else {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono, direccion })
      });
      if (res.ok) {
        const nuevo = await res.json();
        setClientes([...clientes, nuevo]);
        resetFormulario();
      }
    }
  };

  const eliminarCliente = async (id) => {
    if (!confirm("¿Seguro que querés eliminar este cliente?")) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL}/clientes/${id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      setClientes(clientes.filter(c => c.id !== id));
      resetFormulario();
    }
  };

  const clienteOptions = clientes.map(c => ({
    value: c.id,
    label: c.nombre
  }));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Clientes</h2>

      <div className="mb-4">
        <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="border p-2 mr-2 rounded" />
        <input type="text" placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} className="border p-2 mr-2 rounded" />
        <input type="text" placeholder="Dirección" value={direccion} onChange={e => setDireccion(e.target.value)} className="border p-2 mr-2 rounded" />
        <button onClick={agregarOEditarCliente} className="bg-blue-500 text-white px-4 py-2 rounded">
          {selectedCliente ? "Guardar cambios" : "Agregar"}
        </button>
        {selectedCliente && (
          <button onClick={resetFormulario} className="ml-2 text-gray-500 underline">Cancelar</button>
        )}
      </div>

      <div className="mb-4">
        <Select
          options={clienteOptions}
          value={selectedCliente ? { value: selectedCliente.id, label: selectedCliente.nombre } : null}
          onChange={(option) => {
            const cliente = clientes.find(c => c.id === option.value);
            setSelectedCliente(cliente);
            setNombre(cliente.nombre);
            setTelefono(cliente.telefono);
            setDireccion(cliente.direccion);
          }}
          placeholder="Seleccionar cliente..."
          className="w-full"
        />
      </div>

      {selectedCliente && (
        <div className="bg-blue-50 border p-4 rounded shadow-md mt-2 space-y-2">
          <h3 className="font-bold text-lg text-blue-700">📋 Cliente seleccionado</h3>
          <p><strong>Nombre:</strong> {selectedCliente.nombre}</p>
          <p><strong>Teléfono:</strong> {selectedCliente.telefono || "No especificado"}</p>
          <p><strong>Dirección:</strong> {selectedCliente.direccion || "No especificado"}</p>
          <div className="flex justify-end">
            <button
              onClick={() => eliminarCliente(selectedCliente.id)}
              className="text-red-600 border border-red-600 px-4 py-1 rounded hover:bg-red-600 hover:text-white"
            >
              Eliminar cliente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
