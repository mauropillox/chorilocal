/**
 * Tests for src/auth.js
 * 
 * Testing:
 * - Token management (save, get, delete)
 * - Token decoding
 * - Authentication state
 * - Auth change listeners
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  guardarToken,
  obtenerToken,
  borrarToken,
  estaAutenticado,
  decodeToken,
  getUserFromToken,
  onAuthChange,
} from '../auth';

describe('auth.js', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ==================== Token Management ====================
  describe('guardarToken', () => {
    it('should save token to localStorage', () => {
      guardarToken('test-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-token-123');
    });

    it('should notify other tabs via auth_event', () => {
      guardarToken('test-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_event', expect.any(String));
    });
  });

  describe('obtenerToken', () => {
    it('should return token from localStorage', () => {
      localStorage.getItem.mockReturnValue('my-token');
      expect(obtenerToken()).toBe('my-token');
    });

    it('should return null for missing token', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(obtenerToken()).toBeNull();
    });

    it('should return null for "null" string', () => {
      localStorage.getItem.mockReturnValue('null');
      expect(obtenerToken()).toBeNull();
    });

    it('should return null for "undefined" string', () => {
      localStorage.getItem.mockReturnValue('undefined');
      expect(obtenerToken()).toBeNull();
    });

    it('should return null for empty string', () => {
      localStorage.getItem.mockReturnValue('');
      expect(obtenerToken()).toBeNull();
    });
  });

  describe('borrarToken', () => {
    it('should remove token from localStorage', () => {
      borrarToken();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    it('should notify other tabs via auth_event', () => {
      borrarToken();
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_event', expect.any(String));
    });
  });

  describe('estaAutenticado', () => {
    it('should return true when token exists', () => {
      localStorage.getItem.mockReturnValue('valid-token');
      expect(estaAutenticado()).toBe(true);
    });

    it('should return false when no token', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(estaAutenticado()).toBe(false);
    });

    it('should return false for invalid token values', () => {
      localStorage.getItem.mockReturnValue('null');
      expect(estaAutenticado()).toBe(false);
    });
  });

  // ==================== Token Decoding ====================
  describe('decodeToken', () => {
    // Create a valid JWT structure: header.payload.signature
    const createMockJWT = (payload) => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payloadBase64 = btoa(JSON.stringify(payload));
      const signature = 'mock-signature';
      return `${header}.${payloadBase64}.${signature}`;
    };

    it('should decode valid JWT payload', () => {
      const payload = { sub: 'admin', rol: 'admin', exp: 1234567890 };
      const token = createMockJWT(payload);
      const decoded = decodeToken(token);
      expect(decoded).toEqual(payload);
    });

    it('should return null for null token', () => {
      expect(decodeToken(null)).toBeNull();
    });

    it('should return null for undefined token', () => {
      expect(decodeToken(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decodeToken('')).toBeNull();
    });

    it('should return null for non-string token', () => {
      expect(decodeToken(12345)).toBeNull();
      expect(decodeToken({})).toBeNull();
      expect(decodeToken([])).toBeNull();
    });

    it('should return null for malformed JWT (missing parts)', () => {
      expect(decodeToken('only-one-part')).toBeNull();
      expect(decodeToken('two.parts')).toBeNull();
    });

    it('should return null for invalid base64 payload', () => {
      expect(decodeToken('header.!!!invalid-base64!!!.signature')).toBeNull();
    });

    it('should return null for non-JSON payload', () => {
      const invalidPayload = btoa('not-json');
      expect(decodeToken(`header.${invalidPayload}.signature`)).toBeNull();
    });
  });

  describe('getUserFromToken', () => {
    const createMockJWT = (payload) => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payloadBase64 = btoa(JSON.stringify(payload));
      return `${header}.${payloadBase64}.signature`;
    };

    it('should return user info from valid token', () => {
      const payload = { sub: 'admin', rol: 'admin', exp: 1234567890 };
      const token = createMockJWT(payload);
      localStorage.getItem.mockReturnValue(token);

      const user = getUserFromToken();
      expect(user).toEqual({
        username: 'admin',
        rol: 'admin',
        exp: 1234567890,
      });
    });

    it('should use username field if sub is not present', () => {
      const payload = { username: 'vendedor', rol: 'vendedor', exp: 123 };
      const token = createMockJWT(payload);
      localStorage.getItem.mockReturnValue(token);

      const user = getUserFromToken();
      expect(user.username).toBe('vendedor');
    });

    it('should return null when no token', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(getUserFromToken()).toBeNull();
    });

    it('should return null for invalid token', () => {
      localStorage.getItem.mockReturnValue('invalid-token');
      expect(getUserFromToken()).toBeNull();
    });
  });

  // ==================== Auth Change Listener ====================
  describe('onAuthChange', () => {
    it('should register storage event listener', () => {
      const callback = vi.fn();
      onAuthChange(callback);
      expect(window.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = onAuthChange(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should remove listener when unsubscribed', () => {
      const callback = vi.fn();
      const unsubscribe = onAuthChange(callback);
      unsubscribe();
      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    });
  });
});
