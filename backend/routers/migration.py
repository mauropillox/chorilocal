"""
Endpoint especial para migración de producción
Solo disponible para administradores y en modo development
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
import subprocess
import os
import sys
from deps import get_admin_user
from logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

@router.post("/migrate-to-postgresql")
async def migrate_to_postgresql(admin_user: dict = Depends(get_admin_user)):
    """
    Ejecutar migración de SQLite a PostgreSQL
    Solo disponible para administradores
    """
    
    # Solo permitir en development o con flag especial
    if os.getenv("ENVIRONMENT") == "production" and not os.getenv("ALLOW_MIGRATION"):
        raise HTTPException(
            status_code=403, 
            detail="Migration endpoint disabled in production. Set ALLOW_MIGRATION=true to enable."
        )
    
    try:
        logger.info("migration_start", user=admin_user["username"])
        
        # Ejecutar script de migración
        script_path = os.path.join(os.path.dirname(__file__), "migrate_production.py")
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos timeout
        )
        
        if result.returncode == 0:
            logger.info("migration_success", user=admin_user["username"])
            return JSONResponse({
                "status": "success",
                "message": "Migration completed successfully",
                "output": result.stdout,
                "next_steps": [
                    "Remove DB_PATH from environment variables",
                    "Verify application functionality", 
                    "Test all features with PostgreSQL"
                ]
            })
        else:
            logger.error("migration_failed", 
                        user=admin_user["username"], 
                        error=result.stderr)
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "Migration failed",
                    "error": result.stderr,
                    "output": result.stdout
                }
            )
            
    except subprocess.TimeoutExpired:
        logger.error("migration_timeout", user=admin_user["username"])
        raise HTTPException(
            status_code=408,
            detail="Migration timed out after 5 minutes"
        )
    except Exception as e:
        logger.error("migration_exception", 
                    user=admin_user["username"], 
                    error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Migration failed: {str(e)}"
        )

@router.get("/migration-status")
async def get_migration_status():
    """
    Verificar el estado de la base de datos
    """
    try:
        import db
        db_info = db.get_database_info()
        
        # Verificar si hay datos en PostgreSQL
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            if db.is_postgres():
                cursor.execute("SELECT COUNT(*) FROM usuarios")
            else:
                cursor.execute("SELECT COUNT(*) FROM usuarios")
            user_count = cursor.fetchone()[0]
        
        return {
            "database_type": db_info["type"],
            "environment": db_info["environment"],
            "user_count": user_count,
            "migration_needed": db_info["type"] == "sqlite" and db_info["environment"] == "production",
            "ready_for_migration": db_info["type"] == "sqlite" and user_count > 0
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "database_type": "unknown"
        }