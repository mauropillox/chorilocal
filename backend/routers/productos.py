"""Productos (Products) Router"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Optional

import db
import models
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)

router = APIRouter()


@router.post("/productos", response_model=models.Producto)
@limiter.limit(RATE_LIMIT_WRITE)
async def crear_producto(request: Request, producto: models.ProductoCreate, current_user: dict = Depends(get_admin_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM productos WHERE nombre = ?", (producto.nombre,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El producto ya existe")
        
        # Validate categoria_id if provided
        if producto.categoria_id is not None:
            cursor.execute("SELECT id FROM categorias WHERE id = ?", (producto.categoria_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Categoría con ID {producto.categoria_id} no existe")
        
        cursor.execute(
            """INSERT INTO productos (nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (producto.nombre, producto.precio, producto.categoria_id, producto.imagen_url, 
             producto.stock, producto.stock_minimo, producto.stock_tipo)
        )
        producto_id = cursor.lastrowid
    return {**producto.model_dump(), "id": producto_id}


@router.get("/productos")
async def get_productos(
    current_user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Search productos by name"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Limit results"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination")
):
    """Get all productos - optimized for large datasets.
    Returns raw JSON for memory efficiency instead of Pydantic models.
    """
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        if q:
            search_term = f"%{q}%"
            if limit:
                cursor.execute(
                    """SELECT id, nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo 
                       FROM productos WHERE LOWER(nombre) LIKE LOWER(?) ORDER BY nombre LIMIT ? OFFSET ?""",
                    (search_term, limit, offset)
                )
            else:
                cursor.execute(
                    """SELECT id, nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo 
                       FROM productos WHERE LOWER(nombre) LIKE LOWER(?) ORDER BY nombre""",
                    (search_term,)
                )
        else:
            if limit:
                cursor.execute(
                    """SELECT id, nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo 
                       FROM productos ORDER BY nombre LIMIT ? OFFSET ?""",
                    (limit, offset)
                )
            else:
                cursor.execute(
                    """SELECT id, nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo 
                       FROM productos ORDER BY nombre"""
                )
        productos = cursor.fetchall()
    
    # Return raw dicts for memory efficiency - avoid Pydantic overhead for large lists
    return JSONResponse([
        {
            "id": p[0], "nombre": p[1], "precio": p[2], "categoria_id": p[3],
            "imagen_url": p[4], "stock": p[5], "stock_minimo": p[6], "stock_tipo": p[7]
        } for p in productos
    ])


@router.get("/productos/{producto_id}", response_model=models.Producto)
async def get_producto(producto_id: int, current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""SELECT id, nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo 
                         FROM productos WHERE id = ?""", (producto_id,))
        producto = cursor.fetchone()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return models.Producto(
        id=producto[0], nombre=producto[1], precio=producto[2], categoria_id=producto[3],
        imagen_url=producto[4], stock=producto[5], stock_minimo=producto[6], stock_tipo=producto[7]
    )


@router.put("/productos/{producto_id}", response_model=models.Producto)
async def actualizar_producto(producto_id: int, producto: models.ProductoCreate, current_user: dict = Depends(get_admin_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM productos WHERE id = ?", (producto_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        # Validate categoria_id if provided
        if producto.categoria_id is not None:
            cursor.execute("SELECT id FROM categorias WHERE id = ?", (producto.categoria_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Categoría con ID {producto.categoria_id} no existe")

        cursor.execute(
            """UPDATE productos SET nombre = ?, precio = ?, categoria_id = ?, imagen_url = ?, 
               stock = ?, stock_minimo = ?, stock_tipo = ? WHERE id = ?""",
            (producto.nombre, producto.precio, producto.categoria_id, producto.imagen_url,
             producto.stock, producto.stock_minimo, producto.stock_tipo, producto_id)
        )
    return {**producto.model_dump(), "id": producto_id}


@router.patch("/productos/{producto_id}/stock", response_model=models.Producto)
async def actualizar_stock(producto_id: int, stock_data: models.StockUpdate, current_user: dict = Depends(get_current_user)):
    """Update stock - supports both delta (relative) and absolute values
    
    Delta mode (recommended for concurrency):
        {"delta": -5} subtracts 5 from current stock
        {"delta": 10} adds 10 to current stock
    
    Absolute mode (legacy, still supported):
        {"stock": 95} sets stock to exactly 95
    """
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id, nombre, precio, categoria_id, imagen_url, stock, stock_minimo, stock_tipo FROM productos WHERE id = ?", (producto_id,))
        producto = cursor.fetchone()
        if producto is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        current_stock = producto[5] or 0
        
        # Handle both delta and absolute modes
        if stock_data.delta is not None:
            # Delta mode: apply relative change
            new_stock = max(0, current_stock + stock_data.delta)
        else:
            # Absolute mode: set to exact value
            new_stock = max(0, stock_data.stock)
        
        new_tipo = stock_data.stock_tipo if stock_data.stock_tipo else producto[7]  # Keep existing tipo if not provided
        
        cursor.execute(
            "UPDATE productos SET stock = ?, stock_tipo = ? WHERE id = ?",
            (new_stock, new_tipo, producto_id)
        )
    
    return {
        "id": producto_id,
        "nombre": producto[1],
        "precio": producto[2],
        "categoria_id": producto[3],
        "imagen_url": producto[4],
        "stock": new_stock,
        "stock_minimo": producto[6],
        "stock_tipo": new_tipo
    }


@router.delete("/productos/{producto_id}", status_code=204)
async def eliminar_producto(
    producto_id: int,
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    # Require explicit confirmation header for delete operations
    if request.headers.get("x-confirm-delete") != "true":
        raise HTTPException(
            status_code=400,
            detail="Delete operation requires confirmation. Set X-Confirm-Delete: true header."
        )
    
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM productos WHERE id = ?", (producto_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        # Verificar si el producto está en algún pedido
        cursor.execute("SELECT pedido_id FROM detalles_pedido WHERE producto_id = ?", (producto_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="No se puede eliminar el producto porque está asociado a pedidos")

        cursor.execute("DELETE FROM productos WHERE id = ?", (producto_id,))
    return
