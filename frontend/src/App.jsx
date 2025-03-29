// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LayoutApp from './LayoutApp';
import Login from './components/Login';
import Register from './components/Register';
import { obtenerToken, borrarToken } from './auth';
import './App.css';

function App() {
  const [logueado, setLogueado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const token = obtenerToken();
    console.log("Token:", token);

    if (!token) {
      console.log("No se encontró token");
      setLogueado(false); // importante
      setVerificando(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log("Payload:", payload);

      const exp = payload.exp * 1000;
      const activo = payload.activo;

      if (Date.now() >= exp || !activo) {
        console.log("Token expirado o cuenta inactiva");
        borrarToken();
        setLogueado(false);
      } else {
        console.log("Token válido y cuenta activa");
        setLogueado(true);
      }
    } catch (e) {
      console.log("Error al decodificar token:", e);
      borrarToken();
      setLogueado(false); // importante
    }

    setVerificando(false);
  }, []);

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
        {!logueado ? (
          <>
            <Route path="/" element={<Login onLoginSuccess={() => setLogueado(true)} />} />
            <Route path="/registro" element={<Register />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          <>
            <Route path="/*" element={<LayoutApp onLogout={() => setLogueado(false)} />} />
            <Route path="*" element={<Navigate to="/clientes" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
