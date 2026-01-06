export function toast(message, type = 'info', duration = 3000, options = {}) {
  const event = new CustomEvent('toast', { 
    detail: { 
      message, 
      type, 
      duration,
      ...options
    } 
  });
  window.dispatchEvent(event);
}

export const toastSuccess = (msg, d) => toast(msg, 'success', d);
export const toastError = (msg, d) => toast(msg, 'error', d);
export const toastWarn = (msg, d) => toast(msg, 'warn', d);

// Toast with undo action
export const toastWithUndo = (message, undoCallback, duration = 5000) => {
  toast(message, 'info', duration, { 
    undoCallback,
    showUndo: true 
  });
};
