"""
PDF generation utilities for FRIOSUR.
Generates professional PDFs with proper pagination, formatting, and totals.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from io import BytesIO
from typing import List, Dict, Any
import textwrap


# Page dimensions
PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 40
RIGHT_MARGIN = 40
TOP_MARGIN = 50
BOTTOM_MARGIN = 60

# Content area
CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN
CONTENT_TOP = PAGE_HEIGHT - TOP_MARGIN
CONTENT_BOTTOM = BOTTOM_MARGIN + 20

# Colors
COLOR_PRIMARY = HexColor('#6366f1')  # Indigo
COLOR_SUCCESS = HexColor('#10b981')  # Green
COLOR_GRAY = HexColor('#6b7280')
COLOR_LIGHT_GRAY = HexColor('#f3f4f6')
COLOR_DARK = HexColor('#111827')


def wrap_text(text: str, max_chars: int = 50) -> List[str]:
    """Wrap text to fit within max characters per line."""
    wrapped = textwrap.wrap(text, width=max_chars)
    return wrapped if wrapped else ['']


def format_currency(value: float) -> str:
    """Format value as currency."""
    return f"${value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def estimate_pedido_height(pedido: Dict[str, Any]) -> float:
    """Estimate the height needed to render a complete pedido block."""
    line_height = 16
    
    # Header (cliente + fecha): ~40px
    height = 45
    
    # Products
    productos = pedido.get('productos', [])
    for prod in productos:
        nombre = prod.get('nombre', 'Producto')
        # Each product takes at least one line, maybe more if name wraps
        lines = len(wrap_text(nombre, 40))
        height += line_height * max(lines, 1)
    
    # Total line + spacing
    height += 35
    
    # Bottom separator
    height += 15
    
    return height


def draw_header(pdf: canvas.Canvas, page_num: int, total_pages: int, fecha_generacion: str):
    """Draw page header with title and page number."""
    # Title
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(LEFT_MARGIN, CONTENT_TOP, "FRIOSUR")
    
    # Subtitle
    pdf.setFillColor(COLOR_GRAY)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(LEFT_MARGIN, CONTENT_TOP - 18, "Lista de Pedidos")
    
    # Generation date
    pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, CONTENT_TOP, f"Generado: {fecha_generacion}")
    
    # Horizontal line
    pdf.setStrokeColor(COLOR_LIGHT_GRAY)
    pdf.setLineWidth(1)
    pdf.line(LEFT_MARGIN, CONTENT_TOP - 30, PAGE_WIDTH - RIGHT_MARGIN, CONTENT_TOP - 30)
    
    # Page number at bottom
    pdf.setFillColor(COLOR_GRAY)
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(PAGE_WIDTH / 2, 30, f"Página {page_num} de {total_pages}")


def draw_pedido(pdf: canvas.Canvas, pedido: Dict[str, Any], y: float, clientes_dict: Dict[int, str]) -> float:
    """
    Draw a single pedido block starting at y position.
    Returns the new y position after drawing.
    """
    line_height = 16
    
    # Get cliente info
    cliente_id = pedido.get('cliente_id')
    cliente_nombre = clientes_dict.get(cliente_id, f"Cliente #{cliente_id}")
    pedido_id = pedido.get('id', '?')
    fecha = pedido.get('fecha', '')
    if fecha:
        # Format: 2025-12-29T10:30:00 -> 29/12/2025 10:30
        try:
            parts = fecha.split('T')
            date_parts = parts[0].split('-')
            time_part = parts[1][:5] if len(parts) > 1 else ''
            fecha = f"{date_parts[2]}/{date_parts[1]}/{date_parts[0]} {time_part}"
        except:
            fecha = fecha[:16]
    
    # Header background
    pdf.setFillColor(COLOR_LIGHT_GRAY)
    pdf.roundRect(LEFT_MARGIN, y - 30, CONTENT_WIDTH, 35, 5, fill=True, stroke=False)
    
    # Pedido number badge
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.roundRect(LEFT_MARGIN + 5, y - 25, 70, 22, 3, fill=True, stroke=False)
    pdf.setFillColor(HexColor('#ffffff'))
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(LEFT_MARGIN + 12, y - 18, f"#{pedido_id}")
    
    # Cliente name
    pdf.setFillColor(COLOR_DARK)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(LEFT_MARGIN + 85, y - 18, cliente_nombre[:40])
    
    # Fecha
    pdf.setFillColor(COLOR_GRAY)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 10, y - 18, fecha)
    
    y -= 45
    
    # Products table header
    pdf.setFillColor(COLOR_GRAY)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(LEFT_MARGIN + 10, y, "PRODUCTO")
    pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 180, y, "CANT.")
    pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 120, y, "PRECIO")
    pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 10, y, "SUBTOTAL")
    
    y -= 5
    pdf.setStrokeColor(HexColor('#e5e7eb'))
    pdf.setLineWidth(0.5)
    pdf.line(LEFT_MARGIN + 10, y, PAGE_WIDTH - RIGHT_MARGIN - 10, y)
    y -= 12
    
    # Products
    productos = pedido.get('productos', [])
    total = 0
    
    pdf.setFont("Helvetica", 10)
    for prod in productos:
        nombre = prod.get('nombre', 'Producto')
        cantidad = prod.get('cantidad', 1)
        tipo = prod.get('tipo', 'unidad')
        precio = prod.get('precio', 0) or 0
        subtotal = precio * cantidad
        total += subtotal
        
        # Product name (may wrap)
        pdf.setFillColor(COLOR_DARK)
        wrapped_name = wrap_text(nombre, 35)
        for i, line in enumerate(wrapped_name):
            pdf.drawString(LEFT_MARGIN + 10, y, line)
            if i == 0:
                # Cantidad, precio, subtotal on first line
                pdf.setFillColor(COLOR_GRAY)
                tipo_abbr = {'unidad': 'u', 'caja': 'cj', 'gancho': 'g', 'tira': 't'}.get(tipo, tipo[:2])
                pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 180, y, f"{cantidad} {tipo_abbr}")
                pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 120, y, format_currency(precio))
                pdf.setFillColor(COLOR_DARK)
                pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 10, y, format_currency(subtotal))
            y -= line_height
    
    # Total line
    y -= 8
    pdf.setStrokeColor(HexColor('#e5e7eb'))
    pdf.line(LEFT_MARGIN + 10, y + 5, PAGE_WIDTH - RIGHT_MARGIN - 10, y + 5)
    
    pdf.setFillColor(COLOR_SUCCESS)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 180, y - 8, "TOTAL:")
    pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 10, y - 8, format_currency(total))
    
    y -= 30  # Spacing after pedido
    
    return y


def generar_pdf_multiple(pedidos: List[Dict[str, Any]], clientes: List[Dict[str, Any]], fecha_generacion: str) -> bytes:
    """
    Generate a multi-page PDF with all pedidos.
    Handles pagination intelligently - never cuts a pedido across pages.
    """
    if not pedidos:
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter)
        pdf.setFont("Helvetica", 12)
        pdf.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT / 2, "No hay pedidos para generar")
        pdf.save()
        return buffer.getvalue()
    
    # Build clientes lookup
    clientes_dict = {c['id']: c['nombre'] for c in clientes}
    
    # First pass: calculate which pedidos go on which page
    pages = []
    current_page = []
    current_height = 0
    available_height = CONTENT_TOP - CONTENT_BOTTOM - 50  # -50 for header
    
    for pedido in pedidos:
        pedido_height = estimate_pedido_height(pedido)
        
        if current_height + pedido_height > available_height and current_page:
            # Start new page
            pages.append(current_page)
            current_page = [pedido]
            current_height = pedido_height
        else:
            current_page.append(pedido)
            current_height += pedido_height
    
    # Add last page
    if current_page:
        pages.append(current_page)
    
    total_pages = len(pages)
    
    # Second pass: render PDF
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    
    for page_num, page_pedidos in enumerate(pages, 1):
        # Draw header
        draw_header(pdf, page_num, total_pages, fecha_generacion)
        
        # Starting Y position (below header)
        y = CONTENT_TOP - 50
        
        # Draw each pedido
        for pedido in page_pedidos:
            y = draw_pedido(pdf, pedido, y, clientes_dict)
        
        # Add page break if not last page
        if page_num < total_pages:
            pdf.showPage()
    
    pdf.save()
    return buffer.getvalue()


# Legacy function for backwards compatibility
def generar_pdf_pedido(cliente, fecha, productos):
    """Legacy function - not used in current flow."""
    pass
