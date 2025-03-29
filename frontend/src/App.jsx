// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Pedidos from './components/Pedidos';
import HistorialPedidos from './components/HistorialPedidos';
import Login from './components/Login';
import Register from './components/Register';
import { obtenerToken, borrarToken } from './auth';
import './App.css';

function ContenidoApp() {
  const navigate = useNavigate();
  const [logueado, setLogueado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = obtenerToken();
      console.log('Token obtenido:', token);
      if (!token) {
        console.log('No se encontró token');
        setVerificando(false);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Payload del token:', payload);
        const exp = payload.exp * 1000;
        if (Date.now() >= exp || payload.activo === false) {
          console.log('Token expirado o inactivo');
          borrarToken();
          setVerificando(false);
          return;
        }
        setLogueado(true);
      } catch (e) {
        console.log('Error al parsear el token:', e);
        borrarToken();
      }
      setVerificando(false);
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    borrarToken();
    setLogueado(false);
    navigate('/');
  };

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <p className="text-gray-600 text-sm">Verificando autenticación...</p>
      </div>
    );
  }

  return (
    <Routes>
      {!logueado ? (
        <>
          <Route path="/registro" element={<Register />} />
          <Route path="*" element={<Login onLoginSuccess={() => setLogueado(true)} />} />
        </>
      ) : (
        <>
          <Route
            path="/clientes"
            element={
              <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 text-gray-800 flex flex-col items-center">
                <div className="w-full max-w-md">
                  <header className="text-center mb-6">
                    <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-2" />
                    <h1 className="text-3xl font-extrabold text-blue-700">❄️ Casa de Congelados</h1>
                    <p className="text-sm text-blue-500">Gestión de Clientes, Productos, Pedidos y Historial</p>
                  </header>
                  <nav className="flex justify-center gap-2 mb-6 flex-wrap">
                    <Link to="/clientes" className="px-4 py-2 rounded bg-white text-blue-600">Clientes</Link>
                    <Link to="/productos" className="px-4 py-2 rounded bg-white text-blue-600">Productos</Link>
                    <Link to="/pedidos" className="px-4 py-2 rounded bg-white text-blue-600">Pedidos</Link>
                    <Link to="/historial" className="px-4 py-2 rounded bg-white text-blue-600">Historial</Link>
                    <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 text-white">Logout</button>
                  </nav>
                  <section className="bg-white rounded-2xl shadow p-4">
                    <Routes>
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/productos" element={<Productos />} />
                      <Route path="/pedidos" element={<Pedidos />} />
                      <Route path="/historial" element={<HistorialPedidos />} />
                      <Route path="*" element={<Navigate to="/clientes" />} />
                    </Routes>
                  </section>
                  <footer className="text-center mt-10 text-sm text-blue-400">
                    © 2025 Casa de Congelados. Todos los derechos reservados.
                  </footer>
                </div>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/clientes" />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <ContenidoApp />
    </Router>
  );
}
