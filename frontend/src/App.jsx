// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import LayoutApp from "./LayoutApp";
import Login from "./components/Login";
import Register from "./components/Register";
import Clientes from "./components/Clientes";
import Productos from "./components/Productos";
import Pedidos from "./components/Pedidos";
import HistorialPedidos from "./components/HistorialPedidos";
import AdminPanel from "./components/AdminPanel";
// ❌ Old: import { AuthProvider, AuthContext } from "./components/AuthContext";
// ✅ New:
import { AuthProvider } from "./components/AuthContext";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";
import TokenDebug from "./components/TokenDebug";

function AppRoutes() {
  // If you used to do something like: 
  //   const { user, cargando } = useContext(AuthContext);
  // Now do: 
  //   const { token, tokenPayload } = useAuth();
  // or skip if not needed.

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/" element={<LayoutApp />}>
        <Route
          path="clientes"
          element={
            <RequireAuth>
              <Clientes />
            </RequireAuth>
          }
        />
        <Route
          path="productos"
          element={
            <RequireAuth>
              <Productos />
            </RequireAuth>
          }
        />
        <Route
          path="pedidos"
          element={
            <RequireAuth>
              <Pedidos />
            </RequireAuth>
          }
        />
        <Route
          path="historial"
          element={
            <RequireAuth>
              <HistorialPedidos />
            </RequireAuth>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <TokenDebug />
      </Router>
    </AuthProvider>
  );
}
