import { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchConToken } from '../auth';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/clientes`);
      if (res.ok) {
        const data = await res.json();
        setClientes(data);
      } else {
        alert("Error al cargar clientes");
      }
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    } finally {
      setLoading(false);
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

    setLoading(true);
    try {
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
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      alert("Error al guardar cliente");
    } finally {
      setLoading(false);
    }
  };

  const eliminarCliente = async (id) => {
    if (!confirm("¿Estás seguro que querés eliminar este cliente?")) return;

    setLoading(true);
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/clientes/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setClientes(clientes.filter(c => c.id !== id));
        setSelectedCliente(null);
      } else {
        alert("Error al eliminar cliente");
      }
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
      alert("Error al eliminar cliente");
    } finally {
      setLoading(false);
    }
  };

  const clienteOptions = clientes.map(c => ({
    value: c.id,
    label: `${c.nombre} (Tel: ${c.telefono || 'Sin teléfono'}, Dir: ${c.direccion || 'Sin dirección'})`,
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
        <label className="block text-sm font-medium mb-1">Seleccionar cliente:</label>
        <Select
          options={clienteOptions}
          value={selectedCliente}
          onChange={cargarClienteParaEditar}
          isDisabled={loading}
          className="w-full"
          placeholder="Seleccionar cliente"
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
        <input
          type="text"
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Dirección"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto"
          disabled={loading}
        />
        <button
          onClick={agregarCliente}
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
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
              disabled={loading}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => eliminarCliente(selectedCliente.value)}
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
