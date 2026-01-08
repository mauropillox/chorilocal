"""Templates (Recurring Orders) Router"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

import db
import models
from deps import get_current_user, get_admin_user, limiter, RATE_LIMIT_READ, RATE_LIMIT_WRITE

router = APIRouter(prefix="/templates", tags=["Templates"])


class TemplateProducto(BaseModel):
    producto_id: int
    cantidad: float
    tipo: str = "unidad"


class TemplateCreate(BaseModel):
    nombre: str
    cliente_id: Optional[int] = None
    frecuencia: Optional[str] = None
    productos: List[TemplateProducto]


class TemplateUpdate(BaseModel):
    nombre: Optional[str] = None
    cliente_id: Optional[int] = None
    frecuencia: Optional[str] = None
    productos: Optional[List[TemplateProducto]] = None


class Template(BaseModel):
    id: int
    nombre: str
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    frecuencia: Optional[str] = None
    productos_count: int = 0
    ultima_ejecucion: Optional[str] = None
    productos: Optional[List[dict]] = None


class TemplateDetail(Template):
    productos: List[dict]


@router.get("", response_model=List[Template])
@limiter.limit(RATE_LIMIT_READ)
async def get_templates(request: Request, current_user: dict = Depends(get_current_user)):
    """Get all templates"""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if templates table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='templates'")
        if not cursor.fetchone():
            return []
        
        cursor.execute("""
            SELECT t.id, t.nombre, t.cliente_id, c.nombre as cliente_nombre, 
                   t.frecuencia, t.ultima_ejecucion
            FROM templates t
            LEFT JOIN clientes c ON t.cliente_id = c.id
            ORDER BY t.nombre
        """)
        templates = cursor.fetchall()
        
        result = []
        for t in templates:
            # Count productos for this template
            cursor.execute("SELECT COUNT(*) FROM template_productos WHERE template_id = ?", (t[0],))
            count = cursor.fetchone()[0]
            
            result.append(Template(
                id=t[0],
                nombre=t[1],
                cliente_id=t[2],
                cliente_nombre=t[3],
                frecuencia=t[4],
                ultima_ejecucion=t[5],
                productos_count=count
            ))
        
        return result


@router.get("/{template_id}", response_model=TemplateDetail)
@limiter.limit(RATE_LIMIT_READ)
async def get_template(request: Request, template_id: int, current_user: dict = Depends(get_current_user)):
    """Get template detail with productos"""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT t.id, t.nombre, t.cliente_id, c.nombre as cliente_nombre, 
                   t.frecuencia, t.ultima_ejecucion
            FROM templates t
            LEFT JOIN clientes c ON t.cliente_id = c.id
            WHERE t.id = ?
        """, (template_id,))
        t = cursor.fetchone()
        
        if not t:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        
        # Get productos
        cursor.execute("""
            SELECT tp.producto_id, p.nombre, tp.cantidad, tp.tipo
            FROM template_productos tp
            JOIN productos p ON tp.producto_id = p.id
            WHERE tp.template_id = ?
        """, (template_id,))
        productos = cursor.fetchall()
        
        return TemplateDetail(
            id=t[0],
            nombre=t[1],
            cliente_id=t[2],
            cliente_nombre=t[3],
            frecuencia=t[4],
            ultima_ejecucion=t[5],
            productos_count=len(productos),
            productos=[{
                "producto_id": p[0],
                "nombre": p[1],
                "cantidad": p[2],
                "tipo": p[3]
            } for p in productos]
        )


@router.post("", response_model=Template)
@limiter.limit(RATE_LIMIT_WRITE)
async def create_template(request: Request, template: TemplateCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new template"""
    if not template.productos:
        raise HTTPException(status_code=400, detail="Se requiere al menos un producto")
    
    with db.get_db_transaction() as (conn, cursor):
        # Check if templates table exists, create if not
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                cliente_id INTEGER REFERENCES clientes(id),
                frecuencia TEXT,
                ultima_ejecucion TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS template_productos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
                producto_id INTEGER NOT NULL REFERENCES productos(id),
                cantidad REAL NOT NULL DEFAULT 1,
                tipo TEXT DEFAULT 'unidad'
            )
        """)
        
        cursor.execute(
            "INSERT INTO templates (nombre, cliente_id, frecuencia) VALUES (?, ?, ?)",
            (template.nombre, template.cliente_id, template.frecuencia)
        )
        template_id = cursor.lastrowid
        
        for p in template.productos:
            cursor.execute(
                "INSERT INTO template_productos (template_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (template_id, p.producto_id, p.cantidad, p.tipo)
            )
        
        # Get cliente_nombre
        cliente_nombre = None
        if template.cliente_id:
            cursor.execute("SELECT nombre FROM clientes WHERE id = ?", (template.cliente_id,))
            row = cursor.fetchone()
            if row:
                cliente_nombre = row[0]
        
        return Template(
            id=template_id,
            nombre=template.nombre,
            cliente_id=template.cliente_id,
            cliente_nombre=cliente_nombre,
            frecuencia=template.frecuencia,
            productos_count=len(template.productos)
        )


@router.put("/{template_id}", response_model=Template)
@limiter.limit(RATE_LIMIT_WRITE)
async def update_template(request: Request, template_id: int, template: TemplateUpdate, current_user: dict = Depends(get_admin_user)):
    """Update a template"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM templates WHERE id = ?", (template_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Template no encontrado")
        
        # Update basic fields if provided
        if template.nombre is not None:
            cursor.execute("UPDATE templates SET nombre = ? WHERE id = ?", (template.nombre, template_id))
        if template.cliente_id is not None:
            cursor.execute("UPDATE templates SET cliente_id = ? WHERE id = ?", (template.cliente_id, template_id))
        if template.frecuencia is not None:
            cursor.execute("UPDATE templates SET frecuencia = ? WHERE id = ?", (template.frecuencia, template_id))
        
        # Update productos if provided
        if template.productos is not None:
            cursor.execute("DELETE FROM template_productos WHERE template_id = ?", (template_id,))
            for p in template.productos:
                cursor.execute(
                    "INSERT INTO template_productos (template_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                    (template_id, p.producto_id, p.cantidad, p.tipo)
                )
        
        # Fetch updated template
        cursor.execute("""
            SELECT t.id, t.nombre, t.cliente_id, c.nombre, t.frecuencia, t.ultima_ejecucion
            FROM templates t
            LEFT JOIN clientes c ON t.cliente_id = c.id
            WHERE t.id = ?
        """, (template_id,))
        t = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) FROM template_productos WHERE template_id = ?", (template_id,))
        count = cursor.fetchone()[0]
        
        return Template(
            id=t[0],
            nombre=t[1],
            cliente_id=t[2],
            cliente_nombre=t[3],
            frecuencia=t[4],
            ultima_ejecucion=t[5],
            productos_count=count
        )


@router.delete("/{template_id}", status_code=204)
@limiter.limit(RATE_LIMIT_WRITE)
async def delete_template(request: Request, template_id: int, current_user: dict = Depends(get_admin_user)):
    """Delete a template"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM templates WHERE id = ?", (template_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Template no encontrado")
        
        cursor.execute("DELETE FROM template_productos WHERE template_id = ?", (template_id,))
        cursor.execute("DELETE FROM templates WHERE id = ?", (template_id,))
    return


@router.post("/{template_id}/ejecutar")
@limiter.limit(RATE_LIMIT_WRITE)
async def ejecutar_template(request: Request, template_id: int, current_user: dict = Depends(get_current_user)):
    """Create a new pedido from a template"""
    if current_user["rol"] not in ["admin", "vendedor", "administrador", "oficina"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para crear pedidos")
    
    with db.get_db_transaction() as (conn, cursor):
        # Get template
        cursor.execute("""
            SELECT id, nombre, cliente_id FROM templates WHERE id = ?
        """, (template_id,))
        template = cursor.fetchone()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        
        if not template[2]:
            raise HTTPException(status_code=400, detail="El template no tiene cliente asignado")
        
        # Get productos
        cursor.execute("""
            SELECT producto_id, cantidad, tipo FROM template_productos WHERE template_id = ?
        """, (template_id,))
        productos = cursor.fetchall()
        
        if not productos:
            raise HTTPException(status_code=400, detail="El template no tiene productos")
        
        # Create pedido
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            "INSERT INTO pedidos (cliente_id, fecha, estado, creado_por) VALUES (?, ?, ?, ?)",
            (template[2], fecha, "pendiente", current_user["username"])
        )
        pedido_id = cursor.lastrowid
        
        # Add productos
        for p in productos:
            cursor.execute(
                "INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (pedido_id, p[0], p[1], p[2])
            )
        
        # Update template's ultima_ejecucion
        cursor.execute(
            "UPDATE templates SET ultima_ejecucion = ? WHERE id = ?",
            (fecha, template_id)
        )
        
        return {"pedido_id": pedido_id, "message": "Pedido creado desde template"}
