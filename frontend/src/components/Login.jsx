import { useState } from 'react';
import { guardarToken } from '../auth';
import logo from '../assets/logo.png'; // Ruta relativa correcta

export default function Login({ onLoginSuccess }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        method: 'POST',
        body: new URLSearchParams({ username: usuario, password: contrasena }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const data = await response.json();

      if (response.ok) {
        guardarToken(data.access_token);
        onLoginSuccess();
      } else {
        setError(data.detail || 'Error desconocido');
      }
    } catch (err) {
      setError('Error de red o del servidor');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-center items-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="Logo" className="h-16" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-4">Iniciar Sesión</h2>

        {error && <div className="text-red-400 mb-4 text-sm text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Usuario"
            className="p-2 rounded bg-gray-700 text-white"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="p-2 rounded bg-gray-700 text-white"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
