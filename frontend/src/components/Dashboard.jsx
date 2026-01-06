import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authFetch from '../authFetch';
import { DashboardSkeleton } from './Skeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [pedidosPorDia, setPedidosPorDia] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [estadisticasUsuarios, setEstadisticasUsuarios] = useState(null);
  const [pedidosAntiguos, setPedidosAntiguos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productosEnOferta, setProductosEnOferta] = useState(new Set());

  useEffect(() => {
    cargarDatos();
    cargarOfertas();
    // Auto-refresh every 60 seconds
    const interval = setInterval(cargarDatos, 60000);
    return () => clearInterval(interval);
  }, []);

  const cargarOfertas = async () => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/ofertas/activas`);
      if (res.ok) {
        const data = await res.json();
        const ids = new Set();
        data.forEach(o => o.productos_ids.forEach(id => ids.add(id)));
        setProductosEnOferta(ids);
      }
    } catch (e) {
      console.error('Error cargando ofertas:', e);
    }
  };

  const cargarDatos = async () => {
    try {
      const [metricsRes, pedidosRes, alertasRes, statsRes, antiguosRes] = await Promise.all([
        authFetch(`${import.meta.env.VITE_API_URL}/dashboard/metrics`),
        authFetch(`${import.meta.env.VITE_API_URL}/dashboard/pedidos_por_dia?dias=30`),
        authFetch(`${import.meta.env.VITE_API_URL}/dashboard/alertas`),
        authFetch(`${import.meta.env.VITE_API_URL}/estadisticas/usuarios`),
        authFetch(`${import.meta.env.VITE_API_URL}/pedidos/antiguos?horas=24`)
      ]);

      const [metricsData, pedidosData, alertasData] = await Promise.all([
        metricsRes.json(),
        pedidosRes.json(),
        alertasRes.json()
      ]);
      
      // Handle new endpoints separately (may not exist yet)
      let statsData = null;
      let antiguosData = [];
      try {
        if (statsRes.ok) statsData = await statsRes.json();
        if (antiguosRes.ok) antiguosData = await antiguosRes.json();
      } catch { /* Stats endpoints not available */ }

      setMetrics(metricsData);
      setPedidosPorDia(pedidosData);
      setAlertas(alertasData);
      setEstadisticasUsuarios(statsData);
      setPedidosAntiguos(antiguosData);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--color-text)' }}>
          📊 Dashboard
        </h1>
        <DashboardSkeleton />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center text-gray-500 py-10">
        Error cargando datos del dashboard
      </div>
    );
  }

  const maxPedidos = Math.max(...pedidosPorDia.map(p => p.cantidad), 1);

  return (
    <div className="panel" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text)' }}>📊 Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={cargarDatos} className="btn-secondary" style={{ padding: '8px 14px', minHeight: 40 }}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Quick Actions - Acciones Rápidas */}
      <div className="card" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-muted)' }}>
          ⚡ Acciones Rápidas
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => navigate('/pedidos')} 
            className="btn-success"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>➕</span> Nuevo Pedido
          </button>
          <button 
            onClick={() => navigate('/clientes?crear=1')} 
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>👤</span> Nuevo Cliente
          </button>
          <button 
            onClick={() => navigate('/productos?crear=1')} 
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>📦</span> Nuevo Producto
          </button>
          <button 
            onClick={() => navigate('/historial')} 
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>📋</span> Ver Historial
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[{
          label: 'Clientes', value: metrics.total_clientes, from: '#0ea5e9', to: '#0284c7', route: '/clientes'
        }, {
          label: 'Productos', value: metrics.total_productos, from: '#14b8a6', to: '#0d9488', route: '/productos'
        }, {
          label: 'Pedidos Hoy', value: metrics.pedidos_hoy, from: '#06b6d4', to: '#0891b2', route: '/historial'
        }, {
          label: 'Stock Bajo', value: metrics.stock_bajo_count, from: metrics.stock_bajo_count > 0 ? '#ef4444' : '#64748b', to: metrics.stock_bajo_count > 0 ? '#dc2626' : '#475569', icon: metrics.stock_bajo_count > 0 ? '⚠️' : '', route: '/productos?stockBajo=1'
        }].map((kpi, idx) => (
          <div 
            key={idx} 
            role="button"
            tabIndex={0}
            aria-label={`${kpi.label}: ${kpi.value}. Click para ver detalles`}
            onClick={() => navigate(kpi.route)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(kpi.route); } }}
            style={{
              background: `linear-gradient(135deg, ${kpi.from} 0%, ${kpi.to} 100%)`,
              color: '#fff',
              borderRadius: '12px',
              padding: '18px',
              boxShadow: '0 8px 18px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.15)'; }}
            onFocus={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.5)'; }}
            onBlur={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.15)'; }}
          >
            <div style={{ opacity: 0.9, marginBottom: '6px', fontSize: '0.95rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {kpi.value}
              {kpi.icon && <span style={{ fontSize: '1.4rem' }} aria-hidden="true">{kpi.icon}</span>}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '6px' }}>Click para ver →</div>
          </div>
        ))}
      </div>

      {/* Pedidos del mes */}
      <div className="card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text)' }}>
          📈 Pedidos Últimos 30 Días ({metrics.pedidos_mes} total)
        </h3>
        {pedidosPorDia.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>No hay pedidos en los últimos 30 días</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pedidosPorDia.slice(-14).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '88px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  {new Date(item.fecha).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: '12px', height: '34px', position: 'relative', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <div
                    style={{
                      width: `${Math.max((item.cantidad / maxPedidos) * 100, 6)}%`,
                      background: 'linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)',
                      height: '100%',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '10px',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.95rem'
                    }}
                  >
                    {item.cantidad}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Productos */}
      <div className="card" style={{ padding: '18px' }}>
        <h3 
          onClick={() => navigate('/productos')}
          style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          🏆 Top 5 Productos Más Vendidos
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>→ Ver todos</span>
        </h3>
        {metrics.top_productos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>No hay datos de ventas</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {metrics.top_productos.map((prod, idx) => {
              const medalColors = [ '#eab308', '#9ca3af', '#fb923c' ];
              const enOferta = prod.id && productosEnOferta.has(prod.id);
              return (
                <div 
                  key={idx} 
                  onClick={() => navigate(`/productos?buscar=${encodeURIComponent(prod.nombre)}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={`Click para ver ${prod.nombre}`}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, color: '#fff',
                    background: medalColors[idx] || '#94a3b8'
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {prod.nombre}
                      {enOferta && (
                        <span 
                          onClick={(e) => { e.stopPropagation(); navigate('/ofertas'); }}
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                        >OFERTA</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{prod.cantidad} unidades vendidas</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alertas - Stock Bajo destacado */}
      {alertas.length > 0 && (
        <div style={{ 
          padding: '18px', 
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
          animation: 'pulse-border 2s infinite'
        }}>
          <h3 
            onClick={() => navigate('/productos?stockBajo=1')}
            style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#dc2626' }}
          >
            🚨 ¡ATENCIÓN! Stock Bajo ({alertas.length} productos)
            <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: 'auto' }}>Click para gestionar →</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {alertas.slice(0, 6).map((alerta, idx) => (
              <div 
                key={idx} 
                onClick={() => navigate(`/productos?buscar=${encodeURIComponent(alerta.producto)}`)}
                style={{ 
                  cursor: 'pointer', 
                  transition: 'all 0.15s',
                  background: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                title={`Click para editar ${alerta.producto}`}
              >
                <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: '0.9rem', marginBottom: '4px' }}>{alerta.producto}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    background: '#ef4444', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    {alerta.stock_actual} / {alerta.stock_minimo}
                  </span>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                </div>
              </div>
            ))}
          </div>
          {alertas.length > 6 && (
            <p 
              onClick={() => navigate('/productos?stockBajo=1')}
              style={{ textAlign: 'center', paddingTop: '12px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}
            >
              Ver {alertas.length - 6} productos más →
            </p>
          )}
        </div>
      )}

      {/* Pedidos Antiguos Pendientes */}
      {pedidosAntiguos.length > 0 && (
        <div className="alert-warning" style={{ padding: '18px' }}>
          <h3 
            onClick={() => navigate('/historial?antiguos=1')}
            style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            ⏰ Pedidos Pendientes +24 horas ({pedidosAntiguos.length})
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>→ Ver todos</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pedidosAntiguos.slice(0, 5).map((pedido, idx) => (
              <div 
                key={idx} 
                onClick={() => navigate(`/historial?pedidoId=${pedido.id}`)}
                className="card-item"
                style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                title={`Click para ver pedido #${pedido.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{pedido.cliente || 'Sin cliente'}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Creado: {pedido.fecha_creacion || pedido.fecha} | Por: {pedido.creado_por || 'N/A'}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                </div>
              </div>
            ))}
            {pedidosAntiguos.length > 5 && (
              <p 
                onClick={() => navigate('/historial?antiguos=1')}
                style={{ color: '#c2410c', textAlign: 'center', paddingTop: '6px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Ver {pedidosAntiguos.length - 5} pedidos más →
              </p>
            )}
          </div>
        </div>
      )}

      {/* Estadísticas por Usuario */}
      {estadisticasUsuarios && estadisticasUsuarios.por_vendedor && estadisticasUsuarios.por_vendedor.length > 0 && (
        <div className="card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text)' }}>
            👥 Actividad por Vendedor
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {estadisticasUsuarios.por_vendedor.slice(0, 5).map((vendedor, idx) => {
              const maxCantidad = estadisticasUsuarios.por_vendedor[0]?.cantidad || 1;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '120px', fontWeight: 600, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                    {vendedor.usuario || 'Sin usuario'}
                  </div>
                  <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: '12px', height: '34px', position: 'relative', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <div
                      style={{
                        width: `${Math.max((vendedor.cantidad / maxCantidad) * 100, 6)}%`,
                        background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
                        height: '100%',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '10px',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.95rem'
                      }}
                    >
                      {vendedor.cantidad} pedidos
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actividad por Dispositivo */}
      {estadisticasUsuarios && estadisticasUsuarios.por_dispositivo && estadisticasUsuarios.por_dispositivo.length > 0 && (
        <div className="card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text)' }}>
            📱 Pedidos por Dispositivo
          </h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {estadisticasUsuarios.por_dispositivo.map((item, idx) => {
              const icons = { mobile: '📱', tablet: '📱', web: '💻' };
              const colors = { mobile: '#14b8a6', tablet: '#f59e0b', web: '#0ea5e9' };
              const labels = { mobile: 'Móvil', tablet: 'Tablet', web: 'Web' };
              return (
                <div key={idx} style={{ 
                  background: 'var(--color-bg-secondary)', 
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px', 
                  padding: '16px 24px',
                  textAlign: 'center',
                  minWidth: '120px'
                }}>
                  <div style={{ fontSize: '2rem' }}>{icons[item.dispositivo] || '❓'}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.5rem', color: colors[item.dispositivo] || '#6b7280' }}>{item.cantidad}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{labels[item.dispositivo] || item.dispositivo || 'Desconocido'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
        Última actualización: {new Date().toLocaleTimeString('es-AR')}
      </div>
    </div>
  );
}
