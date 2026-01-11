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
const HojaRuta = lazy(() => import('./components/HojaRuta'));

import ConnectionStatus from './components/ConnectionStatus';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { TabErrorBoundary } from './components/ErrorBoundary';
import './App.css';
import { borrarToken } from './auth';
import { useAuth } from './components/AuthContext';
import ToastContainer from './components/ToastContainer';
import ThemeToggle from './components/ThemeToggle';
import authFetch from './authFetch';
import OfflineNotifier from './components/OfflineNotifier';
import OfflineQueue from './components/OfflineQueue';
import { logger } from './utils/logger';

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
  // Role-based access: admin has full access, oficina and vendedor have limited tabs
  // Accept both 'admin' and 'administrador' roles for backwards compatibility
  const isAdmin = user?.rol === 'admin' || user?.rol === 'administrador';
  const isOficina = user?.rol === 'oficina';
  const isVendedor = user?.rol === 'vendedor'; // Corrected from 'ventas'

  // oficina and vendedor can only see: Clientes, Productos, Pedidos, Historial
  const hasLimitedAccess = isOficina || isVendedor;

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
        logger.error('Error loading ofertas count:', e);
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
          logger.error('Search error:', e);
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
        // Use authFetch to handle token and potential 401s gracefully
        await authFetch(`${import.meta.env.VITE_API_URL}/logout`, {
          method: 'POST',
        });
      }
    } catch (e) {
      // Ignore errors - we're logging out anyway
      logger.warn('Logout API call failed:', e);
    }
    borrarToken();
    if (onLogout) onLogout();
    navigate('/');
  };

  const isActive = (path) => location.pathname.startsWith(path);

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

          <div className="flex items-center space-x-4">
            {/* Global Search */}
            <div className="relative">
              <input
                id="global-search"
                type="text"
                placeholder="Buscar (Ctrl+K)"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm w-48 focus:w-64 transition-all duration-300"
              />
              <button
                onClick={() => { setGlobalSearch(''); setSearchResults(null); }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>

              {/* Search Results Dropdown */}
              {searchResults && (globalSearch.trim().length >= 2) && (
                <div
                  role="listbox"
                  aria-label="Resultados de búsqueda"
                  aria-live="polite"
                  style={{
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
                  }}
                >
                  {searching && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)' }} aria-live="polite">Buscando...</div>}

                  {!searching && searchResults.clientes.length === 0 && searchResults.productos.length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No se encontraron resultados
                    </div>
                  )}

                  {searchResults.clientes.length > 0 && (
                    <div role="group" aria-label="Clientes encontrados">
                      <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                        👥 CLIENTES
                      </div>
                      {searchResults.clientes.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { navigate(`/clientes?buscar=${encodeURIComponent(c.nombre)}`); setGlobalSearch(''); setSearchResults(null); }}
                          role="option"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--color-border)',
                            transition: 'background 0.1s',
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{c.nombre}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{c.telefono || 'Sin teléfono'}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.productos.length > 0 && (
                    <div role="group" aria-label="Productos encontrados">
                      <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                        📦 PRODUCTOS
                      </div>
                      {searchResults.productos.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { navigate(`/productos?buscar=${encodeURIComponent(p.nombre)}`); setGlobalSearch(''); setSearchResults(null); }}
                          role="option"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--color-border)',
                            transition: 'background 0.1s',
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{p.nombre}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>${p.precio} - Stock: {p.stock || 0}</div>
                        </button>
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

            {/* Ofertas - Todos pueden ver, solo admin puede editar */}
            <Link to="/ofertas" className={`nav-link nav-link-with-badge ${isActive('/ofertas') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">🎁</span>
              <span className="nav-text">Ofertas</span>
              {ofertasCount > 0 && <span className="badge-count badge-ofertas">{ofertasCount}</span>}
            </Link>

            {/* Todo lo demás es solo para Admin */}
            {isAdmin && (
              <>
                <Link to="/hoja-ruta" className={`nav-link ${isActive('/hoja-ruta') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">🚚</span>
                  <span className="nav-text">Ruta</span>
                </Link>
                <span className="nav-separator">|</span>

                {/* Grupo Análisis - Solo Admin */}
                <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">Dashboard</span>
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
          <span className="breadcrumb-home" onClick={() => navigate(isAdmin ? '/dashboard' : '/pedidos')}>🏠 Inicio</span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">
            {location.pathname === '/clientes' && '👥 Clientes'}
            {location.pathname === '/productos' && '📦 Productos'}
            {location.pathname === '/pedidos' && '🛒 Nuevo Pedido'}
            {location.pathname === '/historial' && '📋 Historial'}
            {location.pathname === '/hoja-ruta' && '🚚 Hoja de Ruta'}
            {location.pathname === '/dashboard' && '📊 Dashboard'}
            {location.pathname === '/reportes' && '📈 Reportes'}
            {location.pathname === '/listas-precios' && '💲 Listas de Precios'}
            {location.pathname === '/templates' && '🔄 Pedidos Recurrentes'}
            {location.pathname === '/ofertas' && '🎁 Ofertas'}
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
              {/* Rutas visibles para todos (admin, oficina, vendedor) */}
              <Route path="/clientes" element={<TabErrorBoundary tabName="Clientes"><Clientes /></TabErrorBoundary>} />
              <Route path="/productos" element={<TabErrorBoundary tabName="Productos"><Productos /></TabErrorBoundary>} />
              <Route path="/pedidos" element={<TabErrorBoundary tabName="Pedidos"><Pedidos /></TabErrorBoundary>} />
              <Route path="/historial" element={<TabErrorBoundary tabName="Historial"><HistorialPedidos /></TabErrorBoundary>} />
              <Route path="/cambiar-password" element={<TabErrorBoundary tabName="Cambiar Password"><CambiarPassword /></TabErrorBoundary>} />

              {/* Ofertas - Todos pueden ver, el componente maneja permisos internamente */}
              <Route path="/ofertas" element={<TabErrorBoundary tabName="Ofertas"><Ofertas /></TabErrorBoundary>} />

              {/* Rutas solo para Admin */}
              <Route path="/dashboard" element={isAdmin ? <TabErrorBoundary tabName="Dashboard"><Dashboard /></TabErrorBoundary> : <Navigate to="/pedidos" />} />
              <Route path="/reportes" element={isAdmin ? <TabErrorBoundary tabName="Reportes"><Reportes /></TabErrorBoundary> : <Navigate to="/pedidos" />} />
              <Route path="/listas-precios" element={isAdmin ? <TabErrorBoundary tabName="Listas de Precios"><ListasPrecios /></TabErrorBoundary> : <Navigate to="/pedidos" />} />
              <Route path="/templates" element={isAdmin ? <TabErrorBoundary tabName="Templates"><Templates /></TabErrorBoundary> : <Navigate to="/pedidos" />} />
              <Route path="/usuarios" element={isAdmin ? <TabErrorBoundary tabName="Usuarios"><Usuarios /></TabErrorBoundary> : <Navigate to="/pedidos" />} />
              <Route path="/categorias" element={isAdmin ? <TabErrorBoundary tabName="Categorías"><Categorias /></TabErrorBoundary> : <Navigate to="/pedidos" />} />
              <Route path="/hoja-ruta" element={isAdmin ? <TabErrorBoundary tabName="Hoja de Ruta"><HojaRuta /></TabErrorBoundary> : <Navigate to="/pedidos" />} />

              {/* Redirect from root - admin goes to dashboard, others to pedidos */}
              <Route path="/" element={<Navigate to={isAdmin ? "/dashboard" : "/pedidos"} />} />
              <Route path="*" element={<div>404 - Página no encontrada</div>} />
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
