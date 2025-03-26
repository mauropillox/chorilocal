import { useState, useEffect } from 'react';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/clientes`)
      .then(res => res.json())
      .then(data => setClientes(data));
  }, []);

  const agregarCliente = async () => {
    if (!nombre) return alert("Debe ingresar un nombre");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono, direccion })
    });
    if (res.ok) {
      const nuevo = await res.json();
      setClientes([...clientes, nuevo]);
      setNombre('');
      setTelefono('');
      setDireccion('');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Clientes</h2>
      <div className="mb-4">
        <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="border p-2 mr-2" />
        <input type="text" placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} className="border p-2 mr-2" />
        <input type="text" placeholder="Dirección" value={direccion} onChange={e => setDireccion(e.target.value)} className="border p-2 mr-2" />
        <button onClick={agregarCliente} className="bg-blue-500 text-white px-4 py-2 rounded">Agregar</button>
      </div>
      <ul className="list-disc pl-5">
        {clientes.map(c => (
          <li key={c.id}>{c.nombre} ({c.telefono || "sin teléfono"}) - {c.direccion}</li>
        ))}
      </ul>
    </div>
  );
}
