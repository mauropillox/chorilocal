import { useEffect, useRef, useCallback } from 'react';

export default function ConfirmDialog({
  open,
  isOpen, // Support both open and isOpen
  title,
  message,
  onConfirm,
  onCancel,
  onClose,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default' // 'default' or 'danger'
}) {
  // Support both open and isOpen, and both onCancel and onClose
  const isVisible = open ?? isOpen;
  const handleCancel = onCancel || onClose;
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const containerRef = useRef(null);

  // Focus trap implementation
  const handleKeyDown = useCallback((e) => {
    if (!isVisible) return;

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
  }, [isVisible, handleCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    // Focus first button when opening
    if (isVisible && cancelRef.current) {
      cancelRef.current.focus();
    }

    // Prevent body scroll when modal is open
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isVisible, handleKeyDown]);

  if (!isVisible) return null;

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
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            aria-label="Confirmar acción"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
