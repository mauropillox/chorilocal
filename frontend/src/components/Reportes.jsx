import { useState, useEffect } from 'react';
import { authFetchJson } from '../authFetch';
import { toast, toastSuccess } from '../toast';
import HelpBanner from './HelpBanner';

export default function Reportes() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('ventas');

  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0]);

  const [reporteVentas, setReporteVentas] = useState(null);
  const [reporteInventario, setReporteInventario] = useState(null);
  const [reporteClientes, setReporteClientes] = useState(null);
  const [reporteProductos, setReporteProductos] = useState(null);
  const [reporteRendimiento, setReporteRendimiento] = useState(null);
  const [reporteComparativo, setReporteComparativo] = useState(null);

  // Export to CSV utility with proper formatting
  const exportToCSV = (data, filename, columnConfig) => {
    if (!data || data.length === 0) {
      toast('No hay datos para exportar', 'warn');
      return;
    }

    // Build header row with Spanish column names
    const headerRow = columnConfig.map(col => col.label).join(',');
    
    // Build data rows
    const dataRows = data.map(row => {
      return columnConfig.map(col => {
        let val;
        
        // Use custom getter if provided, otherwise get from key
        if (col.getValue) {
          val = col.getValue(row);
        } else {
          val = row[col.key];
        }
        
        // Apply formatter if provided
        if (col.format && val != null) {
          val = col.format(val);
        }
        
        // Convert to string and handle empty values
        const strVal = val != null ? String(val) : '';
        
        // Escape values with commas, quotes, or newlines
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        
        return strVal;
      }).join(',');
    }).join('\n');

    const csvContent = `${headerRow}\n${dataRows}`;
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toastSuccess('CSV exportado correctamente');
  };

  const exportVentas = () => {
    if (!reporteVentas?.top_productos) return;
    exportToCSV(
      reporteVentas.top_productos,
      'ventas_top_productos',
      [
        { key: 'nombre', label: 'Producto' },
        { key: 'cantidad_vendida', label: 'Cantidad Vendida' },
        { key: 'total_vendido', label: 'Total Vendido ($)', format: (v) => v.toFixed(2) }
      ]
    );
  };

  const exportInventario = () => {
    if (!reporteInventario?.productos) return;
    exportToCSV(
      reporteInventario.productos,
      'inventario_productos',
      [
        { key: 'nombre', label: 'Producto' },
        { key: 'stock', label: 'Stock Actual' },
        { key: 'stock_minimo', label: 'Stock Mínimo' },
        { key: 'precio', label: 'Precio ($)', format: (v) => v.toFixed(2) },
        { label: 'Valor Total ($)', getValue: (row) => (row.stock * row.precio).toFixed(2) }
      ]
    );
  };

  const exportClientes = () => {
    if (!reporteClientes?.clientes) return;
    exportToCSV(
      reporteClientes.clientes,
      'clientes_completo',
      [
        { key: 'nombre', label: 'Cliente' },
        { key: 'telefono', label: 'Teléfono', format: (v) => v || 'Sin teléfono' },
        { key: 'direccion', label: 'Dirección', format: (v) => v || 'Sin dirección' },
        { key: 'total_pedidos', label: 'Total Pedidos' },
        { key: 'total_gastado', label: 'Total Gastado ($)', format: (v) => v.toFixed(2) },
        { key: 'ultimo_pedido', label: 'Último Pedido', format: (v) => v || 'Nunca' }
      ]
    );
  };

  const cargarReporteVentas = async () => {
    setLoading(true);
    try {
      const { res, data } = await authFetchJson(
        `${import.meta.env.VITE_API_URL}/reportes/ventas?desde=${desde}&hasta=${hasta}`
      );
      if (res.ok) setReporteVentas(data);
      else toast('Error cargando reporte', 'error');
    } catch (e) {
      toast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteInventario = async () => {
    setLoading(true);
    try {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/reportes/inventario`);
      if (res.ok) setReporteInventario(data);
    } catch (e) {
      toast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteClientes = async () => {
    setLoading(true);
    try {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/reportes/clientes`);
      if (res.ok) setReporteClientes(data);
    } catch (e) {
      toast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteProductos = async () => {
    setLoading(true);
    try {
      const { res, data } = await authFetchJson(
        `${import.meta.env.VITE_API_URL}/reportes/productos?desde=${desde}&hasta=${hasta}`
      );
      if (res.ok) setReporteProductos(data);
    } catch (e) {
      toast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteRendimiento = async () => {
    setLoading(true);
    try {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/reportes/rendimiento`);
      if (res.ok) setReporteRendimiento(data);
    } catch (e) {
      toast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteComparativo = async () => {
    setLoading(true);
    try {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/reportes/comparativo`);
      if (res.ok) setReporteComparativo(data);
    } catch (e) {
      toast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'ventas') cargarReporteVentas();
    else if (tab === 'inventario') cargarReporteInventario();
    else if (tab === 'clientes') cargarReporteClientes();
    else if (tab === 'productos') cargarReporteProductos();
    else if (tab === 'rendimiento') cargarReporteRendimiento();
    else if (tab === 'comparativo') cargarReporteComparativo();
  }, [tab]);

  const formatCurrency = (num) => `$${(num || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-4 max-w-6xl mx-auto" style={{ color: 'var(--color-text)' }}>
      <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--color-primary)' }}>
        📊 Reportes Avanzados
      </h1>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo usar los reportes?"
        icon="📊"
        items={[
          { label: 'Ventas', text: 'Analizá ventas por período, método de pago, zona o repartidor. Descubrí tus días y horarios de mayor venta.' },
          { label: 'Productos', text: 'Mirá el ranking de productos más vendidos, los que tienen menor rotación y cuáles generan más ganancia.' },
          { label: 'Inventario', text: 'Revisá stock actual, productos por debajo del mínimo y proyección de necesidades de reposición.' },
          { label: 'Clientes', text: 'Conocé tus mejores clientes, frecuencia de compra, ticket promedio y clientes inactivos.' },
          { label: 'Rendimiento', text: 'Métricas de eficiencia: tiempos de entrega, pedidos por hora, comparativas entre períodos.' },
          { label: 'Exportar', text: 'Descargá cualquier reporte en CSV o Excel para análisis externo o presentaciones.' }
        ]}
      />

      <div className="flex gap-3 mb-6 justify-center flex-wrap">
        <button onClick={() => setTab('ventas')} className={tab === 'ventas' ? 'btn-primary' : 'btn-secondary'}>
          💰 Ventas
        </button>
        <button onClick={() => setTab('productos')} className={tab === 'productos' ? 'btn-primary' : 'btn-secondary'}>
          🏆 Productos
        </button>
        <button onClick={() => setTab('inventario')} className={tab === 'inventario' ? 'btn-primary' : 'btn-secondary'}>
          📦 Inventario
        </button>
        <button onClick={() => setTab('clientes')} className={tab === 'clientes' ? 'btn-primary' : 'btn-secondary'}>
          👥 Clientes
        </button>
        <button onClick={() => setTab('rendimiento')} className={tab === 'rendimiento' ? 'btn-primary' : 'btn-secondary'}>
          ⚡ Rendimiento
        </button>
        <button onClick={() => setTab('comparativo')} className={tab === 'comparativo' ? 'btn-primary' : 'btn-secondary'}>
          📈 Comparativo
        </button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="text-4xl animate-pulse">📊</div>
          <p className="text-muted">Cargando reporte...</p>
        </div>
      )}

      {tab === 'ventas' && !loading && (
        <div className="space-y-6">
          <div className="panel">
            <div className="flex gap-4 items-end flex-wrap justify-center">
              <div>
                <label className="block text-sm font-medium mb-1">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
              <button onClick={cargarReporteVentas} className="btn-primary">🔄 Actualizar</button>
              {reporteVentas && (
                <button onClick={exportVentas} className="btn-export">📥 Exportar CSV</button>
              )}
            </div>
          </div>

          {reporteVentas && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="stat-card">
                  <div className="stat-value">{reporteVentas.totales.pedidos}</div>
                  <div className="stat-label">Pedidos en el período</div>
                </div>
                <div className="stat-card-success">
                  <div className="stat-value">{formatCurrency(reporteVentas.totales.ventas)}</div>
                  <div className="stat-label">Total vendido</div>
                </div>
              </div>

              <div className="panel">
                <h3 className="font-bold mb-4">🏆 Top 10 Productos Más Vendidos</h3>
                <div className="overflow-x-auto">
                  <table className="report-table w-full text-sm">
                    <thead><tr><th>#</th><th>Producto</th><th className="text-right">Cantidad</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {reporteVentas.top_productos.map((p, i) => (
                        <tr key={p.id}>
                          <td>{i + 1}</td>
                          <td>{p.nombre}</td>
                          <td className="text-right">{p.cantidad_vendida}</td>
                          <td className="text-right font-semibold text-success">{formatCurrency(p.total_vendido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <h3 className="font-bold mb-4">👑 Top 10 Clientes</h3>
                <div className="overflow-x-auto">
                  <table className="report-table w-full text-sm">
                    <thead><tr><th>#</th><th>Cliente</th><th className="text-right">Pedidos</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {reporteVentas.top_clientes.map((c, i) => (
                        <tr key={c.id}>
                          <td>{i + 1}</td>
                          <td>{c.nombre}</td>
                          <td className="text-right">{c.total_pedidos}</td>
                          <td className="text-right font-semibold text-success">{formatCurrency(c.total_compras)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'inventario' && !loading && reporteInventario && (
        <div className="space-y-6">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-12px' }}>
            <button onClick={exportInventario} className="btn-export">📥 Exportar CSV</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{reporteInventario.resumen.total_productos}</div>
              <div className="stat-label">Productos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{reporteInventario.resumen.stock_total}</div>
              <div className="stat-label">Stock Total</div>
            </div>
            <div className="stat-card-success">
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{formatCurrency(reporteInventario.resumen.valor_inventario)}</div>
              <div className="stat-label">Valor Inventario</div>
            </div>
            <div className="stat-card-warning">
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{reporteInventario.resumen.productos_bajo_stock}</div>
              <div className="stat-label">Bajo Stock</div>
            </div>
          </div>

          {reporteInventario.bajo_stock.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">⚠️ Productos con Stock Bajo</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th className="text-right">Stock Actual</th>
                      <th className="text-right">Stock Mínimo</th>
                      <th className="text-right">Faltante</th>
                      <th className="text-right">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteInventario.bajo_stock.map((p, i) => (
                      <tr key={p.id}>
                        <td>{i + 1}</td>
                        <td className="font-medium">{p.nombre}</td>
                        <td className="text-right">
                          <span className="pill-danger">{p.stock} {p.stock_tipo}</span>
                        </td>
                        <td className="text-right">{p.stock_minimo} {p.stock_tipo}</td>
                        <td className="text-right font-semibold text-danger">{p.faltante}</td>
                        <td className="text-right">{formatCurrency(p.precio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reporteInventario.sin_movimiento && reporteInventario.sin_movimiento.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">📦 Productos sin Movimiento (30 días)</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th className="text-right">Stock</th>
                      <th className="text-right">Precio</th>
                      <th className="text-right">Última Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteInventario.sin_movimiento.map((p, i) => (
                      <tr key={p.id}>
                        <td>{i + 1}</td>
                        <td className="font-medium">{p.nombre}</td>
                        <td className="text-right">{p.stock}</td>
                        <td className="text-right">{formatCurrency(p.precio)}</td>
                        <td className="text-right text-xs text-muted">{p.ultima_venta || 'Sin ventas'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reporteInventario.bajo_stock.length === 0 && (!reporteInventario.sin_movimiento || reporteInventario.sin_movimiento.length === 0) && (
            <div className="panel text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-muted">¡Inventario en buen estado! No hay alertas.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'clientes' && !loading && reporteClientes && (
        <div className="space-y-6">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-12px' }}>
            <button onClick={exportClientes} className="btn-export">📥 Exportar CSV</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-value">{reporteClientes.resumen.total_clientes}</div>
              <div className="stat-label">Total Clientes</div>
            </div>
            <div className="stat-card-success">
              <div className="stat-value">{reporteClientes.resumen.clientes_activos}</div>
              <div className="stat-label">Activos (30 días)</div>
            </div>
            <div className="stat-card-warning">
              <div className="stat-value">{reporteClientes.resumen.clientes_inactivos}</div>
              <div className="stat-label">Inactivos</div>
            </div>
          </div>

          <div className="panel">
            <h3 className="font-bold mb-4">🏆 Ranking de Clientes por Compras</h3>
            <div className="overflow-x-auto">
              <table className="report-table w-full text-sm">
                <thead><tr><th>#</th><th>Cliente</th><th className="text-right">Pedidos</th><th className="text-right">Total</th><th className="text-right">Último</th></tr></thead>
                <tbody>
                  {(reporteClientes.ranking || reporteClientes.top_frecuentes || []).map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td>{c.nombre}</td>
                      <td className="text-right">{c.total_pedidos || 0}</td>
                      <td className="text-right font-semibold text-success">{formatCurrency(c.total_compras || c.total_gastado)}</td>
                      <td className="text-right text-xs text-muted">{c.ultimo_pedido || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(reporteClientes.inactivos || []).length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">⚠️ Clientes Inactivos (+60 días)</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Dirección</th>
                      <th className="text-right">Último Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteClientes.inactivos.slice(0, 20).map((c, i) => (
                      <tr key={c.id}>
                        <td>{i + 1}</td>
                        <td className="font-medium">{c.nombre}</td>
                        <td>{c.telefono || '-'}</td>
                        <td>{c.direccion || '-'}</td>
                        <td className="text-right text-xs text-muted">{c.ultimo_pedido || 'Sin pedidos'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORTE DE PRODUCTOS */}
      {tab === 'productos' && !loading && reporteProductos && (
        <div className="space-y-6">
          {/* Filtro de fechas */}
          <div className="panel">
            <div className="flex gap-4 flex-wrap items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
              <button onClick={cargarReporteProductos} className="btn-primary">🔄 Actualizar</button>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="stat-value">{reporteProductos.resumen?.productos_vendidos || 0}</div>
              <div className="stat-label">Productos Vendidos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{reporteProductos.resumen?.unidades_totales?.toLocaleString() || 0}</div>
              <div className="stat-label">Unidades Vendidas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{reporteProductos.resumen?.total_productos || 0}</div>
              <div className="stat-label">Productos Totales</div>
            </div>
            <div className="stat-card stat-card-warning">
              <div className="stat-value">{reporteProductos.resumen?.sin_ventas_periodo || 0}</div>
              <div className="stat-label">Sin Ventas</div>
            </div>
          </div>

          {/* Top productos */}
          <div className="panel">
            <h3 className="font-bold mb-4">🏆 Top 20 Productos Más Vendidos</h3>
            <div className="overflow-x-auto">
              <table className="report-table w-full text-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="text-right">Precio</th>
                    <th className="text-right">Vendidos</th>
                    <th className="text-right">Facturado</th>
                    <th className="text-right">Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {reporteProductos.mas_vendidos?.map((p, i) => (
                    <tr key={p.id}>
                      <td className="font-bold">{i + 1}</td>
                      <td className="font-medium">{p.nombre}</td>
                      <td>{p.categoria || '-'}</td>
                      <td className="text-right">{formatCurrency(p.precio)}</td>
                      <td className="text-right font-bold">{p.total_vendido?.toLocaleString()}</td>
                      <td className="text-right text-success">{formatCurrency(p.total_facturado)}</td>
                      <td className="text-right">{p.veces_pedido}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por categoría */}
          {reporteProductos.por_categoria?.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">📊 Ventas por Categoría</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reporteProductos.por_categoria.map(cat => (
                  <div key={cat.categoria || 'Sin categoría'} className="p-3 rounded-lg panel-light">
                    <div className="font-semibold">{cat.categoria || 'Sin categoría'}</div>
                    <div className="text-sm text-muted">{cat.total_vendido?.toLocaleString()} unidades</div>
                    <div className="text-lg font-bold text-success">{formatCurrency(cat.total_facturado)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin ventas */}
          {reporteProductos.sin_ventas?.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">⚠️ Productos Sin Ventas en el Período ({reporteProductos.sin_ventas.length})</h3>
              <div className="overflow-x-auto" style={{ maxHeight: '300px' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="table-header-light">
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">Stock Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteProductos.sin_ventas.slice(0, 50).map((p, i) => (
                      <tr key={p.id || i} className="table-row-bordered">
                        <td className="p-2">{p.nombre}</td>
                        <td className="p-2 text-right">{p.stock ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reporteProductos.sin_ventas.length > 50 && (
                <p className="text-xs text-muted text-center mt-2">
                  Mostrando 50 de {reporteProductos.sin_ventas.length} productos
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* REPORTE DE RENDIMIENTO */}
      {tab === 'rendimiento' && !loading && reporteRendimiento && (
        <div className="space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="stat-value">{reporteRendimiento.metricas?.tiempo_promedio_generacion_horas || 0}h</div>
              <div className="stat-label">Tiempo Promedio de Generación</div>
            </div>
            <div className="stat-card stat-card-success">
              <div className="stat-value">{reporteRendimiento.metricas?.tasa_pedidos_con_cliente || 0}%</div>
              <div className="stat-label">Pedidos con Cliente</div>
            </div>
          </div>

          {/* Por día de semana */}
          <div className="panel">
            <h3 className="font-bold mb-4">📅 Pedidos por Día de la Semana</h3>
            <div className="flex flex-wrap gap-2">
              {reporteRendimiento.por_dia_semana?.map(d => (
                <div key={d.dia} className="flex-1 min-w-[80px] p-3 text-center rounded-lg panel-light">
                  <div className="text-xs text-muted">{d.dia}</div>
                  <div className="text-xl font-bold">{d.total_pedidos}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Por hora */}
          {reporteRendimiento.por_hora?.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">🕐 Pedidos por Hora del Día</h3>
              <div className="flex flex-wrap gap-1">
                {reporteRendimiento.por_hora.map(h => (
                  <div key={h.hora} className="w-10 text-center">
                    <div className="text-xs font-bold">{h.total_pedidos}</div>
                    <div className="text-xs text-muted">{h.hora}h</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usuarios activos */}
          {reporteRendimiento.usuarios_activos?.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">👤 Usuarios Más Activos (30 días)</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Usuario</th>
                      <th className="text-right">Pedidos Creados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteRendimiento.usuarios_activos.map((u, i) => (
                      <tr key={u.usuario}>
                        <td>{i + 1}</td>
                        <td className="font-medium">{u.usuario}</td>
                        <td className="text-right font-bold">{u.pedidos_creados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORTE COMPARATIVO */}
      {tab === 'comparativo' && !loading && reporteComparativo && (
        <div className="space-y-6">
          {/* Este mes vs anterior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="panel">
              <h3 className="font-bold mb-4">📅 Este Mes</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Pedidos:</span>
                  <span className="font-bold">{reporteComparativo.mensual?.este_mes?.pedidos || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Facturado:</span>
                  <span className="font-bold text-success">{formatCurrency(reporteComparativo.mensual?.este_mes?.facturado)}</span>
                </div>
              </div>
            </div>
            <div className="panel">
              <h3 className="font-bold mb-4">📅 Mes Anterior</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Pedidos:</span>
                  <span className="font-bold">{reporteComparativo.mensual?.mes_anterior?.pedidos || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Facturado:</span>
                  <span className="font-bold">{formatCurrency(reporteComparativo.mensual?.mes_anterior?.facturado)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variaciones */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`stat-card ${reporteComparativo.mensual?.variacion_pedidos >= 0 ? 'stat-card-success' : 'stat-card-danger'}`}>
              <div className="stat-value">
                {reporteComparativo.mensual?.variacion_pedidos > 0 ? '+' : ''}{reporteComparativo.mensual?.variacion_pedidos || 0}%
              </div>
              <div className="stat-label">Variación Pedidos</div>
            </div>
            <div className={`stat-card ${reporteComparativo.mensual?.variacion_facturado >= 0 ? 'stat-card-success' : 'stat-card-danger'}`}>
              <div className="stat-value">
                {reporteComparativo.mensual?.variacion_facturado > 0 ? '+' : ''}{reporteComparativo.mensual?.variacion_facturado || 0}%
              </div>
              <div className="stat-label">Variación Facturación</div>
            </div>
          </div>

          {/* Últimos 7 días */}
          {reporteComparativo.ultimos_7_dias?.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">📊 Últimos 7 Días</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th className="text-right">Pedidos</th>
                      <th className="text-right">Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteComparativo.ultimos_7_dias.map(d => (
                      <tr key={d.dia}>
                        <td>{d.dia}</td>
                        <td className="text-right font-bold">{d.pedidos}</td>
                        <td className="text-right text-success">{formatCurrency(d.facturado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Últimos 6 meses */}
          {reporteComparativo.ultimos_6_meses?.length > 0 && (
            <div className="panel">
              <h3 className="font-bold mb-4">📈 Evolución Mensual (6 meses)</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="text-right">Pedidos</th>
                      <th className="text-right">Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteComparativo.ultimos_6_meses.map(m => (
                      <tr key={m.mes}>
                        <td className="font-medium">{m.mes}</td>
                        <td className="text-right font-bold">{m.pedidos}</td>
                        <td className="text-right text-success">{formatCurrency(m.facturado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
