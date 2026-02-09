"""Clientes (Customers) Router"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List

import db
import models
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)

router = APIRouter()


@router.post("/clientes", response_model=models.Cliente)
@limiter.limit(RATE_LIMIT_WRITE)
async def crear_cliente(request: Request, cliente: models.ClienteCreate, current_user: dict = Depends(get_current_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM clientes WHERE nombre = ?", (cliente.nombre,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El cliente ya existe")
        
        # Validate vendedor_id exists if provided
        vendedor_nombre = None
        if cliente.vendedor_id is not None:
            cursor.execute("SELECT id, username FROM usuarios WHERE id = ?", (cliente.vendedor_id,))
            vendedor = cursor.fetchone()
            if not vendedor:
                raise HTTPException(status_code=400, detail=f"Vendedor con ID {cliente.vendedor_id} no existe")
            vendedor_nombre = vendedor[1]
        
        cursor.execute(
            "INSERT INTO clientes (nombre, telefono, direccion, zona, vendedor_id) VALUES (?, ?, ?, ?, ?)",
            (cliente.nombre, cliente.telefono, cliente.direccion, cliente.zona, cliente.vendedor_id)
        )
        cliente_id = cursor.lastrowid
    return {**cliente.model_dump(), "id": cliente_id, "vendedor_nombre": vendedor_nombre}


@router.get("/clientes", response_model=List[models.Cliente])
async def get_clientes(current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.nombre, c.telefono, c.direccion, c.zona, c.vendedor_id, u.username
            FROM clientes c
            LEFT JOIN usuarios u ON c.vendedor_id = u.id
            ORDER BY c.nombre
        """)
        clientes = cursor.fetchall()
    return [models.Cliente(
        id=c[0], nombre=c[1], telefono=c[2], direccion=c[3], zona=c[4],
        vendedor_id=c[5], vendedor_nombre=c[6]
    ) for c in clientes]


@router.get("/clientes/{cliente_id}", response_model=models.Cliente)
async def get_cliente(cliente_id: int, current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.nombre, c.telefono, c.direccion, c.zona, c.vendedor_id, u.username
            FROM clientes c
            LEFT JOIN usuarios u ON c.vendedor_id = u.id
            WHERE c.id = ?
        """, (cliente_id,))
        cliente = cursor.fetchone()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return models.Cliente(
        id=cliente[0], nombre=cliente[1], telefono=cliente[2], direccion=cliente[3], zona=cliente[4],
        vendedor_id=cliente[5], vendedor_nombre=cliente[6]
    )


@router.put("/clientes/{cliente_id}", response_model=models.Cliente)
async def actualizar_cliente(cliente_id: int, cliente: models.ClienteCreate, current_user: dict = Depends(get_admin_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        # Validate vendedor_id exists if provided
        vendedor_nombre = None
        if cliente.vendedor_id is not None:
            cursor.execute("SELECT id, username FROM usuarios WHERE id = ?", (cliente.vendedor_id,))
            vendedor = cursor.fetchone()
            if not vendedor:
                raise HTTPException(status_code=400, detail=f"Vendedor con ID {cliente.vendedor_id} no existe")
            vendedor_nombre = vendedor[1]

        cursor.execute(
            "UPDATE clientes SET nombre = ?, telefono = ?, direccion = ?, zona = ?, vendedor_id = ? WHERE id = ?",
            (cliente.nombre, cliente.telefono, cliente.direccion, cliente.zona, cliente.vendedor_id, cliente_id)
        )
    return {**cliente.model_dump(), "id": cliente_id, "vendedor_nombre": vendedor_nombre}


@router.delete("/clientes/{cliente_id}", status_code=204)
async def eliminar_cliente(
    cliente_id: int,
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
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
        # Verificar si el cliente tiene pedidos asociados
        cursor.execute("SELECT id FROM pedidos WHERE cliente_id = ?", (cliente_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="No se puede eliminar el cliente porque tiene pedidos asociados")

        cursor.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
    return
