// frontend/src/auth.js
export function guardarToken(token) {
    localStorage.setItem("token", token);
  }
  
  export function obtenerToken() {
    return localStorage.getItem("token");
  }
  
  export function borrarToken() {
    localStorage.removeItem("token");
  }
  
  export function estaAutenticado() {
    return !!localStorage.getItem("token");
  }
  