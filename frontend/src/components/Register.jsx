// frontend/src/components/Register.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password strength validation
  const passwordValid = password.length >= 8;
  const passwordHasLetter = /[a-zA-Z]/.test(password);
  const passwordHasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmacion && confirmacion.length > 0;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!passwordValid || !passwordHasLetter || !passwordHasNumber) {
      setError('La contraseña no cumple los requisitos mínimos');
      return;
    }

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('grant_type', '');
      formData.append('scope', '');
      formData.append('client_id', '');
      formData.append('client_secret', '');

      const res = await fetch(`${import.meta.env.VITE_API_URL}/register`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Error al registrar');
        setLoading(false);
        return;
      }

      setOk(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      logger.error('Registration error:', err);
      setError('Error de conexión. Verificá tu internet.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧊</div>
        <h2 className="auth-title">Crear Cuenta</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Registrate para acceder al sistema
        </p>
      </div>

      {error && (
        <div className="auth-error" role="alert">
          <span style={{ marginRight: '6px' }}>⚠️</span>{error}
        </div>
      )}
      {ok && (
        <div className="auth-success" role="status">
          <span style={{ marginRight: '6px' }}>✅</span>
          Usuario creado exitosamente. Esperá aprobación del administrador.
          <br />
          <small>Redirigiendo al login...</small>
        </div>
      )}

      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="reg-username" style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', display: 'block', color: 'var(--color-text)' }}>
            👤 Nombre de usuario
          </label>
          <input
            id="reg-username"
            type="text"
            placeholder="Elegí un nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            aria-label="Usuario"
            minLength={3}
          />
          <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
            Mínimo 3 caracteres, sin espacios
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="reg-password" style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', display: 'block', color: 'var(--color-text)' }}>
            🔒 Contraseña
          </label>
          <input
            id="reg-password"
            type="password"
            placeholder="Creá una contraseña segura"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            aria-label="Contraseña"
            aria-describedby="password-requirements"
          />
          {/* Password strength indicators */}
          <div id="password-requirements" style={{ marginTop: '8px', fontSize: '0.75rem' }}>
            <div style={{ color: passwordValid ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {passwordValid ? '✅' : '○'} Mínimo 8 caracteres
            </div>
            <div style={{ color: passwordHasLetter ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {passwordHasLetter ? '✅' : '○'} Al menos una letra
            </div>
            <div style={{ color: passwordHasNumber ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {passwordHasNumber ? '✅' : '○'} Al menos un número
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="reg-confirm" style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', display: 'block', color: 'var(--color-text)' }}>
            🔒 Confirmar Contraseña
          </label>
          <input
            id="reg-confirm"
            type="password"
            placeholder="Repetí la contraseña"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoComplete="new-password"
            required
            aria-label="Confirmar Contraseña"
            style={{ borderColor: confirmacion && !passwordsMatch ? '#ef4444' : undefined }}
          />
          {confirmacion && (
            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: passwordsMatch ? '#10b981' : '#ef4444' }}>
              {passwordsMatch ? '✅ Las contraseñas coinciden' : '❌ Las contraseñas no coinciden'}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !passwordValid || !passwordHasLetter || !passwordHasNumber || !passwordsMatch}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span className="spinner-small"></span> Creando cuenta...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              ✨ Crear cuenta
            </span>
          )}
        </button>
      </form>

      <p>
        ¿Ya tenés cuenta? <a href="/">Iniciá sesión</a>
      </p>

      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-accent)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <strong>ℹ️ Nota:</strong> Después de registrarte, un administrador debe aprobar tu cuenta antes de que puedas acceder.
      </div>
    </div>
  );
}
