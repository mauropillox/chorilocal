// frontend/src/components/Login.jsx
import { useState } from 'react';
import { guardarToken } from '../auth';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Error al iniciar sesión');
        return;
      }

      guardarToken(data.access_token);
      onLoginSuccess(); // dispara setLogueado(true)
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4 text-center text-blue-600">Iniciar Sesión</h2>
      {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Ingresar
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        ¿No tenés cuenta? <a href="/registro" className="text-blue-600 hover:underline">Registrate</a>
      </p>
    </div>
  );
}
