from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from datetime import datetime
import re
import os

def generar_pdf_pedidos(pedidos):
    os.makedirs("pdfs", exist_ok=True)

    if len(pedidos) == 1:
        pedido = pedidos[0]
        cliente = pedido.get("cliente_nombre", "desconocido")
        cliente_slug = re.sub(r'\W+', '_', cliente.lower())
        pedido_id = str(pedido.get("id", "x")).zfill(3)
        fecha_str = pedido.get("fecha", datetime.now().isoformat())
        try:
            fecha_obj = datetime.fromisoformat(fecha_str)
        except:
            fecha_obj = datetime.now()
        fecha_formateada = fecha_obj.strftime("%Y-%m-%d_%H%M")
        nombre_archivo = f"pedido_{pedido_id}_{cliente_slug}_{fecha_formateada}.pdf"
    else:
        nombre_archivo = f"pedidos_agrupados_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"

    ruta_archivo = os.path.join("pdfs", nombre_archivo)

    pdf = canvas.Canvas(ruta_archivo, pagesize=letter)
    width, height = letter
    margen = 50
    y = height - margen

    for pedido in pedidos:
        pdf.setFont("Helvetica-Bold", 12)
        fecha_str = pedido.get("fecha", "")
        try:
            fecha_obj = datetime.fromisoformat(fecha_str)
            fecha_legible = fecha_obj.strftime("%d/%m/%Y %H:%M")
        except:
            fecha_legible = "Sin fecha"

        encabezado = f"Pedido #{pedido['id']} - Cliente: {pedido['cliente_nombre']} - {fecha_legible}"
        pdf.drawString(margen, y, encabezado)
        y -= 20

        observaciones = pedido.get("observaciones", "").strip()
        if observaciones:
            pdf.setFont("Helvetica-Oblique", 10)
            pdf.drawString(margen + 20, y, f"📝 Observaciones: {observaciones}")
            y -= 17

        pdf.setFont("Helvetica", 10)
        for prod in pedido.get("productos", []):
            texto = f"• {prod['nombre']} — {prod['cantidad']} {prod['tipo']}"
            pdf.drawString(margen + 30, y, texto)
            y -= 17  # ← más espacio entre productos

        y -= 10
        pdf.setStrokeColor(colors.grey)
        pdf.setLineWidth(0.5)
        pdf.line(margen, y, width - margen, y)
        y -= 25  # ← más espacio antes del siguiente pedido

        if y < 100:
            pdf.showPage()
            y = height - margen

    pdf.save()
    return ruta_archivo
