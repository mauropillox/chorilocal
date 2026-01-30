"""Pedidos (Orders) Router"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import io
import csv

import db
import models
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)
from exceptions import safe_error_handler
from routers.websocket import broadcast_pedido_change, WSEventType

router = APIRouter()


class NotasUpdate(BaseModel):
    notas: Optional[str] = None


class ItemUpdate(BaseModel):
    producto_id: int
    cantidad: float
    tipo: str = "unidad"


class ItemCreate(BaseModel):
    producto_id: int
    cantidad: float
    tipo: str = "unidad"


class GenerarPDFsRequest(BaseModel):
    pedido_ids: List[int]


class PreviewStockRequest(BaseModel):
    pedido_ids: List[int]


@router.get("/pedidos/antiguos", tags=["pedidos"], summary="Obtener pedidos antiguos", description="Obtiene pedidos pendientes o en preparación que tienen más de N horas de antigüedad")
@limiter.limit(RATE_LIMIT_READ)
async def get_pedidos_antiguos(
    request: Request,
    horas: int = Query(default=24, ge=1, le=168, description="Horas de antigüedad mínima"),
    current_user: dict = Depends(get_current_user)
):
    """Get old pending orders (older than N hours)"""
    try:
        fecha_limite = (datetime.now() - timedelta(hours=horas)).strftime("%Y-%m-%d %H:%M:%S")
        
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, 
                       p.creado_por, c.nombre as cliente_nombre, p.pdf_generado, p.repartidor
                FROM pedidos p
                JOIN clientes c ON p.cliente_id = c.id
                WHERE p.estado IN ('Pendiente', 'pendiente', 'En Preparación', 'preparando')
                AND p.fecha < ?
                AND p.fecha >= '2026-02-01'
                ORDER BY p.fecha ASC
                LIMIT 10
            """, (fecha_limite,))
            
            pedidos = cur.fetchall()
            return [{
                "id": p[0],
                "cliente_id": p[1],
                "fecha": p[2],
                "estado": p[3],
                "notas": p[4],
                "creado_por": p[5],
                "cliente_nombre": p[6],
                "pdf_generado": p[7],
                "repartidor": p[8]
            } for p in pedidos]
    except Exception as e:
        raise safe_error_handler(e, "pedidos", "obtener pedidos antiguos")


@router.post("/pedidos", response_model=models.Pedido, tags=["pedidos"], summary="Crear pedido", description="Crea un nuevo pedido para un cliente con productos")
@limiter.limit(RATE_LIMIT_WRITE)
async def crear_pedido(request: Request, pedido: models.PedidoCreate, current_user: dict = Depends(get_current_user)):
    if current_user["rol"] not in ["admin", "vendedor", "administrador", "oficina"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para crear pedidos")

    creado_por = current_user["username"]
    
    # Build pedido dict in the format expected by db.add_pedido
    pedido_dict: Dict[str, Any] = {}
    
    # Handle both cliente_id and cliente object formats
    if pedido.cliente_id is not None:
        pedido_dict["cliente_id"] = pedido.cliente_id
    elif pedido.cliente is not None:
        pedido_dict["cliente"] = {"id": pedido.cliente.id}
    else:
        raise HTTPException(status_code=400, detail="El cliente_id o cliente es requerido")
    
    # Handle both items and productos formats
    if pedido.productos is not None and len(pedido.productos) > 0:
        pedido_dict["productos"] = [
            {
                "id": p.id if p.id else p.producto_id,
                "cantidad": p.cantidad,
                "tipo": p.tipo or "unidad"
            }
            for p in pedido.productos
        ]
    elif pedido.items is not None and len(pedido.items) > 0:
        pedido_dict["productos"] = [
            {
                "id": item.producto_id,
                "cantidad": item.cantidad,
                "tipo": "unidad"
            }
            for item in pedido.items
        ]
    else:
        raise HTTPException(status_code=400, detail="Se requieren productos o items")
    
    if pedido.notas:
        pedido_dict["notas"] = pedido.notas
    pedido_dict["pdf_generado"] = pedido.pdf_generado or False
    
    try:
        result = db.add_pedido(pedido_dict, creado_por=creado_por)
        return models.Pedido(
            id=result["id"],
            cliente_id=result.get("cliente_id") or (result.get("cliente", {}).get("id")),
            fecha=result.get("fecha"),
            estado="pendiente",
            notas=result.get("notas"),
            creado_por=creado_por,
            pdf_generado=1 if result.get("pdf_generado") else 0
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise safe_error_handler(e, "pedidos", "crear pedido")

@router.get("/pedidos", response_model=List[models.Pedido])
async def get_pedidos(
    current_user: dict = Depends(get_current_user),
    cliente_id: Optional[int] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    estado: Optional[str] = None,
    creado_por: Optional[str] = Query(None, description="Filtrar pedidos por el nombre de usuario del creador (solo para admin y oficina)")
):
    query = "SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por, c.nombre as cliente_nombre, p.pdf_generado, p.repartidor FROM pedidos p JOIN clientes c ON p.cliente_id = c.id"
    params = []
    conditions = []

    # PRODUCTION LAUNCH: Only show orders from 2026-02-01 onwards
    conditions.append("p.fecha >= ?")
    params.append("2026-02-01")

    # For 'vendedor' role, force filter by their own username
    if current_user["rol"] == "vendedor":
        conditions.append("p.creado_por = ?")
        params.append(current_user["username"])
    # For 'admin' or 'oficina', they can filter by any user if the parameter is provided
    elif current_user["rol"] in ["admin", "oficina", "administrador"] and creado_por:
        conditions.append("p.creado_por = ?")
        params.append(creado_por)

    if cliente_id:
        conditions.append("p.cliente_id = ?")
        params.append(cliente_id)
    if fecha_inicio:
        conditions.append("p.fecha >= ?")
        params.append(fecha_inicio)
    if fecha_fin:
        conditions.append("p.fecha <= ?")
        params.append(fecha_fin)
    if estado:
        conditions.append("p.estado = ?")
        params.append(estado)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY p.fecha DESC"

    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        pedidos_raw = cursor.fetchall()
        
        # Build result with productos for each pedido
        result = []
        for p in pedidos_raw:
            pedido_id = p[0]
            # Get productos for this pedido
            cursor.execute("""
                SELECT d.producto_id, pr.nombre, pr.precio, d.cantidad, d.tipo
                FROM detalles_pedido d
                JOIN productos pr ON d.producto_id = pr.id
                WHERE d.pedido_id = ?
            """, (pedido_id,))
            productos_raw = cursor.fetchall()
            productos = [
                models.ProductoPedido(
                    id=prod[0],
                    producto_id=prod[0],
                    nombre=prod[1],
                    precio=prod[2],
                    cantidad=prod[3],
                    tipo=prod[4] or "unidad"
                ) for prod in productos_raw
            ]
            
            result.append(models.Pedido(
                id=p[0], 
                cliente_id=p[1], 
                fecha=p[2], 
                estado=p[3], 
                notas=p[4], 
                creado_por=p[5], 
                cliente_nombre=p[6], 
                pdf_generado=p[7],
                repartidor=p[8],
                productos=productos
            ))
        
        return result


# --- Static routes MUST come before dynamic /{pedido_id} routes ---

@router.get("/pedidos/creators")
@limiter.limit(RATE_LIMIT_READ)
async def get_pedidos_creators(request: Request, current_user: dict = Depends(get_current_user)):
    """Get list of unique users who created pedidos (for filtering in admin)"""
    if current_user["rol"] not in ["admin", "oficina", "administrador"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta información")
    
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT creado_por FROM pedidos 
            WHERE creado_por IS NOT NULL AND creado_por != ''
            ORDER BY creado_por
        """)
        creators = cursor.fetchall()
        # Return array of strings (not objects) - frontend expects ["admin", "user1", ...]
        return [c[0] for c in creators]


@router.get("/pedidos/export/csv")
@limiter.limit(RATE_LIMIT_READ)
async def export_pedidos_csv(
    request: Request,
    current_user: dict = Depends(get_current_user),
    desde: Optional[str] = None,
    hasta: Optional[str] = None
):
    """Export pedidos to CSV format"""
    if current_user["rol"] not in ["admin", "oficina", "administrador"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para exportar")
    
    query = """
        SELECT p.id, c.nombre as cliente, p.fecha, p.estado, p.notas, p.creado_por
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
    """
    params = []
    conditions = []
    
    if desde:
        conditions.append("p.fecha >= ?")
        params.append(desde)
    if hasta:
        conditions.append("p.fecha <= ?")
        params.append(hasta)
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY p.fecha DESC"
    
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        pedidos = cursor.fetchall()
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Cliente", "Fecha", "Estado", "Notas", "Creado Por"])
        
        for p in pedidos:
            writer.writerow(p)
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=pedidos_{datetime.now().strftime('%Y%m%d')}.csv"}
        )


# --- Dynamic routes with {pedido_id} ---

@router.get("/pedidos/{pedido_id}", response_model=models.PedidoDetalle)
async def get_pedido_detalle(pedido_id: int, current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener detalles del pedido
        cursor.execute("SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por, c.nombre as cliente_nombre, p.pdf_generado, p.repartidor FROM pedidos p JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?", (pedido_id,))
        pedido = cursor.fetchone()

        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

        # Verificar permisos
        if current_user["rol"] == 'vendedor' and pedido[5] != current_user["username"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para ver este pedido")

        # Obtener items del pedido from detalles_pedido
        cursor.execute("""
            SELECT dp.producto_id, pr.nombre, dp.cantidad, pr.precio, dp.tipo
            FROM detalles_pedido dp
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE dp.pedido_id = ?
        """, (pedido_id,))
        items = cursor.fetchall()

    pedido_dict = {
        "id": pedido[0],
        "cliente_id": pedido[1],
        "fecha": pedido[2],
        "estado": pedido[3],
        "notas": pedido[4],
        "creado_por": pedido[5],
        "cliente_nombre": pedido[6],
        "pdf_generado": pedido[7],
        "repartidor": pedido[8],
        "items": [models.PedidoItemDetalle(producto_id=i[0], producto_nombre=i[1], cantidad=i[2], precio_unitario=i[3]) for i in items]
    }
    
    return models.PedidoDetalle(**pedido_dict)

@router.put("/pedidos/{pedido_id}/estado", response_model=models.Pedido)
async def cambiar_estado_pedido(
    pedido_id: int, 
    estado_update: models.EstadoPedidoUpdate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_admin_user)
):
    nuevo_estado = estado_update.estado
    repartidor = estado_update.repartidor
    # Valid states include the simplified workflow: pendiente, preparando, entregado, cancelado
    # as well as legacy states: confirmado, enviado
    valid_states = ['pendiente', 'preparando', 'confirmado', 'enviado', 'entregado', 'cancelado']
    if nuevo_estado not in valid_states:
        raise HTTPException(status_code=400, detail="Estado no válido")

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM pedidos WHERE id = ?", (pedido_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

        # Update estado and optionally repartidor
        if repartidor is not None:
            cursor.execute("UPDATE pedidos SET estado = ?, repartidor = ? WHERE id = ?", (nuevo_estado, repartidor, pedido_id))
        else:
            cursor.execute("UPDATE pedidos SET estado = ? WHERE id = ?", (nuevo_estado, pedido_id))

        cursor.execute("SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por, c.nombre as cliente_nombre, p.pdf_generado, p.repartidor FROM pedidos p JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?", (pedido_id,))
        pedido_actualizado = cursor.fetchone()

    pedido = models.Pedido(id=pedido_actualizado[0], cliente_id=pedido_actualizado[1], fecha=pedido_actualizado[2], estado=pedido_actualizado[3], notas=pedido_actualizado[4], creado_por=pedido_actualizado[5], cliente_nombre=pedido_actualizado[6], pdf_generado=pedido_actualizado[7], repartidor=pedido_actualizado[8])
    
    # Broadcast estado change to all connected WebSocket clients
    background_tasks.add_task(
        broadcast_pedido_change,
        WSEventType.PEDIDO_ESTADO_CHANGED,
        {"id": pedido_id, "estado": nuevo_estado, "repartidor": repartidor},
        current_user.get("sub")
    )
    
    return pedido

@router.delete("/pedidos/{pedido_id}", status_code=204)
async def eliminar_pedido(pedido_id: int, current_user: dict = Depends(get_admin_user)):
    with db.get_db_transaction() as (conn, cursor):
        # Verificar si el pedido existe
        cursor.execute("SELECT id FROM pedidos WHERE id = ?", (pedido_id,))
        pedido = cursor.fetchone()
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

        # Eliminar items del pedido (trigger may handle this, but explicit is safer)
        cursor.execute("DELETE FROM detalles_pedido WHERE pedido_id = ?", (pedido_id,))
        
        # Eliminar el pedido
        cursor.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))

    return


class EliminarPedidosRequest(BaseModel):
    """Request body para eliminación masiva de pedidos"""
    pedido_ids: List[int] = Field(..., min_length=1, max_length=100, description="Lista de IDs de pedidos a eliminar (máximo 100)")


@router.post("/pedidos/bulk-delete", status_code=200, tags=["pedidos"], summary="Eliminar pedidos en lote", description="Elimina múltiples pedidos de forma atómica. Requiere rol admin. Máximo 100 pedidos por operación.")
@limiter.limit(RATE_LIMIT_WRITE)
async def eliminar_pedidos_bulk(
    request: Request,
    data: EliminarPedidosRequest,
    current_user: dict = Depends(get_admin_user)
):
    """Eliminar múltiples pedidos en una sola operación"""
    # Deduplicar manteniendo el orden
    pedido_ids = list(dict.fromkeys(data.pedido_ids))

    # Validación adicional
    if any((not isinstance(x, int)) or x <= 0 for x in pedido_ids):
        raise HTTPException(status_code=400, detail="IDs de pedidos inválidos")

    placeholders = ",".join(["?"] * len(pedido_ids))
    missing: List[int] = []

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute(
            f"SELECT id FROM pedidos WHERE id IN ({placeholders})",
            tuple(pedido_ids)
        )
        found_ids = {row[0] for row in cursor.fetchall()}
        missing = [pid for pid in pedido_ids if pid not in found_ids]
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"Pedidos no encontrados: {', '.join(map(str, missing))}"
            )

        # Eliminar en bloque (detalles primero)
        cursor.execute(
            f"DELETE FROM detalles_pedido WHERE pedido_id IN ({placeholders})",
            tuple(pedido_ids)
        )
        cursor.execute(
            f"DELETE FROM pedidos WHERE id IN ({placeholders})",
            tuple(pedido_ids)
        )

    # Audit log fuera de la transacción principal (no bloquear deletes si audit falla)
    try:
        for pid in pedido_ids:
            db.audit_log(
                usuario=current_user.get("username", "unknown"),
                accion="DELETE",
                tabla="pedidos",
                registro_id=pid,
                datos_antes=None,
                datos_despues=None,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent")
            )
    except Exception:
        pass

    return {
        "deleted": len(pedido_ids),
        "errors": [],
        "message": f"Se eliminaron {len(pedido_ids)} pedidos"
    }


# --- Pedido modification endpoints ---

@router.put("/pedidos/{pedido_id}/notas")
@limiter.limit(RATE_LIMIT_WRITE)
async def update_pedido_notas(
    request: Request,
    pedido_id: int,
    notas_data: NotasUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update notes for a pedido"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id, creado_por FROM pedidos WHERE id = ?", (pedido_id,))
        pedido = cursor.fetchone()
        
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        
        # Vendedor can only update their own pedidos
        if current_user["rol"] == "vendedor" and pedido[1] != current_user["username"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para editar este pedido")
        
        cursor.execute("UPDATE pedidos SET notas = ? WHERE id = ?", (notas_data.notas, pedido_id))
        
        return {"message": "Notas actualizadas"}


@router.put("/pedidos/{pedido_id}/cliente")
@limiter.limit(RATE_LIMIT_WRITE)
async def update_pedido_cliente(
    request: Request,
    pedido_id: int,
    cliente_id: int = Query(...),
    current_user: dict = Depends(get_admin_user)
):
    """Assign/change cliente for a pedido"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM pedidos WHERE id = ?", (pedido_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
        cursor.execute("UPDATE pedidos SET cliente_id = ? WHERE id = ?", (cliente_id, pedido_id))
        
        return {"message": "Cliente asignado"}


@router.put("/pedidos/{pedido_id}/items/{producto_id}")
@limiter.limit(RATE_LIMIT_WRITE)
async def update_pedido_item(
    request: Request,
    pedido_id: int,
    producto_id: int,
    item: ItemUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an item in a pedido"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id, creado_por FROM pedidos WHERE id = ?", (pedido_id,))
        pedido = cursor.fetchone()
        
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        
        if current_user["rol"] == "vendedor" and pedido[1] != current_user["username"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para editar este pedido")
        
        cursor.execute(
            "UPDATE detalles_pedido SET cantidad = ?, tipo = ? WHERE pedido_id = ? AND producto_id = ?",
            (item.cantidad, item.tipo, pedido_id, producto_id)
        )
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item no encontrado en este pedido")
        
        return {"message": "Item actualizado"}


@router.delete("/pedidos/{pedido_id}/items/{producto_id}", status_code=204)
@limiter.limit(RATE_LIMIT_WRITE)
async def delete_pedido_item(
    request: Request,
    pedido_id: int,
    producto_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove an item from a pedido"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id, creado_por FROM pedidos WHERE id = ?", (pedido_id,))
        pedido = cursor.fetchone()
        
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        
        if current_user["rol"] == "vendedor" and pedido[1] != current_user["username"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para editar este pedido")
        
        cursor.execute(
            "DELETE FROM detalles_pedido WHERE pedido_id = ? AND producto_id = ?",
            (pedido_id, producto_id)
        )
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item no encontrado en este pedido")
    
    return


@router.post("/pedidos/{pedido_id}/items")
@limiter.limit(RATE_LIMIT_WRITE)
async def add_pedido_item(
    request: Request,
    pedido_id: int,
    item: ItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add an item to a pedido"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id, creado_por FROM pedidos WHERE id = ?", (pedido_id,))
        pedido = cursor.fetchone()
        
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        
        if current_user["rol"] == "vendedor" and pedido[1] != current_user["username"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para editar este pedido")
        
        # Check if producto exists
        cursor.execute("SELECT id FROM productos WHERE id = ?", (item.producto_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        # Check if item already exists
        cursor.execute(
            "SELECT id FROM detalles_pedido WHERE pedido_id = ? AND producto_id = ?",
            (pedido_id, item.producto_id)
        )
        if cursor.fetchone():
            # Update instead of insert
            cursor.execute(
                "UPDATE detalles_pedido SET cantidad = cantidad + ?, tipo = ? WHERE pedido_id = ? AND producto_id = ?",
                (item.cantidad, item.tipo, pedido_id, item.producto_id)
            )
        else:
            cursor.execute(
                "INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (pedido_id, item.producto_id, item.cantidad, item.tipo)
            )
        
        return {"message": "Item agregado"}


@router.post("/pedidos/preview_stock")
@limiter.limit(RATE_LIMIT_READ)
async def preview_stock_impact(
    request: Request,
    data: PreviewStockRequest,
    current_user: dict = Depends(get_current_user)
):
    """Preview stock impact before generating PDFs"""
    if not data.pedido_ids:
        return {"productos": []}
    
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get total quantities needed for all selected pedidos
        placeholders = ",".join("?" * len(data.pedido_ids))
        cursor.execute(f"""
            SELECT p.id, p.nombre, p.stock, p.stock_tipo, 
                   SUM(dp.cantidad) as cantidad_total, dp.tipo
            FROM detalles_pedido dp
            JOIN productos p ON dp.producto_id = p.id
            WHERE dp.pedido_id IN ({placeholders})
            GROUP BY dp.producto_id
        """, data.pedido_ids)
        
        productos = []
        for row in cursor.fetchall():
            stock_actual = row[2] or 0
            cantidad_necesaria = row[4] or 0
            stock_despues = stock_actual - cantidad_necesaria
            
            productos.append({
                "id": row[0],
                "nombre": row[1],
                "stock_actual": stock_actual,
                "stock_tipo": row[3],
                "cantidad_necesaria": cantidad_necesaria,
                "tipo_pedido": row[5],
                "stock_despues": stock_despues,
                "insuficiente": stock_despues < 0
            })
        
        return {"productos": productos}


@router.post("/pedidos/generar_pdfs")
@limiter.limit(RATE_LIMIT_WRITE)
async def generar_pdfs(
    request: Request,
    data: GenerarPDFsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate PDFs for multiple pedidos and mark them as generated"""
    if not data.pedido_ids:
        raise HTTPException(status_code=400, detail="No se seleccionaron pedidos")
    
    try:
        from pdf_utils import generar_pdf_multiple
        
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Fetch pedidos with their items
            placeholders = ",".join("?" * len(data.pedido_ids))
            cursor.execute(f"""
                SELECT p.id, p.cliente_id, c.nombre as cliente_nombre, c.direccion, c.telefono,
                       p.fecha, p.estado, p.notas, p.creado_por
                FROM pedidos p
                JOIN clientes c ON p.cliente_id = c.id
                WHERE p.id IN ({placeholders})
                ORDER BY c.nombre
            """, data.pedido_ids)
            
            pedidos_data = []
            clientes_data = []
            clientes_seen = set()
            
            for row in cursor.fetchall():
                pedido_id = row[0]
                cliente_id = row[1]
                
                # Build clientes list
                if cliente_id not in clientes_seen:
                    clientes_seen.add(cliente_id)
                    clientes_data.append({"id": cliente_id, "nombre": row[2]})
                
                # Get items for this pedido
                cursor.execute("""
                    SELECT dp.producto_id, pr.nombre, dp.cantidad, pr.precio, dp.tipo
                    FROM detalles_pedido dp
                    JOIN productos pr ON dp.producto_id = pr.id
                    WHERE dp.pedido_id = ?
                """, (pedido_id,))
                items = cursor.fetchall()
                
                pedidos_data.append({
                    "id": pedido_id,
                    "cliente_id": cliente_id,
                    "cliente_nombre": row[2],
                    "cliente_direccion": row[3],
                    "cliente_telefono": row[4],
                    "fecha": row[5],
                    "estado": row[6],
                    "notas": row[7],
                    "creado_por": row[8],
                    "items": [{
                        "producto_id": i[0],
                        "producto_nombre": i[1],
                        "cantidad": i[2],
                        "precio": i[3],
                        "tipo": i[4]
                    } for i in items]
                })
            
            if not pedidos_data:
                raise HTTPException(status_code=404, detail="No se encontraron pedidos")
            
            # Generate PDF using generar_pdf_multiple
            fecha_generacion = datetime.now().strftime("%d/%m/%Y %H:%M")
            pdf_content = generar_pdf_multiple(pedidos_data, clientes_data, fecha_generacion)
            
            # Mark pedidos as pdf_generado = 1
            with db.get_db_transaction() as (conn2, cursor2):
                cursor2.execute(
                    f"UPDATE pedidos SET pdf_generado = 1 WHERE id IN ({placeholders})",
                    data.pedido_ids
                )
            
            return StreamingResponse(
                io.BytesIO(pdf_content),
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=pedidos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
            )
            
    except ImportError:
        # pdf_utils not available, return a simple response
        with db.get_db_transaction() as (conn, cursor):
            placeholders = ",".join("?" * len(data.pedido_ids))
            cursor.execute(
                f"UPDATE pedidos SET pdf_generado = 1 WHERE id IN ({placeholders})",
                data.pedido_ids
            )
        
        raise HTTPException(
            status_code=501, 
            detail="PDF generation not available. Pedidos marked as generated."
        )
