import { useEffect, useRef } from 'react';

const atajos = [
  {
    grupo: 'Navegación', items: [
      { keys: ['Ctrl', '1'], desc: 'Ir a Clientes' },
      { keys: ['Ctrl', '2'], desc: 'Ir a Productos' },
      { keys: ['Ctrl', '3'], desc: 'Ir a Pedidos' },
      { keys: ['Ctrl', '4'], desc: 'Ir a Historial' },
      { keys: ['Ctrl', '5'], desc: 'Ir a Dashboard' },
      { keys: ['Ctrl', '6'], desc: 'Ir a Categorías' },
    ]
  },
  {
    grupo: 'Acciones', items: [
      { keys: ['Ctrl', 'K'], desc: 'Buscar (global)' },
      { keys: ['Ctrl', 'N'], desc: 'Nuevo elemento' },
      { keys: ['Escape'], desc: 'Cerrar modal/buscar' },
    ]
  },
  {
    grupo: 'Ayuda', items: [
      { keys: ['Ctrl', '?'], desc: 'Mostrar esta ayuda' },
      { keys: ['F1'], desc: 'Mostrar esta ayuda' },
    ]
  },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
        padding: '1rem'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>⌨️ Atajos de Teclado</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
              color: 'var(--color-text)'
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {atajos.map(grupo => (
          <div key={grupo.grupo} style={{ marginBottom: '1.25rem' }}>
            <h3 style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
              marginBottom: '0.5rem',
              fontWeight: 600
            }}>
              {grupo.grupo}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {grupo.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-border)'
                  }}
                >
                  <span style={{ color: 'var(--color-text)' }}>{item.desc}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {item.keys.map((key, i) => (
                      <kbd
                        key={i}
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          margin: '1rem 0 0 0'
        }}>
          En Mac, usa ⌘ Cmd en lugar de Ctrl
        </p>
      </div>
    </div>
  );
}
