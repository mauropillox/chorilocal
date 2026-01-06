import { useState } from 'react';
import { authFetch } from '../authFetch';
import { toastSuccess, toastError, toastWarn } from '../toast';

export default function CambiarPassword({ onClose }) {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordActual || !passwordNuevo || !passwordConfirm) {
      toastWarn('Completa todos los campos');
      return;
    }
    
    if (passwordNuevo.length < 6) {
      toastWarn('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (passwordNuevo !== passwordConfirm) {
      toastWarn('Las contraseñas no coinciden');
      return;
    }
    
    if (passwordActual === passwordNuevo) {
      toastWarn('La nueva contraseña debe ser diferente a la actual');
      return;
    }
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('password_actual', passwordActual);
      formData.append('password_nuevo', passwordNuevo);
      
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/cambiar-password`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        toastSuccess('Contraseña actualizada correctamente');
        onClose?.();
      } else {
        toastError(data.detail || 'Error al cambiar contraseña');
      }
    } catch (err) {
      toastError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
        🔐 Cambiar Contraseña
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label htmlFor="password-actual">Contraseña actual</label>
          <input
            id="password-actual"
            type={showPasswords ? 'text' : 'password'}
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            placeholder="Tu contraseña actual"
            aria-label="Contraseña actual"
            autoComplete="current-password"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password-nuevo">Nueva contraseña</label>
          <input
            id="password-nuevo"
            type={showPasswords ? 'text' : 'password'}
            value={passwordNuevo}
            onChange={(e) => setPasswordNuevo(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            aria-label="Nueva contraseña"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password-confirm">Confirmar nueva contraseña</label>
          <input
            id="password-confirm"
            type={showPasswords ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Repite la nueva contraseña"
            aria-label="Confirmar nueva contraseña"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            aria-label="Mostrar contraseñas"
          />
          <span>Mostrar contraseñas</span>
        </label>
        
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
            aria-label="Guardar nueva contraseña"
          >
            {loading ? '⏳ Guardando...' : '💾 Guardar'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              aria-label="Cancelar cambio de contraseña"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      
      <div className="mt-4 text-sm text-muted">
        <p>💡 Consejos para una contraseña segura:</p>
        <ul className="list-disc ml-5 mt-1">
          <li>Mínimo 6 caracteres</li>
          <li>Evita contraseñas comunes (123456, password, etc.)</li>
          <li>Usa una combinación de letras, números y símbolos</li>
        </ul>
      </div>
    </div>
  );
}
