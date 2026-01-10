"""Hoja de Ruta Router - Route sheet generation for delivery drivers"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from fastapi.responses import Response

import db
import pdf_utils
from deps import get_current_user, limiter, RATE_LIMIT_READ

router = APIRouter()


class HojaRutaRequest(BaseModel):
    repartidor: str
    zona: Optional[str] = None


@router.post("/hoja-ruta/generar-pdf")
@limiter.limit(RATE_LIMIT_READ)
async def generar_hoja_ruta_pdf(
    request: Request,
    data: HojaRutaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a printable PDF route sheet for a specific delivery driver"""
    repartidor = data.repartidor
    zona_filtro = data.zona
    
    if not repartidor:
        raise HTTPException(status_code=400, detail="Se requiere un repartidor")
        
    try:
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get pedidos for this repartidor
            query = """
                SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por
                FROM pedidos p
                JOIN clientes c ON p.cliente_id = c.id
                WHERE p.repartidor = ? 
                AND p.estado NOT IN ('entregado', 'cancelado')
            """
            params = [repartidor]
            
            if zona_filtro:
                query += " AND c.zona = ?"
                params.append(zona_filtro)
                
            cursor.execute(query, params)
            pedidos_rows = cursor.fetchall()
            
            # If no pedidos, return empty PDF with message
            if not pedidos_rows:
                pdf_bytes = pdf_utils.generar_pdf_hoja_ruta([], [], repartidor, datetime.now().strftime("%d/%m/%Y %H:%M"))
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=hoja_ruta_{repartidor}.pdf"}
                )
                
            # Build full pedidos structure
            pedidos_list = []
            clientes_ids = set()
            
            # Column indices for pedido query
            for row in pedidos_rows:
                p_dict = {
                    'id': row[0],
                    'cliente_id': row[1],
                    'fecha': row[2],
                    'estado': row[3],
                    'notas': row[4],
                    'creado_por': row[5]
                }
                clientes_ids.add(p_dict['cliente_id'])
                
                # Get productos for this pedido
                cursor.execute("""
                    SELECT dp.producto_id, pr.nombre, dp.cantidad, pr.precio, dp.tipo
                    FROM detalles_pedido dp
                    JOIN productos pr ON dp.producto_id = pr.id
                    WHERE dp.pedido_id = ?
                """, (p_dict['id'],))
                
                items = []
                total = 0
                for item in cursor.fetchall():
                    subtotal = item[2] * item[3]  # cantidad * precio
                    total += subtotal
                    items.append({
                        "nombre": item[1],
                        "cantidad": item[2],
                        "precio": item[3],
                        "tipo": item[4]
                    })
                
                p_dict['productos'] = items
                p_dict['total'] = total
                pedidos_list.append(p_dict)
                
            # Get clientes info
            if clientes_ids:
                placeholders = ",".join("?" * len(clientes_ids))
                cursor.execute(f"SELECT id, nombre, telefono, direccion, zona FROM clientes WHERE id IN ({placeholders})", list(clientes_ids))
                clientes_list = []
                for row in cursor.fetchall():
                    clientes_list.append({
                        'id': row[0],
                        'nombre': row[1],
                        'telefono': row[2],
                        'direccion': row[3],
                        'zona': row[4]
                    })
            else:
                clientes_list = []
        
        # Generate PDF (outside with block - connection closed)
        pdf_bytes = pdf_utils.generar_pdf_hoja_ruta(
            pedidos_list,
            clientes_list,
            repartidor,
            datetime.now().strftime("%d/%m/%Y %H:%M")
        )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=hoja_ruta_{repartidor}.pdf"}
        )
        
    except Exception as e:
        from exceptions import safe_error_handler
        raise safe_error_handler(e, "hoja_ruta", "generar PDF")
