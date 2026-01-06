// Utility functions for UX improvements

// Track recent items (Productos added to orders)
export const addToRecentProductos = (producto) => {
  try {
    let recent = JSON.parse(localStorage.getItem('recent_productos') || '[]');
    recent = recent.filter(p => p.id !== producto.id);
    recent.unshift(producto);
    recent = recent.slice(0, 5); // Keep only last 5
    localStorage.setItem('recent_productos', JSON.stringify(recent));
  } catch (e) {
    console.error('Failed to save recent producto:', e);
  }
};

export const getRecentProductos = () => {
  try {
    return JSON.parse(localStorage.getItem('recent_productos') || '[]');
  } catch (e) {
    return [];
  }
};

// Validate producto before saving
export const validateProducto = (nombre, precio, stock, stockMinimo) => {
  const errors = [];
  if (!nombre || nombre.trim().length === 0) errors.push('Nombre requerido');
  if (!precio || parseFloat(precio) <= 0) errors.push('Precio debe ser > 0');
  if (parseFloat(stock) < 0) errors.push('Stock no puede ser negativo');
  if (parseFloat(stockMinimo) < 0) errors.push('Stock mínimo no puede ser negativo');
  return errors;
};

// Validate cliente before saving
export const validateCliente = (nombre, telefono, direccion) => {
  const errors = [];
  if (!nombre || nombre.trim().length === 0) errors.push('Nombre requerido');
  return errors;
};

// Theme management - default to light
export const initTheme = () => {
  // Get saved theme or default to 'light'
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  return savedTheme;
};

export const applyTheme = (theme) => {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', theme);
};

export const toggleTheme = () => {
  const current = localStorage.getItem('theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  return newTheme;
};
