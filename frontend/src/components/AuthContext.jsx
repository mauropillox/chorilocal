// AuthContext.jsx - Legacy compatibility wrapper using Zustand store
import { createContext, useContext, useEffect } from "react";
import { useAppStore, useAuth as useAuthStore, useAuthActions } from "../store";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const auth = useAuthStore();
  const { login, logout, initAuth } = useAuthActions();

  // Initialize auth on mount
  useEffect(() => {
    initAuth();

    // Listen for logout events from authFetch
    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [initAuth, logout]);

  // Build user object for backward compatibility
  const user = auth.user ? {
    token: auth.token,
    id: auth.user.id,
    rol: auth.user.rol,
    activo: true,
    exp: auth.user.exp,
  } : null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Return default values if context is not available (outside provider)
  if (!context) {
    return { user: null, login: async () => { }, logout: () => { } };
  }
  return context;
};
