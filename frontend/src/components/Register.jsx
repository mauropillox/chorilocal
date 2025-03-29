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
    <div className="bg-white p-6 rounded-2xl shadow w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4 text-center text-blue-600">Registro de Usuario</h2>
      {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
      {ok && <p className="text-green-600 text-sm text-center mb-2">Usuario creado. Esperá aprobación.</p>}

      <form onSubmit={handleRegister} className="flex flex-col gap-3">
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
        <input
          type="password"
          placeholder="Confirmar Contraseña"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Registrarse
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        ¿Ya tenés cuenta? <a href="/" className="text-blue-600 hover:underline">Iniciá sesión</a>
      </p>
    </div>
  );
}
