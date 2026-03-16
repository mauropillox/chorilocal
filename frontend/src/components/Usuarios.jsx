import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetchJson } from '../authFetch';
import { toast, toastSuccess, toastError } from '../toast';
import { CACHE_KEYS } from '../utils/queryClient';
import { logger } from '../utils/logger';
import ConfirmDialog from './ConfirmDialog';
import HelpBanner from './HelpBanner';

export default function Usuarios() {
  const { data: usuarios = [], isLoading, refetch: refetchUsuarios } = useQuery({
    queryKey: CACHE_KEYS.usuarios,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/usuarios`);
      if (res.ok) {
        toastSuccess('👥 Usuarios cargados correctamente');
        return data || [];
      } else if (res.status === 403) {
        toastError('Solo administradores pueden acceder a esta sección');
      } else {
        toastError('Error cargando usuarios');
      }
      return [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [confirmDelete, setConfirmDelete] = useState({ open: false, user: null });
  const [resetPassword, setResetPassword] = useState({ open: false, user: null, newPassword: '' });

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const toggleActivo = async (user) => {
    const endpoint = user.activo
      ? `${import.meta.env.VITE_API_URL}/usuarios/${user.id}/desactivar`
      : `${import.meta.env.VITE_API_URL}/usuarios/${user.id}/activar`;

    try {
      const { res } = await authFetchJson(endpoint, { method: 'PUT' });
      if (res.ok) {
        toastSuccess(user.activo ? '🔴 Usuario desactivado' : '✅ Usuario activado');
        refetchUsuarios();
      } else {
        toastError('Error al cambiar estado');
      }
    } catch (e) {
      logger.error('Error toggling usuario activo:', e);
      toastError('Error de conexión');
    }
  };

  const cambiarRol = async (user, nuevoRol) => {
    try {
      const formData = new FormData();
      formData.append('rol', nuevoRol);

      const { res } = await authFetchJson(
        `${import.meta.env.VITE_API_URL}/usuarios/${user.id}/rol`,
        { method: 'PUT', body: formData }
      );
      if (res.ok) {
        toastSuccess(`✅ Rol cambiado a ${nuevoRol}`);
        refetchUsuarios();
      } else {
        toastError('Error al cambiar rol');
      }
    } catch (e) {
      toastError('Error de conexión');
    }
  };

  const eliminarUsuario = async () => {
    if (!confirmDelete.user) return;

    try {
      const { res } = await authFetchJson(
        `${import.meta.env.VITE_API_URL}/usuarios/${confirmDelete.user.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        toastSuccess('🗑️ Usuario eliminado');
        await refetchUsuarios();
      } else {
        toastError('Error al eliminar usuario');
      }
    } catch (e) {
      logger.error('Error eliminando usuario:', e);
      toastError('Error de conexión');
    } finally {
      setConfirmDelete({ open: false, user: null });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.user || !resetPassword.newPassword) {
      toastError('Ingrese una nueva contraseña');
      return;
    }

    const pw = resetPassword.newPassword;
    if (pw.length < 8) {
      toastError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!/[A-Za-z]/.test(pw)) {
      toastError('La contraseña debe contener al menos una letra');
      return;
    }
    if (!/\d/.test(pw)) {
      toastError('La contraseña debe contener al menos un número');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('new_password', resetPassword.newPassword);

      const { res, data } = await authFetchJson(
        `${import.meta.env.VITE_API_URL}/usuarios/${resetPassword.user.id}/reset-password`,
        { method: 'PUT', body: formData }
      );

      if (res.ok) {
        toastSuccess(`✅ Contraseña de ${resetPassword.user.username} reseteada`);
        setResetPassword({ open: false, user: null, newPassword: '' });
      } else {
        toastError(data?.detail || 'Error al resetear contraseña');
      }
    } catch (e) {
      logger.error('Error reseteando password:', e);
      toastError('Error de conexión');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca';
    try {
      return new Date(dateStr).toLocaleString('es-UY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getRolBadge = (rol) => {
    const styles = {
      admin: 'pill-danger',
      oficina: 'pill-warning',
      vendedor: 'pill-info'
    };
    return styles[rol] || 'pill';
  };

  // Filtrar usuarios
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusqueda = !busqueda || u.username.toLowerCase().includes(busqueda.toLowerCase());
      const matchRol = !filtroRol || u.rol === filtroRol;
      // Handle both boolean (true/false) and number (1/0) for activo
      const isActive = u.activo === true || u.activo === 1;
      const matchEstado = filtroEstado === '' ||
        (filtroEstado === 'activo' && isActive) ||
        (filtroEstado === 'inactivo' && !isActive);
      return matchBusqueda && matchRol && matchEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl animate-pulse">👥</div>
        <p className="text-muted mt-2">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto" style={{ color: 'var(--color-text)' }}>
      <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--color-primary)' }}>
        ⚙️ Administración de Usuarios
      </h1>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo gestionar usuarios?"
        icon="👥"
        items={[
          { label: 'Roles disponibles', text: 'Los Administradores tienen acceso completo al sistema. Los Usuarios normales pueden gestionar clientes, productos y pedidos.' },
          { label: 'Crear usuario', text: 'Completá nombre de usuario (único), contraseña segura y seleccioná el rol apropiado.' },
          { label: 'Activar/Desactivar', text: 'Podés deshabilitar cuentas sin eliminarlas. Un usuario inactivo no puede iniciar sesión pero conserva su historial.' },
          { label: 'Resetear contraseña', text: 'Si un usuario olvida su contraseña, podés generar una nueva desde aquí y comunicársela.' },
          { label: 'Eliminar usuario', text: 'Solo se puede eliminar si no tiene acciones asociadas. Preferí desactivar para mantener la trazabilidad.' }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{usuarios.length}</div>
          <div className="stat-label">Total Usuarios</div>
        </div>
        <div className="stat-card-success">
          <div className="stat-value">{usuarios.filter(u => u.activo === true || u.activo === 1).length}</div>
          <div className="stat-label">Activos</div>
        </div>
        <div className="stat-card-warning">
          <div className="stat-value">{usuarios.filter(u => u.rol === 'admin').length}</div>
          <div className="stat-label">Administradores</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="panel mb-4">
        <div className="mb-3">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar usuario..."
            style={{ width: '100%' }}
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-center">
          <select
            value={filtroRol}
            onChange={e => setFiltroRol(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="">Todos los roles</option>
            <option value="admin">👑 Admin</option>
            <option value="oficina">🏢 Oficina</option>
            <option value="vendedor">💼 Vendedor</option>
          </select>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="">Todos los estados</option>
            <option value="activo">✓ Activos</option>
            <option value="inactivo">✗ Inactivos</option>
          </select>
          {(busqueda || filtroRol || filtroEstado) && (
            <button
              onClick={() => { setBusqueda(''); setFiltroRol(''); setFiltroEstado(''); }}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        {(busqueda || filtroRol || filtroEstado) && (
          <p className="text-xs text-muted mt-2 text-center">
            Mostrando {usuariosFiltrados.length} de {usuarios.length} usuarios
          </p>
        )}
      </div>

      <div className="panel">
        <div className="overflow-x-auto">
          <table className="report-table w-full text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último Login</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td className="font-medium">{user.username}</td>
                  <td>
                    <select
                      value={user.rol}
                      onChange={(e) => cambiarRol(user, e.target.value)}
                      className="text-sm py-1 px-2"
                      style={{ minHeight: 'auto' }}
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="oficina">Oficina</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={(user.activo === true || user.activo === 1) ? 'pill-success' : 'pill-danger'}>
                      {(user.activo === true || user.activo === 1) ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                  </td>
                  <td className="text-xs text-muted">
                    {formatDate(user.ultimo_login || user.last_login)}
                  </td>
                  <td className="text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setResetPassword({ open: true, user, newPassword: '' })}
                        className="btn-primary"
                        style={{ padding: '0.375rem 0.75rem', minHeight: 'auto' }}
                        title="Resetear Contraseña"
                      >
                        🔑
                      </button>
                      <button
                        onClick={() => toggleActivo(user)}
                        className={(user.activo === true || user.activo === 1) ? 'btn-warning' : 'btn-success'}
                        style={{ padding: '0.375rem 0.75rem', minHeight: 'auto' }}
                        title={(user.activo === true || user.activo === 1) ? 'Desactivar' : 'Activar'}
                      >
                        {(user.activo === true || user.activo === 1) ? '🚫' : '✓'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ open: true, user })}
                        className="btn-danger"
                        style={{ padding: '0.375rem 0.75rem', minHeight: 'auto' }}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {usuariosFiltrados.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-text">
              {usuarios.length === 0
                ? 'No hay usuarios registrados aún'
                : 'No se encontraron usuarios con esos filtros'}
            </div>
            {usuarios.length === 0 && (
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Crea usuarios para gestionar el acceso al sistema</p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        title="Eliminar Usuario"
        message={`¿Estás seguro de eliminar al usuario "${confirmDelete.user?.username}"? Esta acción no se puede deshacer.`}
        onConfirm={eliminarUsuario}
        onCancel={() => setConfirmDelete({ open: false, user: null })}
      />

      {/* Modal Reset Password */}
      {resetPassword.open && (
        <div
          className="modal-backdrop"
          onClick={() => setResetPassword({ open: false, user: null, newPassword: '' })}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
        >
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 id="reset-password-title" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
              🔑 Resetear Contraseña
            </h2>
            <p style={{ marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              Nueva contraseña para <strong>{resetPassword.user?.username}</strong>:
            </p>
            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              Requisitos: mín. 8 caracteres, al menos 1 letra y 1 número
            </p>
            <label htmlFor="new-password" className="sr-only">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              value={resetPassword.newPassword}
              onChange={(e) => setResetPassword({ ...resetPassword, newPassword: e.target.value })}
              placeholder="Ingrese nueva contraseña"
              className="input-field"
              style={{ width: '100%', marginBottom: '1rem' }}
              autoFocus
              aria-describedby="password-requirements"
            />
            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setResetPassword({ open: false, user: null, newPassword: '' })}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleResetPassword}
                disabled={resetPassword.newPassword.length < 8 || !/[A-Za-z]/.test(resetPassword.newPassword) || !/\d/.test(resetPassword.newPassword)}
              >
                Resetear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
