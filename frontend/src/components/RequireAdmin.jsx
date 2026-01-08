// src/components/RequireAdmin.jsx
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export function RequireAdmin({ children }) {
  const { user } = useAuth();

  if (user === null) {
    return <div className="p-4 text-gray-600">Cargando sesión...</div>;
  }

  // Accept both 'admin' and 'administrador' roles
  const isAdmin = user?.rol === "admin" || user?.rol === "administrador";
  if (!user?.token || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
