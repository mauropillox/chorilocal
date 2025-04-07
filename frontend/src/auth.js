// auth.js

export function obtenerToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "null" || token === "undefined") {
    console.log("No se encontró token válido");
    return null;
  }
  return token;
}

export function guardarToken(token) {
  localStorage.setItem("token", token);
}

export function borrarToken() {
  localStorage.removeItem("token");
}

export function estaAutenticado() {
  return !!obtenerToken();
}

/**
 * Helper to fetch with the Authorization header
 */
export async function fetchConToken(url, options = {}) {
  const token = obtenerToken();
  const headers = options.headers || {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[fetchConToken] Enviando token:", token);
  } else {
    console.warn("[fetchConToken] ❌ No hay token disponible");
  }

  // Detecta si el body es FormData. Si no lo es, setea Content-Type como JSON.
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });
    console.log(`[fetchConToken] Respuesta de ${url}:`, res.status);
    return res;
  } catch (err) {
    console.error(`Error al llamar a ${url}:`, err);
    return { ok: false };
  }
}
