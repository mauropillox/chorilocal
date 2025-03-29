import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.detail || 'Error al registrar');
      }
    } catch (err) {
      setError('Error de red');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-blue-700 mb-2">Crear Cuenta</h2>
      {success ? (
        <div className="text-green-600">
          ✅ Registro exitoso. Esperá a que un administrador active tu cuenta.
          <br />
          <button onClick={() => navigate('/')} className="mt-4 underline text-blue-600">
            Ir al login
          </button>
        </div>
      ) : (
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
            Registrarme
          </button>
        </form>
      )}
      <p className="text-sm text-blue-500 mt-4">
        ¿Ya tenés cuenta?{' '}
        <Link to="/" className="underline text-blue-700">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
