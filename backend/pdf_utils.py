from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def generar_pdf_pedido(cliente, fecha, productos):
    archivo = f"pedido_{cliente.replace(' ', '_')}_{fecha.replace(':', '-')}.pdf"
    pdf = canvas.Canvas(archivo, pagesize=letter)

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, 750, f"Pedido para: {cliente}")
    pdf.setFont("Helvetica", 12)
    pdf.drawString(50, 730, f"Fecha: {fecha}")

    y = 700
    total = 0
    for prod in productos:
        texto = f"- {prod.nombre} (${prod.precio:.2f})"
        pdf.drawString(50, y, texto)
        y -= 20
        total += prod.precio

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y - 10, f"TOTAL: ${total:.2f}")
    pdf.save()
    print(f"PDF generado: {archivo}")