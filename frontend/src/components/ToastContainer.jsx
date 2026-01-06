import { useEffect, useState } from 'react';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type = 'info', duration = 3000, undoCallback, showUndo } = e.detail || {};
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type, undoCallback, showUndo }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter(t => t.id !== id));
      }, duration);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  const handleUndo = (toast) => {
    if (toast.undoCallback) {
      toast.undoCallback();
    }
    setToasts((prev) => prev.filter(t => t.id !== toast.id));
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  };

  return (
    <div 
      className="toast-container" 
      role="status" 
      aria-live="polite" 
      aria-atomic="false"
      aria-label="Notificaciones"
    >
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`toast toast-${t.type}`}
          role="alert"
          aria-live={t.type === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-message">{t.message}</span>
          <div className="toast-actions">
            {t.showUndo && t.undoCallback && (
              <button 
                onClick={() => handleUndo(t)} 
                className="toast-undo-btn"
                aria-label="Deshacer acción"
              >
                ↩️ Deshacer
              </button>
            )}
            <button 
              onClick={() => dismissToast(t.id)} 
              className="toast-close-btn"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

