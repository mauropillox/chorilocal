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


# =============================================================================
# HOJA DE RUTA PDF - Para repartidores
# =============================================================================

def generar_pdf_hoja_ruta(
    pedidos: List[Dict[str, Any]], 
    clientes: List[Dict[str, Any]], 
    repartidor: str,
    fecha_generacion: str
) -> bytes:
    """
    Genera un PDF optimizado para repartidores con:
    - Pedidos agrupados por zona
    - Checkbox para marcar entregas
    - Dirección y teléfono prominentes
    - Lista compacta de productos
    - Espacio para firma del cliente
    """
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    
    if not pedidos:
        pdf.setFont("Helvetica", 14)
        pdf.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT / 2, "No hay pedidos para esta hoja de ruta")
        pdf.save()
        return buffer.getvalue()
    
    # Build clientes lookup
    clientes_dict = {c['id']: c for c in clientes}
    
    # Group pedidos by zona
    pedidos_por_zona = {}
    for pedido in pedidos:
        cliente_id = pedido.get('cliente_id')
        cliente = clientes_dict.get(cliente_id, {})
        zona = cliente.get('zona', 'Sin Zona')
        if zona not in pedidos_por_zona:
            pedidos_por_zona[zona] = []
        pedidos_por_zona[zona].append({**pedido, 'cliente': cliente})
    
    # Sort zones alphabetically
    zonas_ordenadas = sorted(pedidos_por_zona.keys())
    
    page_num = 1
    total_pedidos = len(pedidos)
    
    def draw_page_header(pdf, page_num, repartidor, fecha_generacion, total_pedidos):
        """Draw header for route sheet"""
        # Logo/Title area
        pdf.setFillColor(COLOR_PRIMARY)
        pdf.rect(LEFT_MARGIN, PAGE_HEIGHT - 80, CONTENT_WIDTH, 50, fill=True, stroke=False)
        
        pdf.setFillColor(HexColor('#ffffff'))
        pdf.setFont("Helvetica-Bold", 20)
        pdf.drawString(LEFT_MARGIN + 15, PAGE_HEIGHT - 55, "🚚 HOJA DE RUTA")
        
        pdf.setFont("Helvetica", 11)
        pdf.drawString(LEFT_MARGIN + 15, PAGE_HEIGHT - 72, f"FRIOSUR - {fecha_generacion}")
        
        # Repartidor badge
        pdf.setFillColor(COLOR_SUCCESS)
        badge_width = len(repartidor) * 8 + 40
        pdf.roundRect(PAGE_WIDTH - RIGHT_MARGIN - badge_width - 10, PAGE_HEIGHT - 70, badge_width, 28, 5, fill=True, stroke=False)
        pdf.setFillColor(HexColor('#ffffff'))
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - badge_width, PAGE_HEIGHT - 52, f"👤 {repartidor}")
        
        # Stats line below header
        pdf.setFillColor(COLOR_DARK)
        pdf.setFont("Helvetica-Bold", 11)
        y = PAGE_HEIGHT - 100
        pdf.drawString(LEFT_MARGIN, y, f"📦 {total_pedidos} pedidos")
        pdf.drawString(LEFT_MARGIN + 120, y, f"📍 {len(zonas_ordenadas)} zonas")
        pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, y, f"Página {page_num}")
        
        # Line separator
        pdf.setStrokeColor(COLOR_GRAY)
        pdf.setLineWidth(1)
        pdf.line(LEFT_MARGIN, y - 10, PAGE_WIDTH - RIGHT_MARGIN, y - 10)
        
        return y - 25
    
    y = draw_page_header(pdf, page_num, repartidor, fecha_generacion, total_pedidos)
    
    entrega_num = 0
    
    for zona in zonas_ordenadas:
        pedidos_zona = pedidos_por_zona[zona]
        
        # Check if we need a new page for zona header
        if y < CONTENT_BOTTOM + 100:
            pdf.showPage()
            page_num += 1
            y = draw_page_header(pdf, page_num, repartidor, fecha_generacion, total_pedidos)
        
        # Zona header
        pdf.setFillColor(HexColor('#fef3c7'))  # Amber light
        pdf.roundRect(LEFT_MARGIN, y - 20, CONTENT_WIDTH, 28, 5, fill=True, stroke=False)
        pdf.setFillColor(HexColor('#b45309'))  # Amber dark
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(LEFT_MARGIN + 10, y - 8, f"📍 ZONA: {zona}")
        pdf.setFont("Helvetica", 10)
        pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 10, y - 8, f"{len(pedidos_zona)} entrega{'s' if len(pedidos_zona) > 1 else ''}")
        
        y -= 35
        
        for pedido in pedidos_zona:
            entrega_num += 1
            cliente = pedido.get('cliente', {})
            
            # Estimate height needed for this pedido
            productos = pedido.get('productos', [])
            productos_lines = (len(productos) + 2) // 3  # 3 products per line
            pedido_height = 70 + (productos_lines * 14)
            
            # Check if we need a new page
            if y < CONTENT_BOTTOM + pedido_height:
                pdf.showPage()
                page_num += 1
                y = draw_page_header(pdf, page_num, repartidor, fecha_generacion, total_pedidos)
            
            # Pedido card background
            pdf.setFillColor(HexColor('#f9fafb'))
            pdf.roundRect(LEFT_MARGIN, y - pedido_height + 10, CONTENT_WIDTH, pedido_height, 5, fill=True, stroke=False)
            pdf.setStrokeColor(HexColor('#e5e7eb'))
            pdf.setLineWidth(1)
            pdf.roundRect(LEFT_MARGIN, y - pedido_height + 10, CONTENT_WIDTH, pedido_height, 5, fill=False, stroke=True)
            
            # Entrega number with checkbox
            pdf.setFillColor(COLOR_PRIMARY)
            pdf.roundRect(LEFT_MARGIN + 8, y - 18, 35, 22, 3, fill=True, stroke=False)
            pdf.setFillColor(HexColor('#ffffff'))
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawCentredString(LEFT_MARGIN + 25, y - 10, f"#{entrega_num}")
            
            # Checkbox for delivery confirmation
            pdf.setStrokeColor(COLOR_GRAY)
            pdf.setLineWidth(2)
            pdf.rect(PAGE_WIDTH - RIGHT_MARGIN - 30, y - 18, 18, 18, fill=False, stroke=True)
            
            # Cliente name
            pdf.setFillColor(COLOR_DARK)
            pdf.setFont("Helvetica-Bold", 13)
            cliente_nombre = cliente.get('nombre', f"Cliente #{pedido.get('cliente_id', '?')}")
            pdf.drawString(LEFT_MARGIN + 50, y - 12, cliente_nombre[:35])
            
            y -= 25
            
            # Address and phone
            pdf.setFillColor(COLOR_GRAY)
            pdf.setFont("Helvetica", 10)
            direccion = cliente.get('direccion', 'Sin dirección')
            telefono = cliente.get('telefono', '')
            
            pdf.drawString(LEFT_MARGIN + 15, y, f"📍 {direccion[:50]}")
            if telefono:
                pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 15, y, f"📞 {telefono}")
            
            y -= 18
            
            # Products in compact format
            pdf.setFillColor(COLOR_DARK)
            pdf.setFont("Helvetica", 9)
            productos_texto = []
            for prod in productos:
                nombre = prod.get('nombre', '')[:20]
                cant = prod.get('cantidad', 1)
                productos_texto.append(f"{nombre} x{cant}")
            
            # Join products in lines of ~3
            productos_str = " • ".join(productos_texto)
            wrapped = wrap_text(productos_str, 80)
            for line in wrapped[:2]:  # Max 2 lines
                pdf.drawString(LEFT_MARGIN + 15, y, line)
                y -= 14
            if len(wrapped) > 2:
                pdf.drawString(LEFT_MARGIN + 15, y, f"... y {len(productos) - 4} productos más")
                y -= 14
            
            # Total
            total = sum((p.get('precio', 0) or 0) * p.get('cantidad', 1) for p in productos)
            pdf.setFillColor(COLOR_SUCCESS)
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(LEFT_MARGIN + 15, y, f"💰 TOTAL: {format_currency(total)}")
            
            # Firma space
            pdf.setFillColor(COLOR_GRAY)
            pdf.setFont("Helvetica", 8)
            pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN - 15, y, "Firma: ____________")
            
            y -= 25
    
    # Final summary page
    pdf.showPage()
    page_num += 1
    y = draw_page_header(pdf, page_num, repartidor, fecha_generacion, total_pedidos)
    
    # Summary title
    pdf.setFillColor(COLOR_DARK)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(LEFT_MARGIN, y, "📋 RESUMEN DE ENTREGAS")
    y -= 30
    
    # Table header
    pdf.setFillColor(COLOR_LIGHT_GRAY)
    pdf.rect(LEFT_MARGIN, y - 15, CONTENT_WIDTH, 25, fill=True, stroke=False)
    pdf.setFillColor(COLOR_DARK)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(LEFT_MARGIN + 10, y - 5, "#")
    pdf.drawString(LEFT_MARGIN + 35, y - 5, "ZONA")
    pdf.drawString(LEFT_MARGIN + 150, y - 5, "CLIENTE")
    pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 100, y - 5, "TOTAL")
    pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 40, y - 5, "OK")
    y -= 25
    
    # Summary rows
    pdf.setFont("Helvetica", 9)
    entrega_num = 0
    gran_total = 0
    
    for zona in zonas_ordenadas:
        for pedido in pedidos_por_zona[zona]:
            entrega_num += 1
            cliente = pedido.get('cliente', {})
            total = sum((p.get('precio', 0) or 0) * p.get('cantidad', 1) for p in pedido.get('productos', []))
            gran_total += total
            
            if y < CONTENT_BOTTOM + 20:
                pdf.showPage()
                page_num += 1
                y = draw_page_header(pdf, page_num, repartidor, fecha_generacion, total_pedidos)
                y -= 20
            
            # Alternate row colors
            if entrega_num % 2 == 0:
                pdf.setFillColor(HexColor('#f9fafb'))
                pdf.rect(LEFT_MARGIN, y - 10, CONTENT_WIDTH, 18, fill=True, stroke=False)
            
            pdf.setFillColor(COLOR_DARK)
            pdf.drawString(LEFT_MARGIN + 10, y - 3, str(entrega_num))
            pdf.drawString(LEFT_MARGIN + 35, y - 3, (zona or 'Sin Zona')[:15])
            pdf.drawString(LEFT_MARGIN + 150, y - 3, cliente.get('nombre', '')[:25])
            pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - 100, y - 3, format_currency(total))
            # Checkbox
            pdf.setStrokeColor(COLOR_GRAY)
            pdf.rect(PAGE_WIDTH - RIGHT_MARGIN - 35, y - 8, 14, 14, fill=False, stroke=True)
            
            y -= 18
    
    # Grand total
    y -= 10
    pdf.setFillColor(COLOR_SUCCESS)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(LEFT_MARGIN + 150, y, f"TOTAL GENERAL: {format_currency(gran_total)}")
    
    # Footer notes
    y -= 40
    pdf.setFillColor(COLOR_GRAY)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(LEFT_MARGIN, y, "Notas: _____________________________________________________________")
    y -= 20
    pdf.drawString(LEFT_MARGIN, y, "Firma Repartidor: _________________________  Hora Salida: ______  Hora Regreso: ______")
    
    pdf.save()
    return buffer.getvalue()
