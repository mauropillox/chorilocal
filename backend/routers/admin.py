"""
Admin Router - Backup Management & System Administration
=========================================================
Provides admin-only endpoints for:
- Backup creation, listing, and download
- Migration status
- System health checks
- Delete impact preview

All endpoints require admin authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from typing import List, Dict, Any
import os
import logging

import db
from deps import get_admin_user, limiter, RATE_LIMIT_ADMIN, RATE_LIMIT_WRITE, RATE_LIMIT_READ
from exceptions import safe_error_handler

logger = logging.getLogger(__name__)
from backup_scheduler import (
    create_backup_now, 
    list_backups, 
    get_backup_path,
    BACKUP_DIR,
    BACKUP_INTERVAL_HOURS,
    BACKUP_RETENTION_COUNT
)
from migrations import get_migration_status, run_pending_migrations

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============================================================================
# BACKUP ENDPOINTS
# ============================================================================

@router.post("/backup-now")
@limiter.limit(RATE_LIMIT_ADMIN)
async def trigger_backup(
    request: Request,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Trigger an immediate backup of the database.
    Returns backup info including filename, size, and checksum.
    """
    result = create_backup_now(reason=f"admin_trigger:{current_user['username']}")
    
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Could not create backup. Another backup may be in progress."
        )
    
    return {
        "success": True,
        "backup": result
    }


@router.get("/backups")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_backups(
    request: Request,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    List all available backups.
    Returns list of backups with filename, size, and creation time.
    """
    backups = list_backups()
    
    return {
        "backups": backups,
        "total_count": len(backups),
        "backup_dir": str(BACKUP_DIR),
        "retention_count": BACKUP_RETENTION_COUNT,
        "interval_hours": BACKUP_INTERVAL_HOURS
    }


@router.get("/backups/{filename}")
@limiter.limit(RATE_LIMIT_ADMIN)
async def download_backup(
    request: Request,
    filename: str,
    current_user: dict = Depends(get_admin_user)
):
    """
    Download a specific backup file.
    Includes path traversal protection.
    """
    backup_path = get_backup_path(filename)
    
    if backup_path is None:
        raise HTTPException(
            status_code=404,
            detail="Backup not found or invalid filename"
        )
    
    # Stream the file
    def iter_file():
        with open(backup_path, 'rb') as f:
            while chunk := f.read(65536):  # 64KB chunks
                yield chunk
    
    file_size = backup_path.stat().st_size
    
    return StreamingResponse(
        iter_file(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Length": str(file_size),
            "X-Backup-Filename": filename
        }
    )


@router.get("/backup-status")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_backup_status(
    request: Request,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Get backup system status including scheduler info and latest backups.
    """
    backups = list_backups()
    latest = backups[0] if backups else None
    
    return {
        "scheduler": {
            "interval_hours": BACKUP_INTERVAL_HOURS,
            "retention_count": BACKUP_RETENTION_COUNT,
            "backup_dir": str(BACKUP_DIR),
            "backup_dir_exists": BACKUP_DIR.exists(),
            "backup_dir_writable": os.access(BACKUP_DIR, os.W_OK) if BACKUP_DIR.exists() else False
        },
        "latest_backup": latest,
        "total_backups": len(backups),
        "backups_preview": backups[:5]  # Last 5 backups
    }


# ============================================================================
# MIGRATION ENDPOINTS
# ============================================================================

@router.get("/migrations")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_migrations(
    request: Request,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Get migration status - shows executed, pending, and failed migrations.
    """
    return get_migration_status()


@router.post("/migrations/run")
@limiter.limit(RATE_LIMIT_ADMIN)
async def run_migrations(
    request: Request,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Run any pending migrations.
    This is a safe operation - only runs migrations not yet executed.
    """
    try:
        executed = run_pending_migrations()
        return {
            "success": True,
            "executed": executed,
            "count": len(executed)
        }
    except Exception as e:
        raise safe_error_handler(e, "admin", "ejecutar migraciones")


# ============================================================================
# SYSTEM INFO ENDPOINTS
# ============================================================================

@router.get("/system-info")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_system_info(
    request: Request,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Get system information for debugging and monitoring.
    Does NOT expose secrets or sensitive configuration.
    """
    import db
    
    # Get database stats
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get table counts
        stats = {}
        for table in ['usuarios', 'clientes', 'productos', 'pedidos', 'categorias']:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                stats[table] = cursor.fetchone()[0]
            except Exception as e:
                logger.warning(f"Failed to count rows in {table}: {e}")
                stats[table] = "error"
        
        # Get SQLite info
        cursor.execute("PRAGMA journal_mode")
        journal_mode = cursor.fetchone()[0]
        
        cursor.execute("PRAGMA foreign_keys")
        foreign_keys = cursor.fetchone()[0]
    
    return {
        "database": {
            "type": "sqlite" if not db.USE_POSTGRES else "postgresql",
            "path": db.DB_PATH if not db.USE_POSTGRES else "[postgresql]",
            "journal_mode": journal_mode,
            "foreign_keys_enabled": bool(foreign_keys),
            "table_counts": stats
        },
        "environment": db.ENVIRONMENT,
        "backup_scheduler": {
            "interval_hours": BACKUP_INTERVAL_HOURS,
            "retention_count": BACKUP_RETENTION_COUNT
        }
    }


# ============================================================================
# DELETE IMPACT PREVIEW ENDPOINTS
# ============================================================================

@router.get("/delete-impact/producto/{producto_id}")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_producto_delete_impact(
    request: Request,
    producto_id: int,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Preview the impact of deleting a product.
    Shows how many orders reference this product.
    """
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if product exists
        cursor.execute("SELECT id, nombre FROM productos WHERE id = ?", (producto_id,))
        product = cursor.fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        # Count orders referencing this product
        cursor.execute("""
            SELECT COUNT(DISTINCT pedido_id) 
            FROM detalles_pedido 
            WHERE producto_id = ?
        """, (producto_id,))
        order_count = cursor.fetchone()[0]
        
        # Count active (non-completed) orders
        cursor.execute("""
            SELECT COUNT(DISTINCT dp.pedido_id) 
            FROM detalles_pedido dp
            JOIN pedidos p ON dp.pedido_id = p.id
            WHERE dp.producto_id = ? 
            AND p.estado NOT IN ('completado', 'entregado', 'cancelado')
        """, (producto_id,))
        active_order_count = cursor.fetchone()[0]
        
    can_delete = order_count == 0
    
    return {
        "entity": "producto",
        "id": producto_id,
        "name": product[1],
        "can_delete": can_delete,
        "impact": {
            "total_orders": order_count,
            "active_orders": active_order_count,
            "historical_orders": order_count - active_order_count
        },
        "message": "Producto puede ser eliminado" if can_delete 
                   else f"No se puede eliminar: el producto está en {order_count} pedidos ({active_order_count} activos)"
    }


@router.get("/delete-impact/cliente/{cliente_id}")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_cliente_delete_impact(
    request: Request,
    cliente_id: int,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Preview the impact of deleting a client.
    Shows how many orders belong to this client.
    """
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if client exists
        cursor.execute("SELECT id, nombre FROM clientes WHERE id = ?", (cliente_id,))
        client = cursor.fetchone()
        if not client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
        # Count orders for this client
        cursor.execute("SELECT COUNT(*) FROM pedidos WHERE cliente_id = ?", (cliente_id,))
        order_count = cursor.fetchone()[0]
        
        # Count active orders
        cursor.execute("""
            SELECT COUNT(*) FROM pedidos 
            WHERE cliente_id = ? 
            AND estado NOT IN ('completado', 'entregado', 'cancelado')
        """, (cliente_id,))
        active_order_count = cursor.fetchone()[0]
        
    can_delete = order_count == 0
    
    return {
        "entity": "cliente",
        "id": cliente_id,
        "name": client[1],
        "can_delete": can_delete,
        "impact": {
            "total_orders": order_count,
            "active_orders": active_order_count,
            "historical_orders": order_count - active_order_count
        },
        "message": "Cliente puede ser eliminado" if can_delete 
                   else f"No se puede eliminar: el cliente tiene {order_count} pedidos ({active_order_count} activos)"
    }


@router.get("/delete-impact/categoria/{categoria_id}")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_categoria_delete_impact(
    request: Request,
    categoria_id: int,
    current_user: dict = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Preview the impact of deleting a category.
    Shows how many products are in this category.
    """
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if category exists
        cursor.execute("SELECT id, nombre FROM categorias WHERE id = ?", (categoria_id,))
        category = cursor.fetchone()
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")
        
        # Count products in this category
        cursor.execute("SELECT COUNT(*) FROM productos WHERE categoria_id = ?", (categoria_id,))
        product_count = cursor.fetchone()[0]
        
    can_delete = product_count == 0
    
    return {
        "entity": "categoria",
        "id": categoria_id,
        "name": category[1],
        "can_delete": can_delete,
        "will_soft_delete": not can_delete,  # Categories with products are soft-deleted
        "impact": {
            "products": product_count
        },
        "message": "Categoría puede ser eliminada" if can_delete 
                   else f"Categoría será desactivada (tiene {product_count} productos)"
    }
