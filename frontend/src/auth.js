import { logger } from './utils/logger';

export function guardarToken(token) {
  localStorage.setItem("token", token);
  try {
    // notify other tabs about auth change
    localStorage.setItem('auth_event', String(Date.now()));
  } catch (e) { }
}

export function obtenerToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "null" || token === "undefined") return null;
  return token;
}

export function borrarToken() {
  localStorage.removeItem("token");
  try {
    localStorage.setItem('auth_event', String(Date.now()));
  } catch (e) { }
}

export function onAuthChange(cb) {
  const handler = (e) => {
    if (!e) return;
    if (e.key === 'auth_event') cb();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function estaAutenticado() {
  return !!obtenerToken();
}

/**
 * Decodifica un token JWT de forma segura.
 * @param {string} token - El token JWT a decodificar
 * @returns {object|null} - El payload decodificado o null si es inválido
 */
export function decodeToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Validar que la parte del payload sea base64 válido
    const payload = parts[1];
    if (!payload) return null;

    // Decodificar base64
    const decoded = atob(payload);
    const parsed = JSON.parse(decoded);

    // Validar estructura mínima del JWT
    if (!parsed || typeof parsed !== 'object') return null;

    return parsed;
  } catch (e) {
    logger.warn('Error decodificando token:', e.message);
    return null;
  }
}

/**
 * Obtiene información del usuario desde el token actual.
 * @returns {object|null} - Info del usuario o null
 */
export function getUserFromToken() {
  const token = obtenerToken();
  if (!token) return null;

  const payload = decodeToken(token);
  if (!payload) return null;

  return {
    username: payload.sub || payload.username,
    rol: payload.rol,
    exp: payload.exp
  };
}
