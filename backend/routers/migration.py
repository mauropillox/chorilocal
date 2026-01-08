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


@router.post("/bootstrap-database")
async def bootstrap_database(x_bootstrap_token: str = Header(None)):
    """
    Inicializar la base de datos PostgreSQL con schema COMPLETO y usuario admin.
    Protegido por token secreto derivado de SECRET_KEY.
    Si las tablas existen, las elimina y recrea (DANGER: pérdida de datos).
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
        
        conn = db.conectar()
        try:
            cur = conn.cursor()
            
            # Eliminar tablas existentes en orden correcto (por dependencias)
            drop_order = [
                'detalles_template', 'pedidos_template', 'precios_lista', 'listas_precios',
                'oferta_productos', 'ofertas', 'productos_tags', 'tags',
                'historial_pedidos', 'audit_log', 'revoked_tokens',
                'detalles_pedido', 'pedidos', 'productos', 'categorias', 
                'clientes', 'usuarios'
            ]
            for table in drop_order:
                cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            conn.commit()
            
            # Crear schema completo para PostgreSQL
            cur.execute("""
                -- Usuarios
                CREATE TABLE usuarios (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    rol TEXT NOT NULL DEFAULT 'vendedor',
                    nombre TEXT,
                    activo BOOLEAN DEFAULT TRUE,
                    last_login TEXT
                );
                
                -- Categorías
                CREATE TABLE categorias (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL UNIQUE,
                    descripcion TEXT,
                    color TEXT DEFAULT '#6366f1',
                    orden INTEGER DEFAULT 0,
                    activa BOOLEAN DEFAULT TRUE,
                    fecha_creacion TEXT
                );
                
                -- Listas de precios
                CREATE TABLE listas_precios (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL UNIQUE,
                    descripcion TEXT,
                    multiplicador REAL DEFAULT 1.0,
                    activa BOOLEAN DEFAULT TRUE,
                    fecha_creacion TEXT
                );
                
                -- Clientes
                CREATE TABLE clientes (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    telefono TEXT,
                    direccion TEXT,
                    zona TEXT,
                    lista_precio_id INTEGER REFERENCES listas_precios(id)
                );
                
                -- Productos
                CREATE TABLE productos (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    precio REAL NOT NULL,
                    categoria_id INTEGER REFERENCES categorias(id),
                    imagen_url TEXT,
                    stock INTEGER DEFAULT 0,
                    stock_minimo REAL DEFAULT 10,
                    stock_tipo TEXT DEFAULT 'unidad'
                );
                
                -- Precios por lista
                CREATE TABLE precios_lista (
                    id SERIAL PRIMARY KEY,
                    lista_id INTEGER NOT NULL REFERENCES listas_precios(id),
                    producto_id INTEGER NOT NULL REFERENCES productos(id),
                    precio_especial REAL NOT NULL,
                    UNIQUE(lista_id, producto_id)
                );
                
                -- Pedidos
                CREATE TABLE pedidos (
                    id SERIAL PRIMARY KEY,
                    cliente_id INTEGER REFERENCES clientes(id),
                    fecha TEXT,
                    pdf_generado INTEGER DEFAULT 0,
                    fecha_creacion TEXT,
                    fecha_generacion TEXT,
                    creado_por TEXT,
                    generado_por TEXT,
                    notas TEXT,
                    dispositivo TEXT,
                    user_agent TEXT,
                    ultimo_editor TEXT,
                    fecha_ultima_edicion TEXT,
                    estado TEXT DEFAULT 'pendiente',
                    repartidor TEXT,
                    fecha_entrega TEXT
                );
                
                -- Detalles de pedido
                CREATE TABLE detalles_pedido (
                    id SERIAL PRIMARY KEY,
                    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
                    producto_id INTEGER REFERENCES productos(id),
                    cantidad REAL,
                    tipo TEXT DEFAULT 'unidad'
                );
                
                -- Historial de pedidos
                CREATE TABLE historial_pedidos (
                    id SERIAL PRIMARY KEY,
                    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
                    accion TEXT NOT NULL,
                    usuario TEXT NOT NULL,
                    fecha TEXT NOT NULL,
                    detalles TEXT
                );
                
                -- Audit log
                CREATE TABLE audit_log (
                    id SERIAL PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    usuario TEXT NOT NULL,
                    accion TEXT NOT NULL,
                    tabla TEXT NOT NULL,
                    registro_id INTEGER,
                    datos_antes TEXT,
                    datos_despues TEXT,
                    ip_address TEXT,
                    user_agent TEXT
                );
                
                -- Tokens revocados
                CREATE TABLE revoked_tokens (
                    id SERIAL PRIMARY KEY,
                    jti TEXT NOT NULL UNIQUE,
                    revoked_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    username TEXT NOT NULL
                );
                
                -- Tags
                CREATE TABLE tags (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL UNIQUE,
                    color TEXT DEFAULT '#6366f1',
                    icono TEXT DEFAULT '🏷️',
                    tipo TEXT DEFAULT 'tipo'
                );
                
                CREATE TABLE productos_tags (
                    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (producto_id, tag_id)
                );
                
                -- Ofertas
                CREATE TABLE ofertas (
                    id SERIAL PRIMARY KEY,
                    titulo TEXT NOT NULL,
                    descripcion TEXT,
                    desde TEXT NOT NULL,
                    hasta TEXT NOT NULL,
                    activa BOOLEAN DEFAULT TRUE,
                    descuento_porcentaje REAL DEFAULT 10
                );
                
                CREATE TABLE oferta_productos (
                    oferta_id INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
                    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                    cantidad REAL DEFAULT 1,
                    PRIMARY KEY (oferta_id, producto_id)
                );
                
                -- Templates de pedidos
                CREATE TABLE pedidos_template (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    cliente_id INTEGER REFERENCES clientes(id),
                    frecuencia TEXT,
                    activo BOOLEAN DEFAULT TRUE,
                    ultima_ejecucion TEXT,
                    proxima_ejecucion TEXT,
                    creado_por TEXT,
                    fecha_creacion TEXT
                );
                
                CREATE TABLE detalles_template (
                    id SERIAL PRIMARY KEY,
                    template_id INTEGER NOT NULL REFERENCES pedidos_template(id),
                    producto_id INTEGER NOT NULL REFERENCES productos(id),
                    cantidad REAL NOT NULL,
                    tipo TEXT DEFAULT 'unidad'
                );
                
                -- Índices
                CREATE INDEX idx_usuarios_username ON usuarios(username);
                CREATE INDEX idx_usuarios_activo ON usuarios(activo);
                CREATE INDEX idx_revoked_tokens_jti ON revoked_tokens(jti);
                CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
                CREATE INDEX idx_pedidos_estado ON pedidos(estado);
                CREATE INDEX idx_pedidos_fecha ON pedidos(fecha);
                CREATE INDEX idx_productos_categoria ON productos(categoria_id);
                CREATE INDEX idx_clientes_zona ON clientes(zona);
            """)
            conn.commit()
            logger.info("bootstrap_tables_created")
            
            # Crear usuario admin
            from passlib.hash import bcrypt
            admin_hash = bcrypt.hash("admin420")
            
            cur.execute("""
                INSERT INTO usuarios (username, password_hash, rol, nombre, activo)
                VALUES (%s, %s, %s, %s, %s)
            """, ("admin", admin_hash, "admin", "Administrador", True))
            conn.commit()
        finally:
            conn.close()
        
        logger.info("bootstrap_admin_created")
        
        return JSONResponse({
            "status": "success",
            "message": "Database bootstrapped with COMPLETE schema",
            "admin_user": "admin",
            "admin_password": "admin420",
            "tables_created": 16,
            "next_steps": [
                "Login with admin/admin420",
                "The database is empty - add products and clients manually or import data"
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