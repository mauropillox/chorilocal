// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LayoutApp from './LayoutApp';
import Login from './components/Login';
import Register from './components/Register';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './components/AuthContext';
import { obtenerToken, borrarToken } from './auth';
import './App.css';

// Simple inline modal styles (kept minimal)
const modalStyles = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
  },
  box: { background: 'white', padding: '1rem', borderRadius: '8px', width: 'min(560px, 96%)' }
};

function App() {
  const [logueado, setLogueado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const token = obtenerToken();

    if (!token) {
      setLogueado(false);
      setVerificando(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const activo = payload.activo;

      if (Date.now() >= exp || !activo) {
        borrarToken();
        setLogueado(false);
      } else {
        setLogueado(true);
      }
    } catch (e) {
      borrarToken();
      setLogueado(false);
    }

    setVerificando(false);
  }, []);

  // Listen for auth changes from other tabs
  useEffect(() => {
    const handler = () => {
      const token = obtenerToken();
      setLogueado(!!token);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Show modal when unauthenticated event occurs (e.g., 401)
  const [showLoginModal, setShowLoginModal] = useState(false);
  useEffect(() => {
    const handler = () => {
      setShowLoginModal(true);
      setLogueado(false);
    };
    window.addEventListener('unauthenticated', handler);
    return () => window.removeEventListener('unauthenticated', handler);
  }, []);

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <p className="text-gray-600 text-sm">Verificando autenticación...</p>
      </div>
    );
  }

  // If showLoginModal is true, prioritize login modal regardless of logueado state
  if (showLoginModal) {
    return (
      <ErrorBoundary>
        <Router>
          <div style={modalStyles.backdrop} onClick={() => setShowLoginModal(false)}>
            <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
              <Login onLoginSuccess={() => { setLogueado(true); setShowLoginModal(false); }} />
            </div>
          </div>
        </Router>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
          {!logueado ? (
            <>
              <Route path="/" element={
                <div style={{
                  minHeight: '100vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-bg)',
                  padding: '1rem'
                }}>
                  <Login onLoginSuccess={() => setLogueado(true)} />
                </div>
              } />
              <Route path="/registro" element={
                <div style={{
                  minHeight: '100vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-bg)',
                  padding: '1rem'
                }}>
                  <Register />
                </div>
              } />
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
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
