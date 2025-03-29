// Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { guardarToken } from '../auth';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const form = new URLSearchParams();
      form.append('username', username);
      form.append('password', password);
      const res = await fetch(import.meta.env.VITE_API_URL + '/login', {
        method: 'POST',
        body: form
      });
      if (!res.ok) throw new Error('Error de login');
      const data = await res.json();
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      if (!payload.activo) {
        setError('Tu cuenta aún no fue activada por un administrador.');
        return;
      }
      guardarToken(data.access_token);
      onLoginSuccess();
      navigate('/clientes');
    } catch (err) {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="border p-2 rounded"
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 rounded"
      />
      <button type="submit" className="bg-blue-600 text-white py-2 rounded">
        Iniciar Sesión
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <p className="text-sm text-gray-600">¿No tenés cuenta? <Link to="/registro" className="text-blue-500">Registrate acá</Link></p>
    </form>
  );
}