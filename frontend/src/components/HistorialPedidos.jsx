import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const [activeTab, setActiveTab] = useState("pendientes");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/pedidos`)
      .then(res => res.json())
      .then(data => setPedidos(data));
  }, []);

  const handleCheckboxChange = (pedidoId) => {
    setSelectedPedidos((prevSelected) =>
      prevSelected.includes(pedidoId)
        ? prevSelected.filter((id) => id !== pedidoId)
        : [...prevSelected, pedidoId]
    );
  };

  const generarPDF = async () => {
    const doc = new jsPDF();
    let yPosition = 10;

    for (let pedidoId of selectedPedidos) {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      doc.text(`Pedido de ${pedido.cliente.nombre}`, 10, yPosition);
      yPosition += 10;
      doc.text(`Fecha: ${new Date(pedido.fecha).toLocaleDateString()}`, 10, yPosition);
      yPosition += 10;
      doc.text("Productos:", 10, yPosition);
      yPosition += 10;
      pedido.productos.forEach((p, index) => {
        doc.text(`${index + 1}. ${p.nombre} - $${p.precio} x ${p.cantidad}`, 10, yPosition);
        yPosition += 10;
      });
      yPosition += 10;

      // Actualizar estado a generado
      await fetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedido.id}`, {
        method: "PATCH"
      });
    }

    doc.save("pedidos_seleccionados.pdf");

    // Volver a cargar pedidos
    const res = await fetch(`${import.meta.env.VITE_API_URL}/pedidos`);
    const data = await res.json();
    setPedidos(data);
    setSelectedPedidos([]);
  };

  const eliminarPedido = async (pedidoId) => {
    await fetch(`${import.meta.env.VITE_API_URL}/pedidos/${pedidoId}`, {
      method: "DELETE"
    });
    setPedidos(pedidos.filter(p => p.id !== pedidoId));
  };

  const pendientes = pedidos.filter(p => !p.pdf_generado);
  const generados = pedidos.filter(p => p.pdf_generado);

  const pedidosMostrados = activeTab === "pendientes" ? pendientes : generados;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Historial de Pedidos</h2>

      <div className="flex mb-4 space-x-2">
        <button onClick={() => setActiveTab("pendientes")} className={\`px-4 py-2 rounded \${activeTab === "pendientes" ? "bg-blue-600 text-white" : "bg-gray-200"}\`}>
          Pendientes
        </button>
        <button onClick={() => setActiveTab("generados")} className={\`px-4 py-2 rounded \${activeTab === "generados" ? "bg-green-600 text-white" : "bg-gray-200"}\`}>
          Generados
        </button>
      </div>

      <ul className="pl-4 space-y-2">
        {pedidosMostrados.map((pedido) => (
          <li key={pedido.id} className="flex justify-between items-center">
            <div>
              {activeTab === "pendientes" && (
                <input
                  type="checkbox"
                  checked={selectedPedidos.includes(pedido.id)}
                  onChange={() => handleCheckboxChange(pedido.id)}
                  className="mr-2"
                />
              )}
              <span>{`Pedido #${pedido.id} - ${pedido.cliente.nombre}`}</span>
            </div>
            {activeTab === "pendientes" && (
              <button
                onClick={() => eliminarPedido(pedido.id)}
                className="ml-4 text-red-600 text-sm"
              >
                Eliminar
              </button>
            )}
          </li>
        ))}
      </ul>

      {activeTab === "pendientes" && (
        <button
          onClick={generarPDF}
          className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
        >
          Generar PDF de Pedidos Seleccionados
        </button>
      )}
    </div>
  );
}
