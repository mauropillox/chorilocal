// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Pedidos from './components/Pedidos';
import HistorialPedidos from './components/HistorialPedidos';
import Login from './components/Login';
import Register from './components/Register';
import { obtenerToken, borrarToken } from './auth';
import LayoutApp from './LayoutApp'; // Layout con header/nav/pie

export default function App() {
  const [logueado, setLogueado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const token = obtenerToken();
    if (!token) {
      setVerificando(false);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      // Si expiró o está inactivo
      if (Date.now() >= exp || payload.activo === false) {
        borrarToken();
        setVerificando(false);
        return;
      }
      setLogueado(true);
    } catch (err) {
      borrarToken();
    }
    setVerificando(false);
  }, []);

  const handleLogout = () => {
    borrarToken();
    setLogueado(false);
  };

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <p className="text-gray-600 text-sm">Verificando autenticación...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            logueado ? (
              <Navigate to="/clientes" />
            ) : (
              <Login
                onLoginSuccess={() => setLogueado(true)}
              />
            )
          }
        />
        {/* Registro */}
        <Route
          path="/registro"
          element={
            logueado ? (
              <Navigate to="/clientes" />
            ) : (
              <Register />
            )
          }
        />

        {/* Rutas protegidas */}
        <Route
          path="/clientes"
          element={
            logueado ? (
              <LayoutApp handleLogout={handleLogout}>
                <Clientes />
              </LayoutApp>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/productos"
          element={
            logueado ? (
              <LayoutApp handleLogout={handleLogout}>
                <Productos />
              </LayoutApp>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/pedidos"
          element={
            logueado ? (
              <LayoutApp handleLogout={handleLogout}>
                <Pedidos />
              </LayoutApp>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/historial"
          element={
            logueado ? (
              <LayoutApp handleLogout={handleLogout}>
                <HistorialPedidos />
              </LayoutApp>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Root: si está logueado -> clientes, si no -> login */}
        <Route
          path="/"
          element={
            logueado ? <Navigate to="/clientes" /> : <Navigate to="/login" />
          }
        />
        {/* Cualquier otra ruta -> / */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
