import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, onClose }) {
  // Support both onCancel and onClose for backwards compatibility
  const handleCancel = onCancel || onClose;
  const cancelRef = useRef(null);
  
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && open) handleCancel?.();
    };
    window.addEventListener('keydown', handleEsc);
    
    // Focus management for accessibility
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
    
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, handleCancel]);

  if (!open) return null;

  return (
    <div 
      className="modal-backdrop" 
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 id="modal-title" className="text-lg font-semibold mb-3">{title}</h3>
        <p id="modal-description" className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button ref={cancelRef} onClick={handleCancel} className="btn-secondary">Cancelar</button>
          <button onClick={onConfirm} className="btn-danger">Confirmar</button>
        </div>
      </div>
    </div>
  );
}
