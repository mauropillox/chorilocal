// AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({
          token,
          id: payload.sub,
          rol: payload.rol,
          activo: payload.activo,
          exp: payload.exp,
        });
      } catch {
        localStorage.removeItem("token");
      }
    }
  }, []);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Credenciales inválidas");
    }

    const data = await res.json();
    const token = data.access_token;

    localStorage.setItem("token", token);

    const payload = JSON.parse(atob(token.split(".")[1]));

    const userData = {
      token,
      id: payload.sub,
      rol: payload.rol,
      activo: payload.activo,
      exp: payload.exp,
    };

    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const token = user?.token || null;
  const tokenPayload = user
    ? {
        sub: user.id,
        rol: user.rol,
        activo: user.activo,
        exp: user.exp,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, login, logout, token, tokenPayload }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
