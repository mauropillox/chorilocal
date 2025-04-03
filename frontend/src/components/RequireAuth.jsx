// RequireAuth.jsx
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export function RequireAuth({ children }) {
  const { user } = useAuth();

  // Mostrar loader mientras se carga el contexto
  if (user === null) {
    return <div className="p-4 text-gray-600">Cargando sesión...</div>;
  }

  // Si no hay token, redirigir a login
  if (!user?.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}