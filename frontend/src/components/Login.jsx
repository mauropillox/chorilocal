// frontend/src/components/Login.jsx
import { useState } from 'react';
import { guardarToken } from '../auth';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.detail || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      if (!data || !data.access_token) {
        setError('Respuesta inválida del servidor');
        setLoading(false);
        return;
      }

      guardarToken(data.access_token);
      try { window.dispatchEvent(new CustomEvent('auth_changed')); } catch(e){}
      onLoginSuccess(); // dispara setLogueado(true)
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">Iniciar Sesión</h2>
      {error && <p className="auth-error">{error}</p>}
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          aria-label="Usuario"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="Contraseña"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <p>
        ¿No tenés cuenta? <a href="/registro">Registrate</a>
      </p>
    </div>
  );
}
