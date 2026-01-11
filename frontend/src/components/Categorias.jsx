import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../authFetch';
import { toastSuccess, toastError } from '../toast';
import { CACHE_KEYS } from '../utils/queryClient';
import ConfirmDialog from './ConfirmDialog';
import HelpBanner from './HelpBanner';

export default function Categorias() {
  const { data: categorias = [], refetch: refetchCategorias } = useQuery({
    queryKey: CACHE_KEYS.categorias,
    queryFn: async () => {
      try {
        const res = await authFetch(`${import.meta.env.VITE_API_URL}/categorias`);
        const data = await res.json();
        if (res.ok) toastSuccess('🏷️ Categorías cargadas correctamente');
        return res.ok ? (data || []) : [];
      } catch (e) {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [orden, setOrden] = useState(0);
  const [saving, setSaving] = useState(false);
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const colores = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
  ];

  // Data loaded automatically by useQuery

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setColor('#6366f1');
    setOrden(0);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toastError('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      const payload = { nombre: nombre.trim(), descripcion, color, orden };
      const url = editingId
        ? `${import.meta.env.VITE_API_URL}/categorias/${editingId}`
        : `${import.meta.env.VITE_API_URL}/categorias`;

      const res = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toastSuccess(editingId ? 'Categoría actualizada' : 'Categoría creada');
        resetForm();
        refetchCategorias();
      } else {
        const err = await res.json();
        toastError(err.detail || 'Error al guardar');
      }
    } catch (e) {
      toastError('Error de conexión');
    }
    setSaving(false);
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setNombre(cat.nombre);
    setDescripcion(cat.descripcion || '');
    setColor(cat.color || '#6366f1');
    setOrden(cat.orden || 0);
    setShowForm(true);
  };

  const handleDelete = useCallback(async (id) => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/categorias/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        toastSuccess(data.message || 'Categoría eliminada');
        refetchCategorias();
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al eliminar');
      }
    } catch (e) {
      toastError('Error de conexión');
    }
    setDeleteId(null);
  }, []);

  return (
    <div>
      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo gestionar categorías?"
        icon="🏷️"
        items={[
          { label: 'Crear categoría', text: 'Agregá un nombre descriptivo (ej: Embutidos, Quesos, Bebidas) y opcionalmente asigná un color para identificación visual.' },
          { label: 'Colores visuales', text: 'Los colores aparecen como indicador en el listado de productos. Facilitan la identificación rápida cuando filtrás por categoría.' },
          { label: 'Asignar productos', text: 'Desde la sección Productos, podés asignar una categoría a cada producto usando el selector correspondiente.' },
          { label: 'Filtrar productos', text: 'En el listado de productos podés filtrar por categoría para ver solo los productos de ese tipo.' },
          { label: 'Editar o eliminar', text: 'Modificá nombres o colores en cualquier momento. Solo podés eliminar categorías sin productos asociados.' }
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🏷️</span>
            Categorías de Productos
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Organiza tus productos por tipo
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={incluirInactivas}
              onChange={(e) => setIncluirInactivas(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Mostrar inactivas
          </label>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
            style={{ padding: '10px 20px' }}
          >
            {showForm ? '✕ Cancelar' : '+ Nueva Categoría'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)' }}>
            {editingId ? '✏️ Editar Categoría' : '➕ Nueva Categoría'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', display: 'block' }}>Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Carnes Vacunas"
                required
                autoFocus
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', display: 'block' }}>Descripción</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción opcional..."
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ maxWidth: '80px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', display: 'block' }}>Orden</label>
              <input
                type="number"
                value={orden}
                onChange={(e) => setOrden(parseInt(e.target.value) || 0)}
                min="0"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: '6px', display: 'block' }}>Color</label>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {colores.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: c,
                      border: color === c ? '2px solid var(--color-text)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                      transform: color === c ? 'scale(1.1)' : 'scale(1)'
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={resetForm} className="btn-secondary" style={{ padding: '8px 16px' }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '8px 20px' }}>
              {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>
      ) : categorias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          No hay categorías creadas
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {categorias.map(cat => (
            <div
              key={cat.id}
              className="form-card"
              style={{
                borderLeft: `5px solid ${cat.color || '#6366f1'}`,
                opacity: cat.activa ? 1 : 0.5,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {!cat.activa && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontSize: '0.65rem',
                  color: 'white',
                  backgroundColor: 'var(--color-danger)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600
                }}>INACTIVA</span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 }}>
                    {cat.nombre}
                  </h3>
                  {cat.descripcion && (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {cat.descripcion}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: cat.color || '#6366f1',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                  }}
                />
              </div>
              <div style={{
                marginTop: '1rem',
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '0.75rem'
              }}>
                <button
                  onClick={() => handleEdit(cat)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '32px' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => setDeleteId(cat.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    minHeight: '32px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--color-danger)',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        title="¿Eliminar categoría?"
        message="Esta acción desactivará la categoría si tiene productos asignados."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={() => handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}
