import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Pedidos from './components/Pedidos';
import HistorialPedidos from './components/HistorialPedidos';
import Login from './components/Login';
import { estaAutenticado, borrarToken } from './auth';
import logo from './assets/logo.png'; // Ruta relativa a donde está tu imagen

function ContenidoApp() {
  const navigate = useNavigate();
  const [logueado, setLogueado] = useState(estaAutenticado());

  useEffect(() => {
    if (!estaAutenticado()) {
      setLogueado(false);
    }
  }, []);

  const handleLogout = () => {
    borrarToken();
    setLogueado(false);
    navigate('/');
  };

  if (!logueado) {
    return <Login onLoginSuccess={() => setLogueado(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">
        <header className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded shadow mb-4">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Frio Sur Logo" className="h-16 w-auto" />
            <div>
              <h1 className="text-3xl font-extrabold text-blue-800">Casa de Congelados</h1>
              <p className="text-sm text-gray-500">Gestión de Clientes, Productos, Pedidos y Historial</p>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap justify-center gap-3 mb-6">
          <Link to="/clientes" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Clientes</Link>
          <Link to="/productos" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Productos</Link>
          <Link to="/pedidos" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Pedidos</Link>
          <Link to="/historial" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Historial</Link>
          <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Salir</button>
        </nav>

        <main className="bg-white p-6 rounded shadow">
          <Routes>
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/historial" element={<HistorialPedidos />} />
          </Routes>
        </main>

        <footer className="text-center text-sm text-gray-500 mt-10">
          © 2025 Casa de Congelados. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ContenidoApp />
    </Router>
  );
}
