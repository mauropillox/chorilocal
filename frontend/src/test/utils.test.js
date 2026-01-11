/**
 * Tests for src/utils.js
 * 
 * Testing:
 * - Recent productos (localStorage operations)
 * - Validation functions (producto, cliente)
 * - Theme management (init, apply, toggle)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addToRecentProductos,
  getRecentProductos,
  validateProducto,
  validateCliente,
  initTheme,
  applyTheme,
  toggleTheme,
} from '../utils';

describe('utils.js', () => {
  beforeEach(() => {
    // Clear localStorage mock
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ==================== Recent Productos ====================
  describe('addToRecentProductos', () => {
    it('should add a producto to recent list', () => {
      const producto = { id: 1, nombre: 'Chorizo Criollo' };
      addToRecentProductos(producto);
      
      expect(localStorage.setItem).toHaveBeenCalled();
      const stored = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(stored[0]).toEqual(producto);
    });

    it('should keep only last 5 productos', () => {
      // Mock getItem to return existing products
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 2, nombre: 'Producto 2' },
        { id: 3, nombre: 'Producto 3' },
        { id: 4, nombre: 'Producto 4' },
        { id: 5, nombre: 'Producto 5' },
        { id: 6, nombre: 'Producto 6' },
      ]));

      const newProducto = { id: 1, nombre: 'New Producto' };
      addToRecentProductos(newProducto);

      const stored = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(stored.length).toBe(5);
      expect(stored[0].id).toBe(1); // New one is first
    });

    it('should move existing producto to front (no duplicates)', () => {
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 1, nombre: 'Producto 1' },
        { id: 2, nombre: 'Producto 2' },
        { id: 3, nombre: 'Producto 3' },
      ]));

      // Add producto with same id
      addToRecentProductos({ id: 2, nombre: 'Producto 2 Updated' });

      const stored = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(stored.length).toBe(3);
      expect(stored[0].id).toBe(2);
      expect(stored[0].nombre).toBe('Producto 2 Updated');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => addToRecentProductos({ id: 1 })).not.toThrow();
    });
  });

  describe('getRecentProductos', () => {
    it('should return empty array when no recent productos', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(getRecentProductos()).toEqual([]);
    });

    it('should return parsed productos from localStorage', () => {
      const productos = [{ id: 1 }, { id: 2 }];
      localStorage.getItem.mockReturnValue(JSON.stringify(productos));
      expect(getRecentProductos()).toEqual(productos);
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.getItem.mockReturnValue('not-valid-json{');
      expect(getRecentProductos()).toEqual([]);
    });
  });

  // ==================== Validation ====================
  describe('validateProducto', () => {
    it('should return no errors for valid producto', () => {
      const errors = validateProducto('Chorizo', 100, 50, 10);
      expect(errors).toEqual([]);
    });

    it('should return error for empty nombre', () => {
      const errors = validateProducto('', 100, 50, 10);
      expect(errors).toContain('Nombre requerido');
    });

    it('should return error for whitespace-only nombre', () => {
      const errors = validateProducto('   ', 100, 50, 10);
      expect(errors).toContain('Nombre requerido');
    });

    it('should return error for zero precio', () => {
      const errors = validateProducto('Chorizo', 0, 50, 10);
      expect(errors).toContain('Precio debe ser > 0');
    });

    it('should return error for negative precio', () => {
      const errors = validateProducto('Chorizo', -10, 50, 10);
      expect(errors).toContain('Precio debe ser > 0');
    });

    it('should return error for negative stock', () => {
      const errors = validateProducto('Chorizo', 100, -5, 10);
      expect(errors).toContain('Stock no puede ser negativo');
    });

    it('should return error for negative stock minimo', () => {
      const errors = validateProducto('Chorizo', 100, 50, -5);
      expect(errors).toContain('Stock mínimo no puede ser negativo');
    });

    it('should return multiple errors', () => {
      const errors = validateProducto('', 0, -5, -10);
      expect(errors.length).toBe(4);
    });

    it('should accept string numbers for precio/stock', () => {
      const errors = validateProducto('Chorizo', '100', '50', '10');
      expect(errors).toEqual([]);
    });
  });

  describe('validateCliente', () => {
    it('should return no errors for valid cliente', () => {
      const errors = validateCliente('Juan Perez', '1234567', 'Calle 123');
      expect(errors).toEqual([]);
    });

    it('should return error for empty nombre', () => {
      const errors = validateCliente('', '1234567', 'Calle 123');
      expect(errors).toContain('Nombre requerido');
    });

    it('should return error for null nombre', () => {
      const errors = validateCliente(null, '1234567', 'Calle 123');
      expect(errors).toContain('Nombre requerido');
    });

    it('should accept empty telefono and direccion', () => {
      const errors = validateCliente('Juan', '', '');
      expect(errors).toEqual([]);
    });
  });

  // ==================== Theme Management ====================
  describe('initTheme', () => {
    it('should return light theme by default', () => {
      localStorage.getItem.mockReturnValue(null);
      const theme = initTheme();
      expect(theme).toBe('light');
    });

    it('should return saved theme from localStorage', () => {
      localStorage.getItem.mockReturnValue('dark');
      const theme = initTheme();
      expect(theme).toBe('dark');
    });

    it('should apply theme to document', () => {
      localStorage.getItem.mockReturnValue('dark');
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    it('should set dark theme attribute', () => {
      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should remove theme attribute for light theme', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      localStorage.getItem.mockReturnValue('light');
      const newTheme = toggleTheme();
      expect(newTheme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      localStorage.getItem.mockReturnValue('dark');
      const newTheme = toggleTheme();
      expect(newTheme).toBe('light');
    });

    it('should default to dark when no theme set', () => {
      localStorage.getItem.mockReturnValue(null);
      const newTheme = toggleTheme();
      expect(newTheme).toBe('dark');
    });
  });
});
