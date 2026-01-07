// frontend/src/components/Login.jsx
import { useState } from 'react';
import { guardarToken } from '../auth';
import { useAuth } from './AuthContext';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use AuthContext login to update user state
      await login(username, password);
      try { window.dispatchEvent(new CustomEvent('auth_changed')); } catch(e){}
      onLoginSuccess(); // dispara setLogueado(true)
      setLoading(false);
    } catch (err) {
      console.error(err);
      // Handle specific error messages from backend
      if (err.message) {
        setError(err.message);
      } else {
        setError('Error de conexión');
      }
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
