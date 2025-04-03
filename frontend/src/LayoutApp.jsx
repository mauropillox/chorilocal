import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./components/AuthContext";

export default function LayoutApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const rutaActual = location.pathname.slice(1);
  const rol = user?.rol;

  useEffect(() => {
    document.title = "FrioSur";
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLinkClasses = (ruta) =>
    `relative px-2 py-1 transition-colors duration-200 ${
      rutaActual === ruta
        ? "text-blue-500 font-semibold"
        : "text-white hover:text-blue-300"
    }`;

  const underlineClasses = (ruta) =>
    rutaActual === ruta
      ? "absolute left-0 bottom-0 w-full h-0.5 bg-blue-500 transition-all duration-300"
      : "absolute left-0 bottom-0 w-0 h-0.5 bg-blue-500 transition-all duration-300 group-hover:w-full";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      <div className="bg-blue-100 py-10 w-full flex justify-center">
        <img src="/logo.png" alt="Logo" className="h-52 sm:h-64 object-contain drop-shadow-xl" />
      </div>

      <div className="bg-slate-900 text-white w-full py-4 text-center">
        <h1 className="text-xl font-bold">Casa de Congelados</h1>
        <p className="text-sm mb-2">
          Gestión de Clientes, Productos, Pedidos y Historial
        </p>
        <nav className="flex justify-center space-x-4 mt-2 text-sm">
          {["clientes", "productos", "pedidos", "historial"].map((ruta) => (
            <div key={ruta} className="relative group">
              <Link to={`/${ruta}`} className={navLinkClasses(ruta)}>
                {ruta.charAt(0).toUpperCase() + ruta.slice(1)}
              </Link>
              <span className={underlineClasses(ruta)}></span>
            </div>
          ))}

          {rol === "admin" && (
            <div className="relative group">
              <Link to="/admin" className={navLinkClasses("admin")}>
                Admin
              </Link>
              <span className={underlineClasses("admin")}></span>
            </div>
          )}

          <button onClick={handleLogout} className="text-red-400 hover:text-red-600 ml-2">
            Logout
          </button>
        </nav>
      </div>

      <div className="p-4 w-full max-w-5xl flex-grow">
        <Outlet />
      </div>

      <footer className="text-xs text-gray-500 text-center py-4">
        © 2025 FrioSur. Todos los derechos reservados.
      </footer>
    </div>
  );
}
