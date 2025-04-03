// TokenPayloadDebug.jsx
import { useAuth } from "./AuthContext";

export default function TokenPayloadDebug() {
  const { token, tokenPayload } = useAuth();

  if (!token || !tokenPayload) return null;

  const fecha = tokenPayload.exp
    ? new Date(tokenPayload.exp * 1000).toLocaleString()
    : "N/A";

  return (
    <div className="fixed bottom-0 right-0 m-2 p-1 bg-gray-100 border border-gray-300 text-xs rounded shadow max-w-[200px] z-50">
      <p className="mb-1">
        <strong>🔑 Token:</strong> {token.slice(0, 20)}...{token.slice(-20)}
      </p>
      <p>
        <strong>👤 Usuario:</strong> {tokenPayload.sub}
      </p>
      <p>
        <strong>🛡️ Rol:</strong> {tokenPayload.rol}
      </p>
      <p>
        <strong>✅ Activo:</strong> {tokenPayload.activo ? "Sí" : "No"}
      </p>
      <p>
        <strong>📅 Expira:</strong> {fecha}
      </p>
    </div>
  );
}
