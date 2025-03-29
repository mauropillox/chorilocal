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
    if (!token) {
      console.log("Token no encontrado o inválido.");
      setVerificando(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const activo = payload.activo;

      if (Date.now() >= exp || !activo) {
        console.log("Token expirado o cuenta inactiva.");
        borrarToken();
        setLogueado(false);
      } else {
        setLogueado(true);
      }
    } catch (e) {
      console.log("Error al decodificar token:", e);
      borrarToken();
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
            <Route path="/registro" element={<Register />} />
            <Route path="*" element={<Login onLoginSuccess={() => setLogueado(true)} />} />
          </>
        ) : (
          <Route path="/*" element={<LayoutApp onLogout={() => setLogueado(false)} />} />
        )}
      </Routes>

      {/* Botón de logout forzado para testing */}
      {logueado && (
        <button
          onClick={() => {
            borrarToken();
            window.location.reload();
          }}
          className="fixed bottom-2 right-2 bg-yellow-500 text-white px-3 py-1 rounded shadow-lg text-xs z-50"
        >
          🧪 Logout Dev
        </button>
      )}
    </Router>
  );
}

export default App;
