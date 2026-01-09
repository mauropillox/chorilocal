// frontend/src/components/Login.jsx
import { useState } from 'react';
import { guardarToken } from '../auth';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

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
      try { window.dispatchEvent(new CustomEvent('auth_changed')); } catch (e) { }
      onLoginSuccess(); // dispara setLogueado(true)
      setLoading(false);
    } catch (err) {
      logger.error('Login error:', err);
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
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧊</div>
        <h2 className="auth-title">FRIOSUR - Pedidos</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Sistema de gestión de pedidos
        </p>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <span style={{ marginRight: '6px' }}>⚠️</span>{error}
        </div>
      )}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="login-username" style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', display: 'block', color: 'var(--color-text)' }}>
            👤 Usuario
          </label>
          <input
            id="login-username"
            type="text"
            placeholder="Ingresá tu usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
            aria-label="Usuario"
            aria-describedby="username-help"
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password" style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', display: 'block', color: 'var(--color-text)' }}>
            🔒 Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            placeholder="Ingresá tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-label="Contraseña"
          />
        </div>
        <button type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span className="spinner-small"></span> Ingresando...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              🚀 Ingresar
            </span>
          )}
        </button>
      </form>
      <p>
        ¿No tenés cuenta? <a href="/registro">Registrate aquí</a>
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        💡 Tip: Si olvidaste tu contraseña, contactá al administrador
      </p>
    </div>
  );
}
