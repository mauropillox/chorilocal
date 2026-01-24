"""
Admin endpoint to force re-run migration 007
"""
from fastapi import APIRouter, Depends, HTTPException
import db
from deps import get_admin_user
from logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/force-migration-007")
async def force_migration_007(current_user: dict = Depends(get_admin_user)):
    """Force re-run migration 007 for ofertas (admin only)"""
    try:
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check current schema
            cursor.execute("PRAGMA table_info(ofertas)")
            existing = {row[1] for row in cursor.fetchall()}
            
            columns_needed = {
                'tipo': "ALTER TABLE ofertas ADD COLUMN tipo TEXT DEFAULT 'porcentaje'",
                'reglas_json': "ALTER TABLE ofertas ADD COLUMN reglas_json TEXT",
                'compra_cantidad': "ALTER TABLE ofertas ADD COLUMN compra_cantidad INTEGER",
                'paga_cantidad': "ALTER TABLE ofertas ADD COLUMN paga_cantidad INTEGER",
                'regalo_producto_id': "ALTER TABLE ofertas ADD COLUMN regalo_producto_id INTEGER",
                'regalo_cantidad': "ALTER TABLE ofertas ADD COLUMN regalo_cantidad INTEGER"
            }
            
            added = []
            skipped = []
            
            for col, sql in columns_needed.items():
                if col not in existing:
                    try:
                        cursor.execute(sql)
                        added.append(col)
                        logger.info(f"Added column: {col}")
                    except Exception as e:
                        logger.error(f"Failed to add {col}: {e}")
                        raise
                else:
                    skipped.append(col)
            
            conn.commit()
            
            return {
                "success": True,
                "added": added,
                "skipped": skipped,
                "total_columns": len(existing) + len(added)
            }
    
    except Exception as e:
        logger.error(f"Migration 007 force failed: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")
