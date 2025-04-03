import { useAuth } from "./AuthContext";

export default function TokenDebug() {
  const { user, token, logout } = useAuth();
  const show = import.meta.env.VITE_TOKENDEBUG === "true";

  if (!show || !token || !user) return null;

  const expDate = user.exp
    ? new Date(user.exp * 1000).toLocaleString()
    : "N/A";

  return (
    <div className="fixed bottom-0 right-0 m-2 p-2 bg-white border border-gray-300 text-xs rounded shadow max-w-sm z-50 text-gray-800 opacity-80">
      <strong>🔑 Token:</strong> <span className="opacity-30">(oculto)</span>
      <p><strong>👤 Usuario ID:</strong> {user.sub}</p>
      <p><strong>🛡️ Rol:</strong> {user.rol}</p>
      <p><strong>✅ Activo:</strong> {user.activo ? "Sí" : "No"}</p>
      <p><strong>📅 Expira:</strong> {expDate}</p>
      <button onClick={logout} className="text-red-500 mt-1 underline">
        Logout
      </button>
    </div>
  );
}
