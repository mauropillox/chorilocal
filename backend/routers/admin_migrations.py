"""
Admin-only migration endpoint
Only accessible by admin users via API
"""
from fastapi import APIRouter, Depends, HTTPException
from deps import get_admin_user
import sqlite3
import json

router = APIRouter()

@router.post("/admin/migrate/ofertas-advanced-types")
async def migrate_ofertas_advanced_types(current_user: dict = Depends(get_admin_user)):
    """
    Migrate ofertas table to support advanced offer types
    
    Only admin users can execute this migration.
    """
    try:
        import db
        con = db.get_db_connection()
        cursor = con.cursor()
        
        # Check current structure
        cursor.execute("PRAGMA table_info(ofertas)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        
        new_columns = {
            'tipo': ("TEXT", "'porcentaje'"),
            'reglas_json': ("TEXT", "NULL"),
            'compra_cantidad': ("INTEGER", "NULL"),
            'paga_cantidad': ("INTEGER", "NULL"),
            'regalo_producto_id': ("INTEGER", "NULL"),
            'regalo_cantidad': ("INTEGER", "1")
        }
        
        added = []
        skipped = []
        errors = []
        
        for col_name, (col_type, default) in new_columns.items():
            if col_name not in existing_columns:
                try:
                    sql = f"ALTER TABLE ofertas ADD COLUMN {col_name} {col_type} DEFAULT {default}"
                    cursor.execute(sql)
                    con.commit()
                    added.append(col_name)
                except Exception as e:
                    errors.append(f"{col_name}: {str(e)}")
            else:
                skipped.append(col_name)
        
        # Verify final structure
        cursor.execute("PRAGMA table_info(ofertas)")
        final_columns = [row[1] for row in cursor.fetchall()]
        
        return {
            "success": len(errors) == 0,
            "added": added,
            "skipped": skipped,
            "errors": errors,
            "final_columns": final_columns
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

@router.get("/admin/check-ofertas-schema")
async def check_ofertas_schema(current_user: dict = Depends(get_admin_user)):
    """Check current ofertas table schema"""
    try:
        import db
        con = db.get_db_connection()
        cursor = con.cursor()
        
        cursor.execute("PRAGMA table_info(ofertas)")
        columns = [
            {"name": row[1], "type": row[2], "notnull": bool(row[3]), "default": row[4]}
            for row in cursor.fetchall()
        ]
        
        return {"columns": columns}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
