import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedidos, setSelectedPedidos] = useState([]);

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

  const generarPDF = () => {
    const doc = new jsPDF();
    let yPosition = 10;

    selectedPedidos.forEach((pedidoId) => {
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
    });

    doc.save("pedidos_seleccionados.pdf");
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Historial de Pedidos</h2>
      <ul className="pl-4 space-y-2">
        {pedidos.map((pedido) => (
          <li key={pedido.id} className="flex justify-between items-center">
            <div>
              <input
                type="checkbox"
                checked={selectedPedidos.includes(pedido.id)}
                onChange={() => handleCheckboxChange(pedido.id)}
                className="mr-2"
              />
              <span>{`Pedido #${pedido.id} - ${pedido.cliente.nombre}`}</span>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={generarPDF} className="bg-blue-600 text-white px-4 py-2 rounded mt-4">
        Generar PDF de Pedidos Seleccionados
      </button>
    </div>
  );
}