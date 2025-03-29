export function guardarToken(token) {
  localStorage.setItem("token", token);
}

export function obtenerToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "null" || token === "undefined") return null;
  return token;
}

export function borrarToken() {
  localStorage.removeItem("token");
}

export function estaAutenticado() {
  return !!obtenerToken();
}
