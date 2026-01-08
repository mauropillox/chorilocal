"""Pedidos (Orders) Router"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
import datetime

import db
import models
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)

router = APIRouter()


@router.post("/pedidos", response_model=models.Pedido)
@router.post("/pedidos", response_model=models.Pedido)
@limiter.limit(RATE_LIMIT_WRITE)
async def crear_pedido(request: Request, pedido: models.PedidoCreate, current_user: dict = Depends(get_current_user)):
    if current_user["rol"] not in ["admin", "vendedor"]:
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
        raise HTTPException(status_code=500, detail=f"Error al crear el pedido: {e}")

@router.get("/pedidos", response_model=List[models.Pedido])
@router.get("/pedidos", response_model=List[models.Pedido])
async def get_pedidos(
    current_user: dict = Depends(get_current_user),
    cliente_id: Optional[int] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    estado: Optional[str] = None,
    creado_por: Optional[str] = Query(None, description="Filtrar pedidos por el nombre de usuario del creador (solo para admin y oficina)")
):
    query = "SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por, c.nombre as cliente_nombre, p.pdf_generado FROM pedidos p JOIN clientes c ON p.cliente_id = c.id"
    params = []
    conditions = []

    # For 'vendedor' role, force filter by their own username
    if current_user["rol"] == "vendedor":
        conditions.append("p.creado_por = ?")
        params.append(current_user["username"])
    # For 'admin' or 'oficina', they can filter by any user if the parameter is provided
    elif current_user["rol"] in ["admin", "oficina"] and creado_por:
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
        pedidos = cursor.fetchall()

    return [models.Pedido(id=p[0], cliente_id=p[1], fecha=p[2], estado=p[3], notas=p[4], creado_por=p[5], cliente_nombre=p[6], pdf_generado=p[7]) for p in pedidos]

@router.get("/pedidos/{pedido_id}", response_model=models.PedidoDetalle)
async def get_pedido_detalle(pedido_id: int, current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener detalles del pedido
        cursor.execute("SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por, c.nombre as cliente_nombre, p.pdf_generado FROM pedidos p JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?", (pedido_id,))
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
        "items": [models.PedidoItemDetalle(producto_id=i[0], producto_nombre=i[1], cantidad=i[2], precio_unitario=i[3]) for i in items]
    }
    
    return models.PedidoDetalle(**pedido_dict)

@router.put("/pedidos/{pedido_id}/estado", response_model=models.Pedido)
async def cambiar_estado_pedido(pedido_id: int, estado_update: models.EstadoPedidoUpdate, current_user: dict = Depends(get_admin_user)):
    nuevo_estado = estado_update.estado
    # Valid states include the simplified workflow: pendiente, preparando, entregado, cancelado
    # as well as legacy states: confirmado, enviado
    valid_states = ['pendiente', 'preparando', 'confirmado', 'enviado', 'entregado', 'cancelado']
    if nuevo_estado not in valid_states:
        raise HTTPException(status_code=400, detail="Estado no válido")

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM pedidos WHERE id = ?", (pedido_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

        cursor.execute("UPDATE pedidos SET estado = ? WHERE id = ?", (nuevo_estado, pedido_id))

        cursor.execute("SELECT p.id, p.cliente_id, p.fecha, p.estado, p.notas, p.creado_por, c.nombre as cliente_nombre, p.pdf_generado FROM pedidos p JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?", (pedido_id,))
        pedido_actualizado = cursor.fetchone()

    return models.Pedido(id=pedido_actualizado[0], cliente_id=pedido_actualizado[1], fecha=pedido_actualizado[2], estado=pedido_actualizado[3], notas=pedido_actualizado[4], creado_por=pedido_actualizado[5], cliente_nombre=pedido_actualizado[6], pdf_generado=pedido_actualizado[7])

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
