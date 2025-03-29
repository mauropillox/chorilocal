import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarToken } from '../auth';

export default function Login({ onLoginSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
      });

      const data = await res.json();
      if (res.ok) {
        const payload = JSON.parse(atob(data.access_token.split('.')[1]));
        if (!payload.activo) {
          setError('Tu cuenta aún no ha sido activada por un administrador.');
          return;
        }
        guardarToken(data.access_token);
        onLoginSuccess();
        navigate('/clientes');
      } else {
        setError(data.detail || 'Error al iniciar sesión');
      }
    } catch {
      setError('Error de red');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-blue-700 mb-2">Iniciar Sesión</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="username"
          placeholder="Usuario"
          value={form.username}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        />
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        />
        {error && <p className="text-red-600">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          Entrar
        </button>
      </form>
      <p className="text-sm text-blue-500 mt-4">
        ¿No tenés cuenta?{' '}
        <button onClick={() => navigate('/registro')} className="underline text-blue-700">
          Registrate
        </button>
      </p>
    </div>
  );
}
