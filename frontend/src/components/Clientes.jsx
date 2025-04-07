import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/clientes`);
    if (res.ok) {
      const data = await res.json();
      setClientes(data);
    } else {
      console.error("Error al cargar clientes:", res.status);
    }
  };

  const agregarCliente = async () => {
    if (!nombre) return alert('Debe ingresar un nombre');

    const payload = { nombre, telefono, direccion };
    let url = `${import.meta.env.VITE_API_URL}/clientes`;
    let method = 'POST';

    if (selectedCliente) {
      url = `${import.meta.env.VITE_API_URL}/clientes/${selectedCliente.value}`;
      method = 'PUT';
    }

    const res = await fetchConToken(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await cargarClientes();
      setNombre('');
      setTelefono('');
      setDireccion('');
      setSelectedCliente(null);
    } else {
      alert("Error al guardar cliente");
    }
  };

  const eliminarCliente = async (id) => {
    if (!confirm("¿Estás seguro que querés eliminar este cliente?")) return;

    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/clientes/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      setClientes(clientes.filter(c => c.id !== id));
      setSelectedCliente(null);
    } else {
      alert("Error al eliminar cliente");
    }
  };

  const clienteOptions = clientes.map(c => ({
    value: c.id,
    label: `${c.nombre} (${c.telefono || 'Sin teléfono'} / ${c.direccion || 'Sin dirección'})`,
    nombre: c.nombre,
    telefono: c.telefono,
    direccion: c.direccion
  }));

  const cargarClienteParaEditar = (cliente) => {
    setSelectedCliente(cliente);
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono);
    setDireccion(cliente.direccion);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Gestión de Clientes</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Buscar y seleccionar cliente:</label>
        <Select
          options={clienteOptions}
          value={selectedCliente}
          onChange={cargarClienteParaEditar}
          isSearchable
          placeholder="Escribí para buscar..."
          className="w-full"
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
          type="text"
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
        />
        <input
          type="text"
          placeholder="Dirección"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
        />
        <button
          onClick={agregarCliente}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {selectedCliente ? 'Actualizar' : 'Agregar'}
        </button>
        {selectedCliente && (
          <>
            <button
              onClick={() => {
                setNombre('');
                setTelefono('');
                setDireccion('');
                setSelectedCliente(null);
              }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => eliminarCliente(selectedCliente.value)}
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
