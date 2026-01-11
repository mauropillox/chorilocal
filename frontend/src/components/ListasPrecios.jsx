import { useState, useEffect } from 'react';
import { authFetchJson, authFetch } from '../authFetch';
import { toast, toastSuccess } from '../toast';
import ConfirmDialog from './ConfirmDialog';
import HelpBanner from './HelpBanner';

export default function ListasPrecios() {
  const [listas, setListas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [vistaDetalle, setVistaDetalle] = useState(null);

  // Form
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [multiplicador, setMultiplicador] = useState('1.0');

  // Precio especial
  const [productoId, setProductoId] = useState('');
  const [precioEspecial, setPrecioEspecial] = useState('');

  // Confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [listasRes, productosRes] = await Promise.all([
        authFetchJson(`${import.meta.env.VITE_API_URL}/listas-precios`),
        authFetchJson(`${import.meta.env.VITE_API_URL}/productos`)
      ]);
      if (listasRes.res.ok) setListas(listasRes.data);
      if (productosRes.res.ok) setProductos(productosRes.data);
      toastSuccess('💰 Listas de precios cargadas correctamente');
    } catch (e) {
      toast('Error cargando datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarDetalle = async (listaId) => {
    try {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/listas-precios/${listaId}`);
      if (res.ok) setVistaDetalle(data);
    } catch (e) {
      toast('Error cargando detalle', 'error');
    }
  };

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setMultiplicador('1.0');
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast('El nombre es requerido', 'error');
      return;
    }

    try {
      const url = editando
        ? `${import.meta.env.VITE_API_URL}/listas-precios/${editando}`
        : `${import.meta.env.VITE_API_URL}/listas-precios`;

      const res = await authFetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          multiplicador: parseFloat(multiplicador) || 1.0
        })
      });

      if (res.ok) {
        toast(editando ? 'Lista actualizada' : 'Lista creada', 'success');
        resetForm();
        cargarDatos();
      } else {
        const err = await res.json();
        toast(err.detail || 'Error', 'error');
      }
    } catch (e) {
      toast('Error de conexión', 'error');
    }
  };

  const editarLista = (lista) => {
    setEditando(lista.id);
    setNombre(lista.nombre);
    setDescripcion(lista.descripcion || '');
    setMultiplicador(String(lista.multiplicador || 1.0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmarEliminar = (lista) => {
    setItemToDelete(lista);
    setConfirmOpen(true);
  };

  const eliminarLista = async () => {
    if (!itemToDelete) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/listas-precios/${itemToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast('Lista eliminada', 'success');
        cargarDatos();
        if (vistaDetalle?.id === itemToDelete.id) setVistaDetalle(null);
      }
    } catch (e) {
      toast('Error', 'error');
    } finally {
      setConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const agregarPrecioEspecial = async () => {
    if (!productoId || !precioEspecial || !vistaDetalle) return;

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/listas-precios/${vistaDetalle.id}/precios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: parseInt(productoId),
          precio_especial: parseFloat(precioEspecial)
        })
      });

      if (res.ok) {
        toast('Precio especial agregado', 'success');
        setProductoId('');
        setPrecioEspecial('');
        cargarDetalle(vistaDetalle.id);
      }
    } catch (e) {
      toast('Error', 'error');
    }
  };

  const eliminarPrecioEspecial = async (productoId) => {
    if (!vistaDetalle) return;
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_API_URL}/listas-precios/${vistaDetalle.id}/precios/${productoId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        toast('Precio eliminado', 'success');
        cargarDetalle(vistaDetalle.id);
      }
    } catch (e) {
      toast('Error', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-4xl animate-pulse">💰</div>
        <p className="text-muted">Cargando listas de precios...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--color-primary)' }}>
        💰 Listas de Precios
      </h1>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo usar listas de precios?"
        icon="💰"
        items={[
          { label: 'Crear lista', text: 'Agregá un nombre descriptivo (ej: Mayorista, Minorista) y configurá el tipo de ajuste: porcentaje o monto fijo.' },
          { label: 'Ajustar precios', text: 'Podés aplicar un descuento o recargo general, o definir precios específicos producto por producto.' },
          { label: 'Asignar a clientes', text: 'Desde la sección Clientes, asigná la lista correspondiente a cada cliente. Los precios se ajustan automáticamente.' },
          { label: 'Visualización', text: 'Al crear pedidos, verás los precios ya ajustados según la lista del cliente seleccionado.' },
          { label: 'Editar o eliminar', text: 'Modificá porcentajes o precios en cualquier momento. Los pedidos anteriores conservan sus precios originales.' }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="panel p-4">
          <h2 className="font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
            {editando ? '✏️ Editar Lista' : '➕ Nueva Lista'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Nombre *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Mayorista, Minorista..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Descripción
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Ajuste de Precio
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  value={multiplicador}
                  onChange={e => setMultiplicador(e.target.value)}
                  style={{ width: '100px' }}
                />
                <span className="text-sm text-muted">
                  {parseFloat(multiplicador) === 1 ? '= Precio normal' :
                    parseFloat(multiplicador) < 1 ? `= ${Math.round((1 - parseFloat(multiplicador)) * 100)}% descuento` :
                      `= ${Math.round((parseFloat(multiplicador) - 1) * 100)}% recargo`}
                </span>
              </div>
              {/* Preview del precio */}
              <div className="mt-2 p-2 rounded text-xs panel-light">
                <strong>Ejemplo:</strong> Producto de $1000 → <strong style={{ color: parseFloat(multiplicador) <= 1 ? '#16a34a' : '#dc2626' }}>
                  ${(1000 * parseFloat(multiplicador || 1)).toFixed(2)}
                </strong>
              </div>
              <p className="text-xs mt-1 text-muted">
                💡 Usa 0.9 para 10% descuento, 1.1 para 10% recargo, 1.0 para sin cambio
              </p>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                {editando ? '💾 Guardar' : '➕ Crear Lista'}
              </button>
              {editando && (
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista de listas */}
        <div className="panel p-4">
          <h2 className="font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
            📋 Listas Existentes ({listas.length})
          </h2>

          {listas.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="text-4xl mb-2">📋</div>
              <p>No hay listas de precios.</p>
              <p className="text-xs mt-1">Crea una para ofrecer precios diferenciados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted text-center mb-2">
                👆 Click en una lista para agregar precios especiales por producto
              </p>
              {listas.map(lista => {
                const mult = parseFloat(lista.multiplicador) || 1;
                const ajusteTexto = mult === 1 ? 'Sin ajuste' :
                  mult < 1 ? `${Math.round((1 - mult) * 100)}% descuento` :
                    `${Math.round((mult - 1) * 100)}% recargo`;
                const ajusteColor = mult < 1 ? '#16a34a' : mult > 1 ? '#dc2626' : '#64748b';

                return (
                  <div
                    key={lista.id}
                    className={`p-3 rounded-lg cursor-pointer hover:shadow-md transition-shadow lista-item ${vistaDetalle?.id === lista.id ? 'active' : ''}`}
                    onClick={() => cargarDetalle(lista.id)}
                    title="Click para ver detalles y agregar precios especiales"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>
                          {lista.nombre || '(Sin nombre)'}
                        </h3>
                        {lista.descripcion && (
                          <p className="text-xs text-muted">{lista.descripcion}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-full ${mult < 1 ? 'badge-discount' : mult > 1 ? 'badge-surcharge' : 'badge-neutral'}`}>
                            {ajusteTexto}
                          </span>
                          <span className="text-muted">📦 {lista.productos_count} {lista.productos_count === 1 ? 'precio especial' : 'precios especiales'}</span>
                          <span className="text-muted">👥 {lista.clientes_count} {lista.clientes_count === 1 ? 'cliente' : 'clientes'}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); editarLista(lista); }}
                          className="btn-secondary text-xs px-2 py-1"
                          style={{ minHeight: 'auto' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); confirmarEliminar(lista); }}
                          className="btn-danger text-xs px-2 py-1"
                          style={{ minHeight: 'auto' }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detalle de lista */}
      {vistaDetalle && (
        <div className="panel p-4 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold" style={{ color: 'var(--color-primary)' }}>
              📝 Precios Especiales: {vistaDetalle.nombre}
            </h2>
            <button onClick={() => setVistaDetalle(null)} className="btn-secondary text-sm">
              ✕ Cerrar
            </button>
          </div>

          {/* Agregar precio especial */}
          <div className="p-3 rounded-lg mb-4 panel-light">
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-48">
                <label className="block text-xs mb-1 text-muted">Producto</label>
                <select
                  value={productoId}
                  onChange={e => setProductoId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Seleccionar producto...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Base: ${p.precio})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: '120px' }}>
                <label className="block text-xs mb-1 text-muted">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precioEspecial}
                  onChange={e => setPrecioEspecial(e.target.value)}
                  placeholder="$"
                />
              </div>
              <button
                onClick={agregarPrecioEspecial}
                disabled={!productoId || !precioEspecial}
                className="btn-success"
              >
                ➕ Agregar
              </button>
            </div>
          </div>

          {/* Lista de precios especiales */}
          {vistaDetalle.precios?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header-light">
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-right">Precio Base</th>
                    <th className="p-2 text-right">Precio Especial</th>
                    <th className="p-2 text-right">Diferencia</th>
                    <th className="p-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vistaDetalle.precios.map(p => {
                    const diff = ((p.precio_especial - p.precio_base) / p.precio_base * 100).toFixed(1);
                    return (
                      <tr key={p.producto_id} className="table-row-bordered">
                        <td className="p-2">{p.producto_nombre}</td>
                        <td className="p-2 text-right text-muted">
                          ${p.precio_base}
                        </td>
                        <td className="p-2 text-right font-semibold" style={{ color: 'var(--color-primary)' }}>
                          ${p.precio_especial}
                        </td>
                        <td className={`p-2 text-right ${diff < 0 ? 'text-success' : 'text-danger'}`}>
                          {diff > 0 ? '+' : ''}{diff}%
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => eliminarPrecioEspecial(p.producto_id)}
                            className="btn-danger text-xs px-2 py-1"
                            style={{ minHeight: 'auto' }}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted">
              No hay precios especiales. Se usará el multiplicador ×{vistaDetalle.multiplicador}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={eliminarLista}
        title="¿Eliminar lista?"
        message={`¿Estás seguro de eliminar "${itemToDelete?.nombre}"? Los clientes asignados quedarán sin lista.`}
      />
    </div>
  );
}
