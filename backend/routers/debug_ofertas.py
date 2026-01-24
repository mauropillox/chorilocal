"""
Temporary debug endpoint for ofertas issues
"""
from fastapi import APIRouter, Depends
import db
from deps import get_current_user

router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/ofertas-schema")
async def debug_ofertas_schema(current_user: dict = Depends(get_current_user)):
    """Check ofertas table schema"""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(ofertas)")
        columns = [{"name": row[1], "type": row[2], "notnull": row[3], "default": row[4]} 
                   for row in cursor.fetchall()]
        return {"columns": columns, "count": len(columns)}

@router.get("/ofertas-test-insert")
async def debug_test_insert(current_user: dict = Depends(get_current_user)):
    """Try to insert a test oferta and report exact error"""
    from datetime import datetime, timedelta
    
    desde = datetime.now()
    hasta = desde + timedelta(days=7)
    
    try:
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ofertas (titulo, desde, hasta, tipo, descuento_porcentaje, activa)
                VALUES (?, ?, ?, ?, ?, ?)
            """, ("Debug Test", desde.isoformat(), hasta.isoformat(), "porcentaje", 10.0, 1))
            conn.commit()
            return {"success": True, "id": cursor.lastrowid}
    except Exception as e:
        return {"success": False, "error": str(e), "type": type(e).__name__}
