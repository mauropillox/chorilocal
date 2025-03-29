import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const data = new URLSearchParams();
    data.append('username', username);
    data.append('password', password);

    const res = await fetch(`${import.meta.env.VITE_API_URL}/register`, {
      method: 'POST',
      body: data,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (res.ok) {
      setMensaje('✅ Usuario registrado con éxito. Iniciá sesión.');
      setTimeout(() => navigate('/'), 2000);
    } else {
      const err = await res.json();
      setMensaje('❌ ' + (err.detail || 'Error al registrar usuario'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded-xl shadow-md w-80">
        <h2 className="text-2xl font-bold text-center text-blue-600 mb-4">Registro</h2>

        <input type="text" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} className="w-full mb-4 px-3 py-2 border rounded" required />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full mb-4 px-3 py-2 border rounded" required />

        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Registrarse</button>
        {mensaje && <p className="text-sm mt-2 text-center text-gray-600">{mensaje}</p>}
      </form>
    </div>
  );
}
