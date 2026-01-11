/**
 * Tests for src/store/index.js (Zustand store)
 * 
 * Testing:
 * - Auth state management
 * - Login/logout actions
 * - Token initialization
 * - Auth state selectors
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Helper to create mock JWT
const createMockJWT = (payload) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadBase64 = btoa(JSON.stringify(payload));
  return `${header}.${payloadBase64}.signature`;
};

describe('store/index.js', () => {
  let useAppStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.resetModules();

    // Mock fetch globally
    global.fetch = vi.fn();

    // Import fresh store for each test
    const storeModule = await import('../store/index');
    useAppStore = storeModule.useAppStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have initial auth state', () => {
      const state = useAppStore.getState();
      
      expect(state.auth).toBeDefined();
      expect(state.auth.user).toBeNull();
      expect(state.auth.token).toBeNull();
      expect(state.auth.isLoading).toBe(false);
      expect(state.auth.error).toBeNull();
    });

    it('should have initial entities state', () => {
      const state = useAppStore.getState();
      
      expect(state.entities).toBeDefined();
      expect(state.entities.clientes).toEqual([]);
      expect(state.entities.productos).toEqual([]);
      expect(state.entities.pedidos).toEqual([]);
    });
  });

  describe('login', () => {
    it('should set loading state during login', async () => {
      // Mock successful login response
      const mockToken = createMockJWT({
        sub: 'testuser',
        rol: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockToken,
          username: 'testuser',
          rol: 'admin',
        }),
      });

      const { login } = useAppStore.getState();
      
      // Start login (don't await yet)
      const loginPromise = login('testuser', 'password123');
      
      // Check loading state
      expect(useAppStore.getState().auth.isLoading).toBe(true);
      
      await loginPromise;
    });

    it('should update auth state on successful login', async () => {
      const mockToken = createMockJWT({
        sub: 'admin',
        rol: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockToken,
          username: 'admin',
          rol: 'admin',
        }),
      });

      const { login } = useAppStore.getState();
      await login('admin', 'admin123');

      const state = useAppStore.getState();
      expect(state.auth.user).not.toBeNull();
      expect(state.auth.user.username).toBe('admin');
      expect(state.auth.user.rol).toBe('admin');
      expect(state.auth.token).toBe(mockToken);
      expect(state.auth.isLoading).toBe(false);
    });

    it('should save token to localStorage on successful login', async () => {
      const mockToken = createMockJWT({
        sub: 'admin',
        rol: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockToken,
          username: 'admin',
          rol: 'admin',
        }),
      });

      const { login } = useAppStore.getState();
      await login('admin', 'password');

      expect(localStorage.setItem).toHaveBeenCalledWith('token', mockToken);
    });

    it('should set error on failed login', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Credenciales inválidas' }),
      });

      const { login } = useAppStore.getState();
      
      await expect(login('baduser', 'badpass')).rejects.toThrow();

      const state = useAppStore.getState();
      expect(state.auth.error).toBe('Credenciales inválidas');
      expect(state.auth.isLoading).toBe(false);
      expect(state.auth.user).toBeNull();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { login } = useAppStore.getState();
      
      await expect(login('user', 'pass')).rejects.toThrow('Network error');

      const state = useAppStore.getState();
      expect(state.auth.error).toBe('Network error');
    });
  });

  describe('logout', () => {
    it('should clear auth state on logout', async () => {
      // First, set up logged-in state
      const mockToken = createMockJWT({
        sub: 'admin',
        rol: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      localStorage.setItem.mockReturnValue(undefined);
      localStorage.getItem.mockReturnValue(mockToken);

      // Mock logout endpoint
      global.fetch.mockResolvedValueOnce({ ok: true });

      const { logout } = useAppStore.getState();
      await logout();

      const state = useAppStore.getState();
      expect(state.auth.user).toBeNull();
      expect(state.auth.token).toBeNull();
    });

    it('should remove token from localStorage', async () => {
      localStorage.getItem.mockReturnValue('some-token');
      global.fetch.mockResolvedValueOnce({ ok: true });

      const { logout } = useAppStore.getState();
      await logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    it('should call backend logout endpoint', async () => {
      const token = 'test-token';
      localStorage.getItem.mockReturnValue(token);
      global.fetch.mockResolvedValueOnce({ ok: true });

      const { logout } = useAppStore.getState();
      await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });

    it('should not throw if logout endpoint fails', async () => {
      localStorage.getItem.mockReturnValue('token');
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { logout } = useAppStore.getState();
      
      // Should not throw
      await expect(logout()).resolves.not.toThrow();

      // Should still clear state
      const state = useAppStore.getState();
      expect(state.auth.user).toBeNull();
    });
  });

  describe('initAuth', () => {
    it('should restore auth state from valid token in localStorage', () => {
      const payload = {
        sub: 'admin',
        rol: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      const mockToken = createMockJWT(payload);
      localStorage.getItem.mockReturnValue(mockToken);

      const { initAuth } = useAppStore.getState();
      initAuth();

      const state = useAppStore.getState();
      expect(state.auth.user).not.toBeNull();
      expect(state.auth.user.rol).toBe('admin');
      expect(state.auth.token).toBe(mockToken);
    });

    it('should clear expired token on init', () => {
      const payload = {
        sub: 'admin',
        rol: 'admin',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      };
      const mockToken = createMockJWT(payload);
      localStorage.getItem.mockReturnValue(mockToken);

      const { initAuth } = useAppStore.getState();
      initAuth();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      
      const state = useAppStore.getState();
      expect(state.auth.user).toBeNull();
    });

    it('should handle missing token gracefully', () => {
      localStorage.getItem.mockReturnValue(null);

      const { initAuth } = useAppStore.getState();
      
      // Should not throw
      expect(() => initAuth()).not.toThrow();

      const state = useAppStore.getState();
      expect(state.auth.user).toBeNull();
    });

    it('should handle malformed token gracefully', () => {
      localStorage.getItem.mockReturnValue('not-a-valid-jwt');

      const { initAuth } = useAppStore.getState();
      initAuth();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('entities state', () => {
    it('should have isLoading flags for all entities', () => {
      const state = useAppStore.getState();
      
      expect(state.entities.isLoading.clientes).toBe(false);
      expect(state.entities.isLoading.productos).toBe(false);
      expect(state.entities.isLoading.pedidos).toBe(false);
      expect(state.entities.isLoading.categorias).toBe(false);
      expect(state.entities.isLoading.ofertas).toBe(false);
    });

    it('should have error state for all entities', () => {
      const state = useAppStore.getState();
      
      expect(state.entities.errors.clientes).toBeNull();
      expect(state.entities.errors.productos).toBeNull();
      expect(state.entities.errors.pedidos).toBeNull();
    });

    it('should have lastFetched timestamps for all entities', () => {
      const state = useAppStore.getState();
      
      expect(state.entities.lastFetched.clientes).toBeNull();
      expect(state.entities.lastFetched.productos).toBeNull();
      expect(state.entities.lastFetched.pedidos).toBeNull();
    });
  });
});
