import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Pedidos from './components/Pedidos';
import HistorialPedidos from './components/HistorialPedidos';
import Login from './components/Login';
import { estaAutenticado, guardarToken, obtenerToken, borrarToken } from './auth';

export default function App() {
  const navigate = useNavigate();
  const [logueado, setLogueado] = useState(estaAutenticado());

  useEffect(() => {
    // Handle auto logout if the token is no longer valid
    if (!estaAutenticado()) {
      setLogueado(false);
    }
  }, []);

  const handleLogout = () => {
    borrarToken();
    setLogueado(false);
    navigate('/');  // Redirect to login page after logging out
  };

  if (!logueado) {
    return <Login onLoginSuccess={() => setLogueado(true)} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 text-gray-800 flex flex-col items-center">
        <div className="w-full max-w-md">
          <header className="text-center mb-6">
            <h1 className="text-3xl font-extrabold text-blue-700">❄️ Casa de Congelados</h1>
            <p className="text-sm text-blue-500">Gestión de Clientes, Productos, Pedidos y Historial</p>
          </header>

          <nav className="flex justify-center gap-2 mb-6 flex-wrap">
            <Link
              to="/clientes"
              className="px-4 py-2 rounded bg-white text-blue-600"
            >
              Clientes
            </Link>
            <Link
              to="/productos"
              className="px-4 py-2 rounded bg-white text-blue-600"
            >
              Productos
            </Link>
            <Link
              to="/pedidos"
              className="px-4 py-2 rounded bg-white text-blue-600"
            >
              Pedidos
            </Link>
            <Link
              to="/historial"
              className="px-4 py-2 rounded bg-white text-blue-600"
            >
              Historial de Pedidos
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded bg-red-600 text-white"
            >
              Logout
            </button>
          </nav>

          <section className="bg-white rounded-2xl shadow p-4">
            <Routes>
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/historial" element={<HistorialPedidos />} />
            </Routes>
          </section>

          <footer className="text-center mt-10 text-sm text-blue-400">
            © 2025 Casa de Congelados. Todos los derechos reservados.
          </footer>
        </div>
      </div>
    </Router>
  );
}
