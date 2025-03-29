import { useState } from "react";
import { useNavigate } from "react-router-dom";
// Importamos la función que ya existe en auth.js:
import { guardarToken } from "../auth";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Ojo: Asumimos que tu backend define el endpoint /login
    // y devuelve { "access_token": "..." } al iniciar sesión.
    const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: usuario,
        password: password,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      // Usamos guardarToken(token) de auth.js:
      guardarToken(data.access_token);
      navigate("/clientes");
    } else {
      setError("Credenciales incorrectas");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96 space-y-4">
        <h2 className="text-xl font-bold text-center">Iniciar Sesión</h2>
        {error && <div className="text-red-600">{error}</div>}
        <input
          type="text"
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <button type="submit" className="bg-blue-600 text-white w-full py-2 rounded">
          Entrar
        </button>
      </form>
    </div>
  );
}
