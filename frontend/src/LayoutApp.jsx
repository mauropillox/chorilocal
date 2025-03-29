// LayoutApp.jsx
import { Link, Routes, Route, Navigate } from 'react-router-dom';

export default function LayoutApp({ handleLogout, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 text-gray-800 flex flex-col items-center">
      <div className="w-full max-w-md">
        <header className="text-center mb-6">
          <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-2" />
          <h1 className="text-3xl font-extrabold text-blue-700">❄️ Casa de Congelados</h1>
          <p className="text-sm text-blue-500">Gestión de Clientes, Productos, Pedidos y Historial</p>
        </header>

        <nav className="flex justify-center gap-2 mb-6 flex-wrap">
          <Link to="/clientes" className="px-4 py-2 rounded bg-white text-blue-600">Clientes</Link>
          <Link to="/productos" className="px-4 py-2 rounded bg-white text-blue-600">Productos</Link>
          <Link to="/pedidos" className="px-4 py-2 rounded bg-white text-blue-600">Pedidos</Link>
          <Link to="/historial" className="px-4 py-2 rounded bg-white text-blue-600">Historial</Link>
          <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 text-white">
            Logout
          </button>
        </nav>

        <section className="bg-white rounded-2xl shadow p-4">
          {/* Aca van los children que traemos desde la ruta */}
          {children}
        </section>

        <footer className="text-center mt-10 text-sm text-blue-400">
          © 2025 Casa de Congelados. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
