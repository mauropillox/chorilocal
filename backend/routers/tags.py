"""Tags Router - Product tags management"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from pydantic import BaseModel

import db
from deps import get_current_user, get_admin_user, limiter, RATE_LIMIT_READ, RATE_LIMIT_WRITE

router = APIRouter(tags=["Tags"])


class Tag(BaseModel):
    id: int
    nombre: str


class TagCreate(BaseModel):
    nombre: str


class ProductoConTags(BaseModel):
    id: int
    nombre: str
    tags: List[str]


@router.get("/tags", response_model=List[Tag])
@limiter.limit(RATE_LIMIT_READ)
async def get_tags(request: Request, current_user: dict = Depends(get_current_user)):
    """Get all tags"""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if tags table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'")
        if not cursor.fetchone():
            # Create tags table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL UNIQUE
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS productos_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    UNIQUE(producto_id, tag_id)
                )
            """)
            conn.commit()
            return []
        
        cursor.execute("SELECT id, nombre FROM tags ORDER BY nombre")
        tags = cursor.fetchall()
        return [Tag(id=t[0], nombre=t[1]) for t in tags]


@router.post("/tags", response_model=Tag)
@limiter.limit(RATE_LIMIT_WRITE)
async def create_tag(request: Request, tag: TagCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new tag"""
    with db.get_db_transaction() as (conn, cursor):
        # Check if tags table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL UNIQUE
            )
        """)
        
        try:
            cursor.execute("INSERT INTO tags (nombre) VALUES (?)", (tag.nombre,))
            return Tag(id=cursor.lastrowid, nombre=tag.nombre)
        except Exception:
            raise HTTPException(status_code=400, detail="El tag ya existe")


@router.delete("/tags/{tag_id}", status_code=204)
@limiter.limit(RATE_LIMIT_WRITE)
async def delete_tag(request: Request, tag_id: int, current_user: dict = Depends(get_admin_user)):
    """Delete a tag"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tag no encontrado")
        
        cursor.execute("DELETE FROM productos_tags WHERE tag_id = ?", (tag_id,))
        cursor.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    return


@router.get("/productos-con-tags", response_model=List[ProductoConTags])
@limiter.limit(RATE_LIMIT_READ)
async def get_productos_con_tags(request: Request, current_user: dict = Depends(get_current_user)):
    """Get all productos with their tags"""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'")
        if not cursor.fetchone():
            return []
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='productos_tags'")
        if not cursor.fetchone():
            return []
        
        # Get all productos that have tags
        cursor.execute("""
            SELECT DISTINCT p.id, p.nombre
            FROM productos p
            JOIN productos_tags pt ON p.id = pt.producto_id
        """)
        productos = cursor.fetchall()
        
        result = []
        for prod in productos:
            cursor.execute("""
                SELECT t.nombre
                FROM tags t
                JOIN productos_tags pt ON t.id = pt.tag_id
                WHERE pt.producto_id = ?
            """, (prod[0],))
            tags = [t[0] for t in cursor.fetchall()]
            result.append(ProductoConTags(id=prod[0], nombre=prod[1], tags=tags))
        
        return result


@router.post("/productos/{producto_id}/tags/{tag_id}", status_code=201)
@limiter.limit(RATE_LIMIT_WRITE)
async def add_tag_to_producto(request: Request, producto_id: int, tag_id: int, current_user: dict = Depends(get_admin_user)):
    """Add a tag to a producto"""
    with db.get_db_transaction() as (conn, cursor):
        # Verify producto exists
        cursor.execute("SELECT id FROM productos WHERE id = ?", (producto_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        # Verify tag exists
        cursor.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tag no encontrado")
        
        # Create productos_tags table if needed
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS productos_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                UNIQUE(producto_id, tag_id)
            )
        """)
        
        try:
            cursor.execute(
                "INSERT INTO productos_tags (producto_id, tag_id) VALUES (?, ?)",
                (producto_id, tag_id)
            )
        except Exception:
            raise HTTPException(status_code=400, detail="El producto ya tiene este tag")
        
        return {"message": "Tag agregado"}


@router.delete("/productos/{producto_id}/tags/{tag_id}", status_code=204)
@limiter.limit(RATE_LIMIT_WRITE)
async def remove_tag_from_producto(request: Request, producto_id: int, tag_id: int, current_user: dict = Depends(get_admin_user)):
    """Remove a tag from a producto"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute(
            "DELETE FROM productos_tags WHERE producto_id = ? AND tag_id = ?",
            (producto_id, tag_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tag no encontrado en este producto")
    return
