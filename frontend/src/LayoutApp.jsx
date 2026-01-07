import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';

// Lazy load de componentes pesados para mejor performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const Clientes = lazy(() => import('./components/Clientes'));
const Productos = lazy(() => import('./components/Productos'));
const Pedidos = lazy(() => import('./components/Pedidos'));
const HistorialPedidos = lazy(() => import('./components/HistorialPedidos'));
const Ofertas = lazy(() => import('./components/Ofertas'));
const Reportes = lazy(() => import('./components/Reportes'));
const ListasPrecios = lazy(() => import('./components/ListasPrecios'));
const Templates = lazy(() => import('./components/Templates'));
const Usuarios = lazy(() => import('./components/Usuarios'));
const Categorias = lazy(() => import('./components/Categorias'));
const CambiarPassword = lazy(() => import('./components/CambiarPassword'));

import ConnectionStatus from './components/ConnectionStatus';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import './App.css';
import { borrarToken } from './auth';
import { useAuth } from './components/AuthContext';
import ToastContainer from './components/ToastContainer';
import ThemeToggle from './components/ThemeToggle';
import authFetch from './authFetch';
import OfflineNotifier from './components/OfflineNotifier';
import OfflineQueue from './components/OfflineQueue';

// Loading fallback para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center" style={{ minHeight: '200px' }}>
    <div className="text-center">
      <div className="text-4xl mb-2">⏳</div>
      <div style={{ color: 'var(--color-text-muted)' }}>Cargando...</div>
    </div>
  </div>
);

export default function LayoutApp({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);
  const [ofertasCount, setOfertasCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Cargar contador de ofertas activas
  useEffect(() => {
    const loadOfertasCount = async () => {
      try {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/ofertas/activas`);
        if (res.ok) {
          const data = await res.json();
          setOfertasCount(data.length);
        }
      } catch (e) {
        console.error('Error loading ofertas count:', e);
      }
    };
    loadOfertasCount();
    // Refresh every 60 seconds
    const interval = setInterval(loadOfertasCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Búsqueda global con AbortController para cancelar requests anteriores
  useEffect(() => {
    const controller = new AbortController();

    const debounceSearch = setTimeout(async () => {
      if (globalSearch.trim().length < 2) {
        setSearchResults(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        const q = globalSearch.trim().toLowerCase();
        const [clientesRes, productosRes] = await Promise.all([
          authFetch(`${import.meta.env.VITE_API_URL}/clientes`, { signal: controller.signal }),
          authFetch(`${import.meta.env.VITE_API_URL}/productos`, { signal: controller.signal })
        ]);

        // Check if aborted before processing response
        if (controller.signal.aborted) return;

        const clientes = clientesRes.ok ? await clientesRes.json() : [];
        const productos = productosRes.ok ? await productosRes.json() : [];

        const filteredClientes = clientes.filter(c =>
          c.nombre?.toLowerCase().includes(q) ||
          c.telefono?.includes(q)
        ).slice(0, 5);

        const filteredProductos = productos.filter(p =>
          p.nombre?.toLowerCase().includes(q)
        ).slice(0, 5);

        setSearchResults({ clientes: filteredClientes, productos: filteredProductos });
      } catch (e) {
        // Ignore abort errors
        if (e.name !== 'AbortError') {
          console.error('Search error:', e);
        }
      } finally {
        // Only update searching state if not aborted
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(debounceSearch);
      controller.abort(); // Cancel any in-flight requests
    };
  }, [globalSearch]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        navigate('/clientes');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        navigate('/productos');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault();
        navigate('/pedidos');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '4') {
        e.preventDefault();
        navigate('/historial');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '5') {
        e.preventDefault();
        navigate('/dashboard');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '6') {
        e.preventDefault();
        navigate('/categorias');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        // Navegar a la sección actual en modo "nuevo"
        const path = location.pathname;
        if (path.includes('clientes')) document.querySelector('[data-action="nuevo-cliente"]')?.click();
        else if (path.includes('productos')) document.querySelector('[data-action="nuevo-producto"]')?.click();
        else if (path.includes('pedidos')) document.querySelector('[data-action="nuevo-pedido"]')?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'Escape') {
        setGlobalSearch('');
        setSearchResults(null);
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    // Invalidate token on server (token blacklist)
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${import.meta.env.VITE_API_URL}/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (e) {
      // Ignore errors - we're logging out anyway
      console.warn('Logout API call failed:', e);
    }
    borrarToken();
    if (onLogout) onLogout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // Obtener nombre de usuario del token (usando auth module)
  const getUserName = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') return 'Usuario';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.username || 'Usuario';
    } catch (e) { }
    return 'Usuario';
  };

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Connection Status Banner */}
      <ConnectionStatus />

      {/* Skip link para accesibilidad */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <div className="w-full max-w-5xl px-4">
        {/* Header compacto con logo */}
        <header className="header-compact" role="banner">
          <div className="header-brand">
            <img src="/logo-friosur.png" alt="FRIOSUR - Alimentos Congelados" className="header-logo" style={{ height: '50px', width: 'auto' }} />
            <p className="header-subtitle" style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>Sistema de Gestión de Pedidos</p>
          </div>

          {/* Global Search */}
          <div style={{ position: 'relative', flex: '0 1 300px' }}>
            <input
              id="global-search"
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="🔍 Buscar... (Ctrl+K)"
              style={{
                width: '100%',
                padding: '8px 12px',
                paddingRight: '30px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.875rem'
              }}
            />
            {globalSearch && (
              <button
                onClick={() => { setGlobalSearch(''); setSearchResults(null); }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: '2px',
                  minHeight: 'auto'
                }}
              >
                ✕
              </button>
            )}

            {/* Search Results Dropdown */}
            {searchResults && (globalSearch.trim().length >= 2) && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 1000,
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                {searching && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Buscando...</div>}

                {!searching && searchResults.clientes.length === 0 && searchResults.productos.length === 0 && (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No se encontraron resultados
                  </div>
                )}

                {searchResults.clientes.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      👥 CLIENTES
                    </div>
                    {searchResults.clientes.map(c => (
                      <div
                        key={c.id}
                        onClick={() => { navigate(`/clientes?buscar=${encodeURIComponent(c.nombre)}`); setGlobalSearch(''); setSearchResults(null); }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--color-border)',
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{c.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{c.telefono || 'Sin teléfono'}</div>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.productos.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      📦 PRODUCTOS
                    </div>
                    {searchResults.productos.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { navigate(`/productos?buscar=${encodeURIComponent(p.nombre)}`); setGlobalSearch(''); setSearchResults(null); }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--color-border)',
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>${p.precio} - Stock: {p.stock || 0}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="header-user">
            <span className="user-badge" aria-label={`Usuario: ${getUserName()}`}>👤 {getUserName()}</span>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="btn-ghost"
              style={{ padding: '6px 10px', fontSize: '0.875rem' }}
              aria-label="Cambiar contraseña"
              title="Cambiar contraseña"
            >
              🔐
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Offline notifier */}
        <OfflineNotifier />

        {/* Navegación principal - COMPACTA CON DROPDOWNS */}
        <nav className="nav-main" role="navigation" aria-label="Navegación principal">
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>

          <div className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`}>
            {/* Grupo Principal */}
            <Link to="/clientes" className={`nav-link ${isActive('/clientes') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">👥</span>
              <span className="nav-text">Clientes</span>
            </Link>
            <Link to="/productos" className={`nav-link ${isActive('/productos') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">📦</span>
              <span className="nav-text">Productos</span>
            </Link>
            <Link to="/pedidos" className={`nav-link ${isActive('/pedidos') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">🛒</span>
              <span className="nav-text">Pedidos</span>
            </Link>
            <Link to="/historial" className={`nav-link ${isActive('/historial') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">📋</span>
              <span className="nav-text">Historial</span>
            </Link>

            {isAdmin && (
              <>
                <span className="nav-separator">|</span>

                {/* Grupo Análisis - Solo Admin */}
                <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">Dashboard</span>
                </Link>

                {/* Grupo Promociones - Solo Admin */}
                <Link to="/ofertas" className={`nav-link nav-link-with-badge ${isActive('/ofertas') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">🎁</span>
                  <span className="nav-text">Ofertas</span>
                  {ofertasCount > 0 && <span className="badge-count badge-ofertas">{ofertasCount}</span>}
                </Link>
                <Link to="/templates" className={`nav-link ${isActive('/templates') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">🔄</span>
                  <span className="nav-text">Recurrentes</span>
                </Link>

                <span className="nav-separator">|</span>

                {/* Grupo Admin (compacto) - Solo Admin */}
                <Link to="/categorias" className={`nav-link ${isActive('/categorias') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">🏷️</span>
                  <span className="nav-text">Categorías</span>
                </Link>
                <Link to="/usuarios" className={`nav-link ${isActive('/usuarios') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">⚙️</span>
                  <span className="nav-text">Admin</span>
                </Link>
              </>
            )}
          </div>

          <button onClick={handleLogout} className="btn-logout" aria-label="Cerrar sesión" title="Cerrar sesión">
            🚪 Salir
          </button>
        </nav>

        {/* Breadcrumb / ubicación actual */}
        <div className="breadcrumb">
          <span className="breadcrumb-home" onClick={() => navigate(isAdmin ? '/dashboard' : '/clientes')}>🏠 Inicio</span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">
            {location.pathname === '/clientes' && '👥 Clientes'}
            {location.pathname === '/productos' && '📦 Productos'}
            {location.pathname === '/pedidos' && '🛒 Nuevo Pedido'}
            {location.pathname === '/historial' && '📋 Historial'}
            {location.pathname === '/dashboard' && '📊 Dashboard'}
            {location.pathname === '/reportes' && '📈 Reportes'}
            {location.pathname === '/listas-precios' && '💲 Listas de Precios'}
            {location.pathname === '/templates' && '🔄 Pedidos Recurrentes'}
            {location.pathname === '/ofertas' && '� Ofertas'}
            {location.pathname === '/usuarios' && '⚙️ Administración'}
            {location.pathname === '/categorias' && '🏷️ Categorías'}
          </span>
        </div>

        {/* Sub-navegación para herramientas de análisis (visible solo para admin cuando está en dashboard/reportes/precios) */}
        {isAdmin && ['/dashboard', '/reportes', '/listas-precios'].includes(location.pathname) && (
          <div className="sub-nav" style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.5rem 0',
            marginBottom: '0.5rem',
            borderBottom: '1px solid var(--color-border)'
          }}>
            <Link to="/dashboard" className={`sub-nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
              📊 Dashboard
            </Link>
            <Link to="/reportes" className={`sub-nav-link ${isActive('/reportes') ? 'active' : ''}`}>
              📈 Reportes
            </Link>
            <Link to="/listas-precios" className={`sub-nav-link ${isActive('/listas-precios') ? 'active' : ''}`}>
              💲 Listas de Precios
            </Link>
          </div>
        )}

        <section id="main-content" className="main-content" role="main">
          <ToastContainer />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Rutas para todos los usuarios */}
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/historial" element={<HistorialPedidos />} />
              <Route path="/cambiar-password" element={<CambiarPassword onClose={() => navigate(-1)} />} />

              {/* Rutas solo para Admin */}
              <Route path="/dashboard" element={isAdmin ? <Dashboard /> : <Navigate to="/clientes" />} />
              <Route path="/offline-queue" element={isAdmin ? <OfflineQueue /> : <Navigate to="/clientes" />} />
              <Route path="/ofertas" element={isAdmin ? <Ofertas /> : <Navigate to="/clientes" />} />
              <Route path="/reportes" element={isAdmin ? <Reportes /> : <Navigate to="/clientes" />} />
              <Route path="/listas-precios" element={isAdmin ? <ListasPrecios /> : <Navigate to="/clientes" />} />
              <Route path="/templates" element={isAdmin ? <Templates /> : <Navigate to="/clientes" />} />
              <Route path="/usuarios" element={isAdmin ? <Usuarios /> : <Navigate to="/clientes" />} />
              <Route path="/categorias" element={isAdmin ? <Categorias /> : <Navigate to="/clientes" />} />

              {/* Ruta por defecto según rol */}
              <Route path="*" element={<Navigate to={isAdmin ? "/dashboard" : "/clientes"} />} />
            </Routes>
          </Suspense>
        </section>

        {/* Modal de Atajos de Teclado */}
        <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

        {/* Modal de Cambio de Contraseña */}
        {showPasswordModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }} onClick={() => setShowPasswordModal(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(450px, 95%)' }}>
              <CambiarPassword onClose={() => setShowPasswordModal(false)} />
            </div>
          </div>
        )}

        {/* Footer con atajos */}
        <footer className="app-footer">
          <div className="footer-left">
            © 2025 Frio Sur - Casa de Congelados
          </div>
          <div className="footer-shortcuts" title="Presiona Ctrl+? para ver todos los atajos" aria-label="Atajos de teclado">
            <div className="footer-shortcut-item">
              <kbd className="shortcut-badge">Ctrl+K</kbd>
              <span className="shortcut-label">Buscar</span>
            </div>
            <div className="footer-shortcut-item">
              <kbd className="shortcut-badge">Ctrl+1</kbd>
              <span className="shortcut-label">Clientes</span>
            </div>
            <div className="footer-shortcut-item">
              <kbd className="shortcut-badge">Ctrl+2</kbd>
              <span className="shortcut-label">Productos</span>
            </div>
            <div className="footer-shortcut-item">
              <kbd className="shortcut-badge">Ctrl+3</kbd>
              <span className="shortcut-label">Pedidos</span>
            </div>
            <div className="footer-shortcut-item">
              <kbd className="shortcut-badge">Ctrl+4</kbd>
              <span className="shortcut-label">Historial</span>
            </div>
            <div className="footer-shortcut-item">
              <kbd className="shortcut-badge shortcut-help">Ctrl+?</kbd>
              <span className="shortcut-label">Ayuda</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
