import { useEffect, useRef, useCallback } from 'react';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, onClose }) {
  // Support both onCancel and onClose for backwards compatibility
  const handleCancel = onCancel || onClose;
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const containerRef = useRef(null);

  // Focus trap implementation
  const handleKeyDown = useCallback((e) => {
    if (!open) return;

    if (e.key === 'Escape') {
      handleCancel?.();
      return;
    }

    // Tab key focus trap
    if (e.key === 'Tab') {
      const focusableElements = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [open, handleCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    // Focus first button when opening
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }

    // Prevent body scroll when modal is open
    if (open) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

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
      <div
        ref={containerRef}
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title" className="text-lg font-semibold mb-3">{title}</h3>
        <p id="modal-description" className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            onClick={handleCancel}
            className="btn-secondary"
            aria-label="Cancelar acción"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="btn-danger"
            aria-label="Confirmar acción"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
