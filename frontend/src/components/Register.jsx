// frontend/src/components/Register.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }

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
        return;
      }

      setOk(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">Registro de Usuario</h2>
      {error && <p className="auth-error">{error}</p>}
      {ok && <p className="auth-success">Usuario creado. Esperá aprobación del administrador.</p>}

      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
        <input
          type="password"
          placeholder="Confirmar Contraseña"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          required
          aria-label="Confirmar Contraseña"
        />
        <button type="submit">
          Registrarse
        </button>
      </form>

      <p>
        ¿Ya tenés cuenta? <a href="/">Iniciá sesión</a>
      </p>
    </div>
  );
}
