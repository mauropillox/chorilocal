import { useState } from 'react';
import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Pedidos from './components/Pedidos';
import HistorialPedidos from './components/HistorialPedidos'; // Import the new component

export default function App() {
  const [pestaña, setPestaña] = useState('clientes');

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 text-gray-800 flex flex-col items-center">
      <div className="w-full max-w-md">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-blue-700">❄️ Casa de Congelados</h1>
          <p className="text-sm text-blue-500">Gestión de Clientes, Productos, Pedidos y Historial</p>
        </header>

        <nav className="flex justify-center gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${pestaña === 'clientes' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
            onClick={() => setPestaña('clientes')}
          >
            Clientes
          </button>
          <button
            className={`px-4 py-2 rounded ${pestaña === 'productos' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
            onClick={() => setPestaña('productos')}
          >
            Productos
          </button>
          <button
            className={`px-4 py-2 rounded ${pestaña === 'pedidos' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
            onClick={() => setPestaña('pedidos')}
          >
            Pedidos
          </button>
          <button
            className={`px-4 py-2 rounded ${pestaña === 'historial' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
            onClick={() => setPestaña('historial')}
          >
            Historial de Pedidos
          </button>
        </nav>

        <section className="bg-white rounded-2xl shadow p-4">
          {pestaña === 'clientes' && <Clientes />}
          {pestaña === 'productos' && <Productos />}
          {pestaña === 'pedidos' && <Pedidos />}
          {pestaña === 'historial' && <HistorialPedidos />} {/* Render Historial de Pedidos */}
        </section>

        <footer className="text-center mt-10 text-sm text-blue-400">
          © 2025 Casa de Congelados. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
