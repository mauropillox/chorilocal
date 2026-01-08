"""
Endpoint especial para migración de producción
Solo disponible para administradores y en modo development
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
import subprocess
import os
import sys
import hashlib
from deps import get_admin_user
from logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/bootstrap-hint")
async def bootstrap_hint():
    """Temporal: muestra el token esperado completo"""
    secret_key = os.getenv("SECRET_KEY", "")
    expected_token = hashlib.sha256(f"bootstrap-{secret_key}".encode()).hexdigest()[:32]
    return {
        "token": expected_token,  # TEMPORAL - borrar después
        "secret_key_length": len(secret_key),
    }


@router.post("/bootstrap-database")
async def bootstrap_database(x_bootstrap_token: str = Header(None)):
    """
    Inicializar la base de datos PostgreSQL con schema y usuario admin.
    Protegido por token secreto derivado de SECRET_KEY.
    Solo funciona si la BD está vacía.
    """
    secret_key = os.getenv("SECRET_KEY", "")
    expected_token = hashlib.sha256(f"bootstrap-{secret_key}".encode()).hexdigest()[:32]
    
    if not x_bootstrap_token or x_bootstrap_token != expected_token:
        logger.warning("bootstrap_unauthorized_attempt")
        raise HTTPException(status_code=403, detail="Invalid bootstrap token")
    
    try:
        import db
        
        # Verificar que estamos en PostgreSQL
        if not db.is_postgres():
            raise HTTPException(status_code=400, detail="Bootstrap only available for PostgreSQL")
        
        # Crear tablas directamente para PostgreSQL
        conn = db.conectar()
        try:
            cur = conn.cursor()
            
            # Verificar si ya hay tablas
            cur.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """)
            table_count = cur.fetchone()[0]
            
            if table_count == 0:
                # Crear todas las tablas necesarias
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS clientes (
                        id SERIAL PRIMARY KEY,
                        nombre TEXT NOT NULL,
                        telefono TEXT,
                        direccion TEXT,
                        zona TEXT
                    );
                    
                    CREATE TABLE IF NOT EXISTS productos (
                        id SERIAL PRIMARY KEY,
                        nombre TEXT NOT NULL,
                        precio REAL NOT NULL
                    );
                    
                    CREATE TABLE IF NOT EXISTS categorias (
                        id SERIAL PRIMARY KEY,
                        nombre TEXT NOT NULL UNIQUE,
                        descripcion TEXT,
                        orden INTEGER DEFAULT 0,
                        activa BOOLEAN DEFAULT TRUE
                    );
                    
                    CREATE TABLE IF NOT EXISTS usuarios (
                        id SERIAL PRIMARY KEY,
                        nombre_usuario TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        rol TEXT DEFAULT 'vendedor',
                        nombre TEXT,
                        activo BOOLEAN DEFAULT TRUE
                    );
                    
                    CREATE TABLE IF NOT EXISTS pedidos (
                        id SERIAL PRIMARY KEY,
                        cliente_id INTEGER REFERENCES clientes(id),
                        fecha TEXT,
                        estado TEXT DEFAULT 'pendiente',
                        vendedor_id INTEGER REFERENCES usuarios(id),
                        notas TEXT
                    );
                    
                    CREATE TABLE IF NOT EXISTS detalles_pedido (
                        id SERIAL PRIMARY KEY,
                        pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
                        producto_id INTEGER REFERENCES productos(id),
                        cantidad INTEGER NOT NULL,
                        precio_unitario REAL
                    );
                    
                    CREATE TABLE IF NOT EXISTS revoked_tokens (
                        id SERIAL PRIMARY KEY,
                        jti TEXT NOT NULL UNIQUE,
                        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()
                logger.info("bootstrap_tables_created")
            
            # Verificar si ya hay usuarios
            cur.execute("SELECT COUNT(*) FROM usuarios")
            user_count = cur.fetchone()[0]
            
            if user_count > 0:
                return JSONResponse({
                    "status": "skipped",
                    "message": f"Database already has {user_count} users. Bootstrap not needed.",
                    "next_step": "Use /api/login to authenticate"
                })
            
            # Crear usuario admin
            from werkzeug.security import generate_password_hash
            admin_hash = generate_password_hash("admin420")
            
            cur.execute("""
                INSERT INTO usuarios (nombre_usuario, password_hash, rol, nombre, activo)
                VALUES (%s, %s, %s, %s, %s)
            """, ("admin", admin_hash, "admin", "Administrador", True))
            conn.commit()
        finally:
            conn.close()
        
        logger.info("bootstrap_admin_created")
        
        return JSONResponse({
            "status": "success",
            "message": "Database bootstrapped successfully",
            "admin_user": "admin",
            "admin_password": "admin420",
            "next_steps": [
                "Login with admin/admin420",
                "Change password immediately",
                "Run migration to import SQLite data if needed"
            ]
        })
        
    except Exception as e:
        logger.error("bootstrap_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Bootstrap failed: {str(e)}")

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
        script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrate_production.py")
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