"""Listas de Precios Router - API endpoints for price lists management"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

import db
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)
from exceptions import safe_error_handler

router = APIRouter(prefix="/listas-precios", tags=["Listas de Precios"])


class ListaPreciosCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    multiplicador: Optional[float] = 1.0


class ListaPreciosUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    multiplicador: Optional[float] = None


class PrecioEspecialCreate(BaseModel):
    producto_id: int
    precio_especial: float


def get_date_column(cur, table_name):
    """Get the correct date column name for a table (handles legacy vs new schema)"""
    cur.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cur.fetchall()]
    if 'created_at' in columns:
        return 'created_at'
    elif 'fecha_creacion' in columns:
        return 'fecha_creacion'
    return None


def ensure_tables_exist(conn):
    """Ensure listas_precios and precios_lista tables exist"""
    cur = conn.cursor()
    
    # Check if listas_precios table exists
    cur.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='listas_precios'
    """)
    if not cur.fetchone():
        cur.execute("""
            CREATE TABLE listas_precios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL UNIQUE,
                descripcion TEXT,
                multiplicador REAL DEFAULT 1.0,
                activa INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    
    # Check if precios_lista table exists
    cur.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='precios_lista'
    """)
    if not cur.fetchone():
        cur.execute("""
            CREATE TABLE precios_lista (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lista_id INTEGER NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
                producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                precio_especial REAL NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(lista_id, producto_id)
            )
        """)
        conn.commit()


@router.get("")
@limiter.limit(RATE_LIMIT_READ)
async def get_listas_precios(
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Get all price lists"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            # Get the correct date column name (handles legacy vs new schema)
            date_col = get_date_column(cur, 'listas_precios') or 'NULL'
            
            cur.execute(f"""
                SELECT id, nombre, descripcion, multiplicador, activa, {date_col}
                FROM listas_precios
                ORDER BY nombre
            """)
            
            listas = [{
                "id": row[0],
                "nombre": row[1],
                "descripcion": row[2],
                "multiplicador": row[3],
                "activa": bool(row[4]),
                "created_at": row[5]
            } for row in cur.fetchall()]
            
            return listas
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "obtener listas")


@router.get("/{lista_id}")
@limiter.limit(RATE_LIMIT_READ)
async def get_lista_precios(
    request: Request,
    lista_id: int,
    current_user: dict = Depends(get_admin_user)
):
    """Get a specific price list with its special prices"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            # Get lista info
            cur.execute("""
                SELECT id, nombre, descripcion, multiplicador, activa
                FROM listas_precios
                WHERE id = ?
            """, (lista_id,))
            row = cur.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Lista no encontrada")
            
            lista = {
                "id": row[0],
                "nombre": row[1],
                "descripcion": row[2],
                "multiplicador": row[3],
                "activa": bool(row[4])
            }
            
            # Get special prices
            cur.execute("""
                SELECT pl.producto_id, p.nombre, pl.precio_especial, p.precio as precio_base
                FROM precios_lista pl
                JOIN productos p ON p.id = pl.producto_id
                WHERE pl.lista_id = ?
                ORDER BY p.nombre
            """, (lista_id,))
            
            lista["precios_especiales"] = [{
                "producto_id": row[0],
                "producto_nombre": row[1],
                "precio_especial": row[2],
                "precio_base": row[3]
            } for row in cur.fetchall()]
            
            return lista
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "obtener lista")


@router.post("")
@limiter.limit(RATE_LIMIT_WRITE)
async def crear_lista_precios(
    request: Request,
    data: ListaPreciosCreate,
    current_user: dict = Depends(get_admin_user)
):
    """Create a new price list"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            # Check if name already exists
            cur.execute("SELECT id FROM listas_precios WHERE nombre = ?", (data.nombre,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Ya existe una lista con ese nombre")
            
            cur.execute("""
                INSERT INTO listas_precios (nombre, descripcion, multiplicador)
                VALUES (?, ?, ?)
            """, (data.nombre, data.descripcion or "", data.multiplicador or 1.0))
            conn.commit()
            
            lista_id = cur.lastrowid
            
            return {
                "id": lista_id,
                "nombre": data.nombre,
                "descripcion": data.descripcion,
                "multiplicador": data.multiplicador,
                "message": "Lista creada exitosamente"
            }
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "crear lista")


@router.put("/{lista_id}")
@limiter.limit(RATE_LIMIT_WRITE)
async def actualizar_lista_precios(
    request: Request,
    lista_id: int,
    data: ListaPreciosUpdate,
    current_user: dict = Depends(get_admin_user)
):
    """Update a price list"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            # Check if exists
            cur.execute("SELECT id FROM listas_precios WHERE id = ?", (lista_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Lista no encontrada")
            
            # Build update query
            updates = []
            values = []
            
            if data.nombre is not None:
                # Check name uniqueness
                cur.execute("SELECT id FROM listas_precios WHERE nombre = ? AND id != ?", 
                           (data.nombre, lista_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Ya existe una lista con ese nombre")
                updates.append("nombre = ?")
                values.append(data.nombre)
            
            if data.descripcion is not None:
                updates.append("descripcion = ?")
                values.append(data.descripcion)
            
            if data.multiplicador is not None:
                updates.append("multiplicador = ?")
                values.append(data.multiplicador)
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                values.append(lista_id)
                cur.execute(f"""
                    UPDATE listas_precios 
                    SET {', '.join(updates)}
                    WHERE id = ?
                """, values)
                conn.commit()
            
            return {"message": "Lista actualizada", "id": lista_id}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "actualizar lista")


@router.delete("/{lista_id}")
@limiter.limit(RATE_LIMIT_WRITE)
async def eliminar_lista_precios(
    request: Request,
    lista_id: int,
    current_user: dict = Depends(get_admin_user)
):
    """Delete a price list"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            # Check if exists
            cur.execute("SELECT id FROM listas_precios WHERE id = ?", (lista_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Lista no encontrada")
            
            # Delete special prices first
            cur.execute("DELETE FROM precios_lista WHERE lista_id = ?", (lista_id,))
            
            # Delete lista
            cur.execute("DELETE FROM listas_precios WHERE id = ?", (lista_id,))
            conn.commit()
            
            return {"message": "Lista eliminada", "id": lista_id}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "eliminar lista")


@router.post("/{lista_id}/precios")
@limiter.limit(RATE_LIMIT_WRITE)
async def agregar_precio_especial(
    request: Request,
    lista_id: int,
    data: PrecioEspecialCreate,
    current_user: dict = Depends(get_admin_user)
):
    """Add a special price to a list"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            # Check lista exists
            cur.execute("SELECT id FROM listas_precios WHERE id = ?", (lista_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Lista no encontrada")
            
            # Check producto exists
            cur.execute("SELECT id FROM productos WHERE id = ?", (data.producto_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            
            # Insert or update special price
            cur.execute("""
                INSERT INTO precios_lista (lista_id, producto_id, precio_especial)
                VALUES (?, ?, ?)
                ON CONFLICT(lista_id, producto_id) 
                DO UPDATE SET precio_especial = excluded.precio_especial
            """, (lista_id, data.producto_id, data.precio_especial))
            conn.commit()
            
            return {
                "message": "Precio especial agregado",
                "lista_id": lista_id,
                "producto_id": data.producto_id,
                "precio_especial": data.precio_especial
            }
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "agregar precio especial")


@router.delete("/{lista_id}/precios/{producto_id}")
@limiter.limit(RATE_LIMIT_WRITE)
async def eliminar_precio_especial(
    request: Request,
    lista_id: int,
    producto_id: int,
    current_user: dict = Depends(get_admin_user)
):
    """Remove a special price from a list"""
    try:
        with db.get_db_connection() as conn:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            
            cur.execute("""
                DELETE FROM precios_lista 
                WHERE lista_id = ? AND producto_id = ?
            """, (lista_id, producto_id))
            conn.commit()
            
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Precio especial no encontrado")
            
            return {"message": "Precio especial eliminado"}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error_handler(e, "listas-precios", "eliminar precio especial")
