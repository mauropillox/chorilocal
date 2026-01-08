"""Clientes (Customers) Router"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List

import db
import models
from deps import get_current_user, get_admin_user

router = APIRouter()


@router.post("/clientes/", response_model=models.Cliente)
async def crear_cliente(cliente: models.ClienteCreate, current_user: dict = Depends(get_current_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM clientes WHERE nombre = ?", (cliente.nombre,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El cliente ya existe")
        
        cursor.execute(
            "INSERT INTO clientes (nombre, telefono, direccion, zona) VALUES (?, ?, ?, ?)",
            (cliente.nombre, cliente.telefono, cliente.direccion, cliente.zona)
        )
        cliente_id = cursor.lastrowid
    return {**cliente.model_dump(), "id": cliente_id}


@router.get("/clientes/", response_model=List[models.Cliente])
async def get_clientes(current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, telefono, direccion, zona FROM clientes ORDER BY nombre")
        clientes = cursor.fetchall()
    return [models.Cliente(id=c[0], nombre=c[1], telefono=c[2], direccion=c[3], zona=c[4]) for c in clientes]


@router.get("/clientes/{cliente_id}", response_model=models.Cliente)
async def get_cliente(cliente_id: int, current_user: dict = Depends(get_current_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, telefono, direccion, zona FROM clientes WHERE id = ?", (cliente_id,))
        cliente = cursor.fetchone()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return models.Cliente(id=cliente[0], nombre=cliente[1], telefono=cliente[2], direccion=cliente[3], zona=cliente[4])


@router.put("/clientes/{cliente_id}", response_model=models.Cliente)
async def actualizar_cliente(cliente_id: int, cliente: models.ClienteCreate, current_user: dict = Depends(get_admin_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        cursor.execute(
            "UPDATE clientes SET nombre = ?, telefono = ?, direccion = ?, zona = ? WHERE id = ?",
            (cliente.nombre, cliente.telefono, cliente.direccion, cliente.zona, cliente_id)
        )
    return {**cliente.model_dump(), "id": cliente_id}


@router.delete("/clientes/{cliente_id}", status_code=204)
async def eliminar_cliente(cliente_id: int, current_user: dict = Depends(get_admin_user)):
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
