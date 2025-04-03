// src/components/RequireAdmin.jsx
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export function RequireAdmin({ children }) {
  const { user } = useAuth();

  if (user === null) {
    return <div className="p-4 text-gray-600">Cargando sesión...</div>;
  }

  if (!user?.token || user.rol !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
