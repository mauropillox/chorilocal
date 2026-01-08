import os
import re
import sqlite3
import logging
import base64
import gzip
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from contextlib import contextmanager

# PostgreSQL support with connection pooling
try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")
DATABASE_URL = os.getenv("DATABASE_URL", "")  # PostgreSQL connection string
USE_POSTGRES = os.getenv("USE_POSTGRES", "false").lower() == "true"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Connection pool settings
PG_POOL_MIN_CONN = int(os.getenv("PG_POOL_MIN_CONN", "2"))
PG_POOL_MAX_CONN = int(os.getenv("PG_POOL_MAX_CONN", "20"))

# Global connection pool (initialized lazily)
_pg_pool: Optional["psycopg2.pool.ThreadedConnectionPool"] = None


def _init_sqlite_from_base64():
    """
    Initialize SQLite database from base64-encoded secret file if available.
    Supports both plain base64 (.b64) and gzip-compressed base64 (.gz.b64).
    This is used in Render where we can't upload binary files directly.
    """
    # Try compressed version first (smaller)
    gz_b64_path = "/etc/secrets/ventas.db.gz.b64"
    b64_path = "/etc/secrets/ventas.db.b64"
    
    source_path = None
    is_gzipped = False
    
    if os.path.exists(gz_b64_path):
        source_path = gz_b64_path
        is_gzipped = True
    elif os.path.exists(b64_path):
        source_path = b64_path
        is_gzipped = False
    else:
        logger.info("No base64 database file found in /etc/secrets/, using default DB_PATH")
        return
    
    # Force recreate if env var is set (useful after uploading new database)
    force_recreate = os.getenv("FORCE_DB_RECREATE", "false").lower() == "true"
    if force_recreate:
        logger.info("FORCE_DB_RECREATE is set, will recreate database from base64")
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
            logger.info(f"Removed existing database at {DB_PATH}")
    
    # Check if we need to recreate
    # The secret file is the source of truth
    if os.path.exists(DB_PATH):
        try:
            # Get modification times to decide if we need to update
            secret_mtime = os.path.getmtime(source_path)
            db_mtime = os.path.getmtime(DB_PATH)
            
            if db_mtime >= secret_mtime:
                # Check if DB is valid
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.execute("SELECT COUNT(*) FROM usuarios")
                count = cursor.fetchone()[0]
                conn.close()
                if count > 0:
                    logger.info(f"SQLite database is up-to-date at {DB_PATH} ({count} users)")
                    return
        except Exception as e:
            logger.warning(f"Will recreate database from base64: {e}")
    
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        
        # Read base64 file
        with open(source_path, 'r') as f:
            b64_content = f.read().strip()
        
        # Decode base64
        compressed_or_raw = base64.b64decode(b64_content)
        
        # Decompress if gzipped
        if is_gzipped:
            db_bytes = gzip.decompress(compressed_or_raw)
            logger.info(f"Decompressed gzip data: {len(compressed_or_raw)} -> {len(db_bytes)} bytes")
        else:
            db_bytes = compressed_or_raw
        
        # Write to DB_PATH
        with open(DB_PATH, 'wb') as f:
            f.write(db_bytes)
        
        logger.info(f"Successfully decoded database from {source_path} to {DB_PATH} ({len(db_bytes)} bytes)")
    except Exception as e:
        logger.error(f"Failed to decode base64 database: {e}")
        raise


# Initialize SQLite from base64 if available (runs on module load)
if not USE_POSTGRES:
    _init_sqlite_from_base64()


def _get_pg_pool():
    """Get or create the PostgreSQL connection pool"""
    global _pg_pool
    if _pg_pool is None and POSTGRES_AVAILABLE and DATABASE_URL:
        try:
            _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                PG_POOL_MIN_CONN,
                PG_POOL_MAX_CONN,
                DATABASE_URL
            )
            logger.info(f"PostgreSQL connection pool initialized (min={PG_POOL_MIN_CONN}, max={PG_POOL_MAX_CONN})")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL connection pool: {e}")
            raise
    return _pg_pool


def validate_production_config():
    """Validate that production environment has proper configuration"""
    if ENVIRONMENT == "production":
        # Allow SQLite in production if USE_POSTGRES is false
        if USE_POSTGRES:
            if not DATABASE_URL:
                raise RuntimeError(
                    "CRITICAL: DATABASE_URL must be set when USE_POSTGRES=true"
                )
            if not POSTGRES_AVAILABLE:
                raise RuntimeError(
                    "CRITICAL: psycopg2 not installed but required for PostgreSQL"
                )
            
            # Validate database URL format
            if not DATABASE_URL.startswith(('postgresql://', 'postgres://')):
                raise RuntimeError(
                    "CRITICAL: DATABASE_URL must be a valid PostgreSQL connection string"
                )
            
            # Validate connection pool settings
            if PG_POOL_MIN_CONN < 1 or PG_POOL_MAX_CONN < PG_POOL_MIN_CONN:
                raise RuntimeError(
                    f"CRITICAL: Invalid connection pool settings - "
                    f"min={PG_POOL_MIN_CONN}, max={PG_POOL_MAX_CONN}"
                )
            
            logger.info(
                f"Production configuration validated: PostgreSQL enabled - "
                f"pool_min={PG_POOL_MIN_CONN}, pool_max={PG_POOL_MAX_CONN}"
            )
        else:
            logger.info("Production configuration: Using SQLite")

# Timezone Uruguay (UTC-3)
URUGUAY_TZ = timezone(timedelta(hours=-3))


def is_postgres() -> bool:
    """Check if we're using PostgreSQL"""
    return USE_POSTGRES and POSTGRES_AVAILABLE and DATABASE_URL


def get_database_info() -> Dict[str, Any]:
    """Return information about the current database configuration"""
    return {
        "type": "postgresql" if is_postgres() else "sqlite",
        "environment": ENVIRONMENT,
        "pool_min": PG_POOL_MIN_CONN if is_postgres() else None,
        "pool_max": PG_POOL_MAX_CONN if is_postgres() else None,
        "database_path": DATABASE_URL if is_postgres() else DB_PATH
    }


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _now_iso() -> str:
    # ISO in UTC without timezone offset to match stored expires_at format
    # Tests (and some insertions) use naive UTC isoformat(), so compare
    # using UTC naive strings to ensure proper ordering.
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def _now_uruguay() -> str:
    """Retorna timestamp en formato legible con hora Uruguay (UTC-3)"""
    now = datetime.now(URUGUAY_TZ)
    return now.strftime("%d/%m/%Y %H:%M:%S")


def _now_uruguay_iso() -> str:
    """Retorna timestamp ISO con timezone Uruguay para ordenamiento"""
    return datetime.now(URUGUAY_TZ).isoformat()


def _adapt_query(query: str) -> str:
    """Adapt SQLite query to PostgreSQL if needed"""
    if not is_postgres():
        return query
    # Replace ? placeholders with %s for psycopg2
    return query.replace('?', '%s')


def _dict_factory_pg(cursor, row):
    """Convert PostgreSQL row to dict"""
    if row is None:
        return None
    return dict(zip([col.name for col in cursor.description], row))


def conectar_postgres():
    """Connect to PostgreSQL database using connection pool"""
    pool = _get_pg_pool()
    if pool is None:
        raise RuntimeError("PostgreSQL connection pool not available")
    con = pool.getconn()
    con.autocommit = False
    return con


def release_pg_connection(con):
    """Return a PostgreSQL connection to the pool"""
    if _pg_pool is not None and con is not None:
        try:
            _pg_pool.putconn(con)
        except Exception as e:
            logger.warning(f"Error returning connection to pool: {e}")


def conectar() -> Union[sqlite3.Connection, Any]:
    """Connect to database (SQLite or PostgreSQL based on config)"""
    if is_postgres():
        return conectar_postgres()
    
    # SQLite connection
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    # Habilitar foreign keys en SQLite
    con.execute("PRAGMA foreign_keys=ON")
    # Ensure 'zona' column exists in 'clientes' (migration)
    try:
        con.execute("ALTER TABLE clientes ADD COLUMN zona TEXT")
    except Exception:
        pass  # Already exists
    return con


def _execute(cur, query: str, params: tuple = None):
    """Execute query with proper parameter adaptation"""
    adapted_query = _adapt_query(query)
    if params:
        return cur.execute(adapted_query, params)
    return cur.execute(adapted_query)


def _fetchall_as_dict(cur) -> List[Dict[str, Any]]:
    """Fetch all results as list of dicts"""
    if is_postgres():
        cols = [col.name for col in cur.description] if cur.description else []
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    return [dict(row) for row in cur.fetchall()]


def _fetchone_as_dict(cur) -> Optional[Dict[str, Any]]:
    """Fetch one result as dict"""
    row = cur.fetchone()
    if row is None:
        return None
    if is_postgres():
        cols = [col.name for col in cur.description] if cur.description else []
        return dict(zip(cols, row))
    return dict(row)


@contextmanager
def get_db_connection():
    """Context manager para conexiones de base de datos con manejo automático de errores"""
    con = conectar()
    try:
        yield con
    except Exception as e:
        if con:
            con.rollback()
        raise e
    finally:
        if con:
            if is_postgres():
                release_pg_connection(con)
            else:
                con.close()


@contextmanager
def get_db_transaction():
    """Context manager para transacciones atómicas"""
    con = conectar()
    try:
        cur = con.cursor()
        if not is_postgres():
            cur.execute("BEGIN TRANSACTION")
        yield con, cur
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        if is_postgres():
            release_pg_connection(con)
        else:
            con.close()


# Lista blanca de tablas válidas para prevenir SQL injection
VALID_TABLES = {
    'clientes', 'productos', 'pedidos', 'detalles_pedido', 'usuarios',
    'categorias', 'ofertas', 'audit_log', 'historial_pedidos', 'revoked_tokens',
    'listas_precios', 'precios_lista', 'pedidos_template', 'detalles_template',
    'oferta_productos', 'tags', 'productos_tags'
}

def _table_columns(cur, table: str) -> List[str]:
    """Get column names for a table (works with SQLite and PostgreSQL)"""
    # Validar nombre de tabla contra lista blanca
    if table not in VALID_TABLES:
        raise ValueError(f"Tabla no válida: {table}")
    
    if is_postgres():
        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = %s ORDER BY ordinal_position
        """, (table,))
        return [r[0] for r in cur.fetchall()]
    else:
        cur.execute(f"PRAGMA table_info({table})")
        return [r[1] for r in cur.fetchall()]


def _has_column(cur, table: str, col: str) -> bool:
    return col in _table_columns(cur, table)


# Regex for valid SQL identifiers (alphanumeric + underscore, no leading digit)
_SQL_IDENTIFIER_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
# Valid SQL types for column definitions
_VALID_SQL_TYPES = {'TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME', 'DATE', 'TIMESTAMP'}

def _validate_sql_identifier(value: str, context: str) -> None:
    """Validate that a string is a safe SQL identifier"""
    if not value or not _SQL_IDENTIFIER_RE.match(value):
        raise ValueError(f"Invalid SQL identifier for {context}: {value!r}")

# Safe modifiers allowed after the base type
_SAFE_TYPE_MODIFIERS = {'NOT', 'NULL', 'DEFAULT', 'PRIMARY', 'KEY', 'UNIQUE', 'REFERENCES', 'AUTOINCREMENT', 'CHECK', 'COLLATE', 'ON', 'DELETE', 'CASCADE', 'SET', 'RESTRICT', 'ACTION', 'NO'}

# Regex for valid table/column references like categorias(id)
_FK_REFERENCE_RE = re.compile(r'^[A-Z_][A-Z0-9_]*\([A-Z_][A-Z0-9_]*\)$')

def _validate_type_def(type_def: str) -> None:
    """Validate that type_def is a safe SQL type definition"""
    if not type_def:
        raise ValueError("Empty type definition")
    
    parts = type_def.upper().split()
    base_type = parts[0]
    
    if base_type not in _VALID_SQL_TYPES:
        raise ValueError(f"Invalid SQL type: {type_def!r}. Allowed: {_VALID_SQL_TYPES}")
    
    # Validate all subsequent parts are safe modifiers or safe values
    for i, part in enumerate(parts[1:], 1):
        # Allow safe modifiers
        if part in _SAFE_TYPE_MODIFIERS:
            continue
        # Allow numeric values for DEFAULT (e.g., DEFAULT 0)
        if part.replace('.', '').replace('-', '').isdigit():
            continue
        # Allow simple quoted strings (e.g., DEFAULT '')
        if part.startswith("'") and part.endswith("'") and len(part) <= 50:
            continue
        # Allow FK references like categorias(id)
        if _FK_REFERENCE_RE.match(part):
            continue
        # Disallow everything else - potential SQL injection
        raise ValueError(f"Unsafe modifier in type definition at position {i}: {part!r}")

def _ensure_column(cur, table: str, col: str, type_def: str) -> None:
    """Add column if it doesn't exist (works with SQLite and PostgreSQL)"""
    # Validate all parameters to prevent SQL injection
    _validate_sql_identifier(col, 'column')
    _validate_type_def(type_def)
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table!r}")
    
    if not _has_column(cur, table, col):
        # Adapt type definition for PostgreSQL
        adapted_type = type_def
        if is_postgres():
            # SQLite INTEGER REFERENCES -> PostgreSQL INTEGER REFERENCES
            # SQLite DEFAULT 0 -> PostgreSQL DEFAULT 0 (same)
            pass  # Most types are compatible
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {adapted_type}")


def _pk_type() -> str:
    """Return primary key type definition for current database"""
    if is_postgres():
        return "SERIAL PRIMARY KEY"
    return "INTEGER PRIMARY KEY AUTOINCREMENT"


def _bool_type() -> str:
    """Return boolean type definition for current database"""
    if is_postgres():
        return "BOOLEAN DEFAULT true"
    return "INTEGER DEFAULT 1"


def _bool_false() -> str:
    """Return boolean false type definition for current database"""
    if is_postgres():
        return "BOOLEAN DEFAULT false"
    return "INTEGER DEFAULT 0"


def ensure_schema() -> None:
    """
    Crea tablas si no existen (para instalaciones nuevas) y agrega columnas nuevas
    de forma segura (ALTER TABLE) si faltan.
    
    Para PostgreSQL: el esquema se crea durante la migración inicial.
    Esta función verifica y añade columnas faltantes.
    """
    # En PostgreSQL, las tablas ya fueron creadas por migrate_simple.py
    # Solo verificamos columnas faltantes
    if is_postgres():
        _ensure_schema_postgres()
        return
    
    _ensure_schema_sqlite()


def _ensure_schema_postgres() -> None:
    """Verificar y añadir columnas faltantes en PostgreSQL"""
    con = conectar()
    try:
        cur = con.cursor()
        tables = _get_tables(cur)
        
        if not tables:
            raise RuntimeError("PostgreSQL database is empty. Run migrate_simple.py first.")
        
        # Ensure all required columns exist (migration might have added them)
        # This is a safety check for future column additions
        
        con.commit()
    finally:
        con.close()


def _ensure_schema_sqlite() -> None:
    """Crear esquema para SQLite (desarrollo/tests)"""
    con = conectar()
    try:
        cur = con.cursor()

        # Tablas base
        cur.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT,
            direccion TEXT,
            zona TEXT
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL
        );
        """)
        
        # === CATEGORÍAS DE PRODUCTOS ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            color TEXT DEFAULT '#6366f1',
            orden INTEGER DEFAULT 0,
            activa INTEGER DEFAULT 1,
            fecha_creacion TEXT
        );
        """)
        
        # columna categoria_id para productos
        _ensure_column(cur, "productos", "categoria_id", "INTEGER REFERENCES categorias(id)")
        # columna opcional para imagen (URL) de producto
        _ensure_column(cur, "productos", "imagen_url", "TEXT")
        # columna stock para inventario
        _ensure_column(cur, "productos", "stock", "INTEGER DEFAULT 0")
        # stock mínimo para alertas
        _ensure_column(cur, "productos", "stock_minimo", "REAL DEFAULT 10")
        # tipo de stock (unidad/caja) para consistencia
        _ensure_column(cur, "productos", "stock_tipo", "TEXT DEFAULT 'unidad'")

        # pedidos: el nombre "cliente_id" es el estándar actual
        cur.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            fecha TEXT,
            pdf_generado INTEGER DEFAULT 0,
            FOREIGN KEY(cliente_id) REFERENCES clientes(id)
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS detalles_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            producto_id INTEGER,
            cantidad REAL,
            tipo TEXT DEFAULT 'unidad',
            FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY(producto_id) REFERENCES productos(id)
        );
        """)

        # usuarios: estándar actual = username + activo + last_login
        # (Si ya existe una tabla vieja con nombre_usuario, NO la renombramos acá;
        #  abajo hacemos fallback de lectura/escritura.)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL,
            activo INTEGER DEFAULT 0,
            last_login TEXT
        );
        """)

        # Columnas evolutivas (si tu DB viene de versiones anteriores)
        # pedidos
        _ensure_column(cur, "pedidos", "pdf_generado", "INTEGER DEFAULT 0")
        # Nuevas columnas de tracking
        _ensure_column(cur, "pedidos", "fecha_creacion", "TEXT")  # Timestamp creación (Uruguay)
        _ensure_column(cur, "pedidos", "fecha_generacion", "TEXT")  # Timestamp generación PDF (Uruguay)
        _ensure_column(cur, "pedidos", "creado_por", "TEXT")  # Usuario que creó el pedido
        _ensure_column(cur, "pedidos", "generado_por", "TEXT")  # Usuario que generó el PDF
        _ensure_column(cur, "pedidos", "notas", "TEXT")  # Notas opcionales del pedido
        _ensure_column(cur, "pedidos", "dispositivo", "TEXT")  # web/mobile/tablet
        _ensure_column(cur, "pedidos", "user_agent", "TEXT")  # Info del navegador
        _ensure_column(cur, "pedidos", "ultimo_editor", "TEXT")  # Último usuario que editó
        _ensure_column(cur, "pedidos", "fecha_ultima_edicion", "TEXT")  # Timestamp última edición
        
        # === ESTADOS DE PEDIDO ===
        # Estados SIMPLIFICADOS: pendiente → preparando → entregado (o cancelado)
        _ensure_column(cur, "pedidos", "estado", "TEXT DEFAULT 'pendiente'")
        _ensure_column(cur, "pedidos", "repartidor", "TEXT")  # Asignación de repartidor
        _ensure_column(cur, "pedidos", "fecha_entrega", "TEXT")  # Cuando se entregó

        # Tabla historial de modificaciones
        cur.execute("""
        CREATE TABLE IF NOT EXISTS historial_pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            accion TEXT NOT NULL,
            usuario TEXT NOT NULL,
            fecha TEXT NOT NULL,
            detalles TEXT,
            FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
        );
        """)
        
        # === AUDIT LOG GENERAL ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        """)

        # === TOKEN BLACKLIST (for logout) ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS revoked_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jti TEXT NOT NULL UNIQUE,
            revoked_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            username TEXT NOT NULL
        );
        """)
        # Create index for faster token lookup
        cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
        """)

        # === LISTAS DE PRECIOS ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS listas_precios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            multiplicador REAL DEFAULT 1.0,
            activa INTEGER DEFAULT 1,
            fecha_creacion TEXT
        );
        """)
        
        # Precios especiales por producto en cada lista
        cur.execute("""
        CREATE TABLE IF NOT EXISTS precios_lista (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lista_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            precio_especial REAL NOT NULL,
            FOREIGN KEY(lista_id) REFERENCES listas_precios(id),
            FOREIGN KEY(producto_id) REFERENCES productos(id),
            UNIQUE(lista_id, producto_id)
        );
        """)
        
        # Asignar lista de precios al cliente
        _ensure_column(cur, "clientes", "lista_precio_id", "INTEGER REFERENCES listas_precios(id)")

        # === PEDIDOS RECURRENTES (Templates) ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS pedidos_template (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            cliente_id INTEGER,
            frecuencia TEXT,
            activo INTEGER DEFAULT 1,
            ultima_ejecucion TEXT,
            proxima_ejecucion TEXT,
            creado_por TEXT,
            fecha_creacion TEXT,
            FOREIGN KEY(cliente_id) REFERENCES clientes(id)
        );
        """)
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS detalles_template (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad REAL NOT NULL,
            tipo TEXT DEFAULT 'unidad',
            FOREIGN KEY(template_id) REFERENCES pedidos_template(id),
            FOREIGN KEY(producto_id) REFERENCES productos(id)
        );
        """)

        # detalles_pedido
        _ensure_column(cur, "detalles_pedido", "tipo", "TEXT DEFAULT 'unidad'")

        # usuarios
        # Si existía ya la tabla usuarios pero sin estas columnas, las agregamos:
        if "usuarios" in _get_tables(cur):
            _ensure_column(cur, "usuarios", "activo", "INTEGER DEFAULT 1")
            _ensure_column(cur, "usuarios", "last_login", "TEXT")

        # === TAGS (Sistema multi-etiqueta para productos) ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6366f1',
            icono TEXT DEFAULT '🏷️',
            tipo TEXT DEFAULT 'tipo'
        );
        """)
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS productos_tags (
            producto_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (producto_id, tag_id),
            FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
        """)
        
        # Índices para tags
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_tags_producto ON productos_tags(producto_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_tags_tag ON productos_tags(tag_id)")

        # === OFERTAS ===
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ofertas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            desde TEXT NOT NULL,
            hasta TEXT NOT NULL,
            activa INTEGER DEFAULT 1,
            descuento_porcentaje REAL DEFAULT 10
        );
        """)
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS oferta_productos (
            oferta_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad REAL DEFAULT 1,
            PRIMARY KEY (oferta_id, producto_id),
            FOREIGN KEY (oferta_id) REFERENCES ofertas(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
        );
        """)

        con.commit()
    finally:
        con.close()


def _get_tables(cur) -> List[str]:
    """Get list of tables (works with SQLite and PostgreSQL)"""
    if is_postgres():
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        """)
    else:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1")
    return [r[0] for r in cur.fetchall()]


def _table_exists(cur, table_name: str) -> bool:
    """Check if table exists (works with SQLite and PostgreSQL)"""
    if is_postgres():
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = %s
            )
        """, (table_name,))
        return cur.fetchone()[0]
    else:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        return cur.fetchone() is not None


def ensure_indexes() -> None:
    """Create performance indexes on key columns for query optimization."""
    con = conectar()
    try:
        cur = con.cursor()
        
        # === USER/AUTH INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at)")
        
        # === PEDIDOS INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_creacion ON pedidos(fecha_creacion)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_creado_por ON pedidos(creado_por)")
        # Composite index for common query: pedidos by estado and fecha
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fecha ON pedidos(estado, fecha)")
        # Composite index for filtering by client and date
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_fecha ON pedidos(cliente_id, fecha)")
        
        # === DETALLES_PEDIDO INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_detalles_pedido_pedido_id ON detalles_pedido(pedido_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_detalles_pedido_producto_id ON detalles_pedido(producto_id)")
        # Composite for join optimization
        cur.execute("CREATE INDEX IF NOT EXISTS idx_detalles_pedido_join ON detalles_pedido(pedido_id, producto_id)")
        
        # === CLIENTES INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_clientes_zona ON clientes(zona)")
        
        # === PRODUCTOS INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_stock ON productos(stock)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id)")
        # Low stock alert query optimization
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_stock_alert ON productos(stock, stock_minimo)")
        
        # === CATEGORIAS INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_categorias_activa ON categorias(activa)")
        
        # === OFERTAS INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ofertas_activa ON ofertas(activa)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ofertas_fechas ON ofertas(desde, hasta)")
        
        # === AUDIT LOG INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON audit_log(tabla)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON audit_log(tabla, registro_id)")
        
        # === HISTORIAL PEDIDOS INDEXES ===
        cur.execute("CREATE INDEX IF NOT EXISTS idx_historial_pedido_id ON historial_pedidos(pedido_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_pedidos(fecha)")
        
        con.commit()
        logger.info("indexes_ensured", message="All database indexes created/verified")
    except Exception as e:
        logger.error("indexes_failed", error=str(e))
        raise
    finally:
        if is_postgres():
            release_pg_connection(con)
        else:
            con.close()


def ensure_cascade_triggers() -> None:
    """
    Crea triggers para simular CASCADE DELETE en SQLite.
    En PostgreSQL no son necesarios ya que tiene soporte nativo de ON DELETE CASCADE.
    """
    # PostgreSQL already has proper CASCADE support via foreign keys
    if is_postgres():
        return
        
    con = conectar()
    try:
        cur = con.cursor()
        
        # Cuando se elimina una lista de precios, eliminar sus precios especiales
        cur.execute("""
        CREATE TRIGGER IF NOT EXISTS delete_precios_lista_cascade
        BEFORE DELETE ON listas_precios
        FOR EACH ROW
        BEGIN
            DELETE FROM precios_lista WHERE lista_id = OLD.id;
        END;
        """)
        
        # Cuando se elimina un template, eliminar sus detalles
        cur.execute("""
        CREATE TRIGGER IF NOT EXISTS delete_detalles_template_cascade
        BEFORE DELETE ON pedidos_template
        FOR EACH ROW
        BEGIN
            DELETE FROM detalles_template WHERE template_id = OLD.id;
        END;
        """)
        
        # Cuando se elimina un cliente, eliminar sus pedidos y templates
        cur.execute("""
        CREATE TRIGGER IF NOT EXISTS delete_pedidos_cliente_cascade
        BEFORE DELETE ON clientes
        FOR EACH ROW
        BEGIN
            DELETE FROM pedidos WHERE cliente_id = OLD.id;
            DELETE FROM pedidos_template WHERE cliente_id = OLD.id;
        END;
        """)
        
        # Cuando se elimina un pedido, eliminar sus detalles
        cur.execute("""
        CREATE TRIGGER IF NOT EXISTS delete_detalles_pedido_cascade
        BEFORE DELETE ON pedidos
        FOR EACH ROW
        BEGIN
            DELETE FROM detalles_pedido WHERE pedido_id = OLD.id;
        END;
        """)
        
        con.commit()
    finally:
        con.close()


def verificar_tablas_y_columnas() -> None:
    """
    Se llama desde main.py al arrancar.
    Asegura esquema y verifica lo mínimo indispensable para que la app no rompa.
    """
    ensure_schema()
    ensure_cascade_triggers()

    con = conectar()
    try:
        cur = con.cursor()
        tablas = _get_tables(cur)

        requeridas = ["clientes", "productos", "pedidos", "detalles_pedido", "usuarios"]
        for t in requeridas:
            if t not in tablas:
                raise Exception(f"Tabla requerida no existe: {t}")

        # Usuarios: aceptamos username (nuevo) o nombre_usuario (viejo)
        cols_usuarios = _table_columns(cur, "usuarios")
        if ("username" not in cols_usuarios) and ("nombre_usuario" not in cols_usuarios):
            raise Exception("La tabla usuarios no tiene username ni nombre_usuario.")

        # Pedidos: aceptamos cliente_id (nuevo) o id_cliente (viejo)
        cols_pedidos = _table_columns(cur, "pedidos")
        if ("cliente_id" not in cols_pedidos) and ("id_cliente" not in cols_pedidos):
            raise Exception("La tabla pedidos no tiene cliente_id ni id_cliente.")

        # Detalles: aceptamos pedido_id/producto_id (nuevo) o id_pedido/id_producto (viejo)
        cols_det = _table_columns(cur, "detalles_pedido")
        ok_pedido = ("pedido_id" in cols_det) or ("id_pedido" in cols_det)
        ok_prod = ("producto_id" in cols_det) or ("id_producto" in cols_det)
        if not (ok_pedido and ok_prod):
            raise Exception("La tabla detalles_pedido no tiene columnas estándar de FK.")

        print("Tablas y columnas verificadas correctamente.")
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Clientes
# -----------------------------------------------------------------------------
def get_cliente_by_id(cliente_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un cliente por su ID."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            "SELECT id, nombre, telefono, direccion, zona, lista_precio_id FROM clientes WHERE id = ?",
            (cliente_id,),
        )
        row = _fetchone_as_dict(cur)
        return row


def get_clientes(page: Optional[int] = None, limit: int = 50, search: Optional[str] = None) -> Dict[str, Any]:
    """
    Obtiene clientes con paginación opcional.
    Si page es None, devuelve todos (formato lista para compatibilidad).
    Si page es número, devuelve objeto con data, total, page, pages.
    """
    with get_db_connection() as con:
        cur = con.cursor()
        
        # Construir query base
        base_query = "FROM clientes"
        params: List[Any] = []
        
        if search:
            base_query += " WHERE LOWER(nombre) LIKE ? OR LOWER(telefono) LIKE ? OR LOWER(direccion) LIKE ? OR LOWER(zona) LIKE ?"
            search_term = f"%{search.lower()}%"
            params = [search_term, search_term, search_term, search_term]
        
        # Contar total
        _execute(cur, f"SELECT COUNT(*) {base_query}", tuple(params))
        total = cur.fetchone()[0]
        
        # Si no hay paginación, devolver lista simple (compatibilidad)
        if page is None:
            _execute(cur, f"SELECT id, nombre, telefono, direccion, zona, lista_precio_id {base_query} ORDER BY nombre", tuple(params))
            return _fetchall_as_dict(cur)
        
        # Con paginación
        offset = (page - 1) * limit
        pages = (total + limit - 1) // limit if limit > 0 else 1
        
        _execute(
            cur,
            f"SELECT id, nombre, telefono, direccion, zona, lista_precio_id {base_query} ORDER BY nombre LIMIT ? OFFSET ?",
            tuple(params) + (limit, offset)
        )
        
        return {
            "data": _fetchall_as_dict(cur),
            "total": total,
            "page": page,
            "pages": pages,
            "limit": limit
        }


def add_cliente(cliente: Dict[str, Any]) -> Dict[str, Any]:
    with get_db_transaction() as (con, cur):
        # Validar duplicado por nombre (case-insensitive)
        nombre = (cliente.get("nombre") or "").strip()
        if nombre:
            _execute(
                cur,
                "SELECT id FROM clientes WHERE nombre = ? COLLATE NOCASE LIMIT 1",
                (nombre,),
            )
            if cur.fetchone():
                con.rollback()
                return {"error": "CLIENTE_DUPLICADO", "detail": f"El cliente '{nombre}' ya existe"}

        _execute(
            cur,
            "INSERT INTO clientes (nombre, telefono, direccion, zona) VALUES (?, ?, ?, ?)",
            (nombre, cliente.get("telefono", ""), cliente.get("direccion", ""), cliente.get("zona", "")),
        )
        cliente["id"] = cur.lastrowid
        cliente["nombre"] = nombre
        return cliente


def update_cliente(cliente_id: int, cliente: Dict[str, Any]) -> Dict[str, Any]:
    with get_db_transaction() as (con, cur):
        # Validar duplicado si se modifica nombre
        nombre = cliente.get("nombre")
        if nombre is not None:
            nombre = (str(nombre) or "").strip()
            _execute(
                cur,
                "SELECT id FROM clientes WHERE nombre = ? COLLATE NOCASE AND id != ? LIMIT 1",
                (nombre, cliente_id),
            )
            if cur.fetchone():
                con.rollback()
                return {"error": "CLIENTE_DUPLICADO", "detail": f"El cliente '{nombre}' ya existe"}
        else:
            # Si no se pasa nombre, hay que buscar el actual para no sobreescribirlo con None
            _execute(cur, "SELECT nombre FROM clientes WHERE id = ?", (cliente_id,))
            current_cliente = _fetchone_as_dict(cur)
            if not current_cliente:
                con.rollback()
                return {"error": "CLIENTE_NO_ENCONTRADO", "detail": f"Cliente con id {cliente_id} no existe"}
            nombre = current_cliente['nombre']

        # Obtener valores para actualizar
        telefono = cliente.get("telefono", "")
        direccion = cliente.get("direccion", "")
        lista_precio_id = cliente.get("lista_precio_id")
        
        # Validar que lista_precio_id exista si se proporciona
        if lista_precio_id is not None:
            _execute(cur, "SELECT id FROM listas_precios WHERE id = ?", (lista_precio_id,))
            if not cur.fetchone():
                con.rollback()
                return {"error": "LISTA_NO_EXISTE", "detail": f"Lista de precios {lista_precio_id} no existe"}
        
        zona = cliente.get("zona", "")
        _execute(
            cur,
            "UPDATE clientes SET nombre=?, telefono=?, direccion=?, zona=?, lista_precio_id=? WHERE id=?",
            (nombre, telefono, direccion, zona, lista_precio_id, cliente_id),
        )
        return {"status": "updated"}


def delete_cliente(cliente_id: int) -> Dict[str, Any]:
    with get_db_transaction() as (con, cur):
        _execute(cur, "DELETE FROM clientes WHERE id = ?", (cliente_id,))
        return {"status": "deleted"}


# UTF-8 BOM for Excel compatibility
CSV_BOM = "\ufeff"
# CSV delimiter - semicolon for Excel in Spanish/Latin regions
CSV_DELIMITER = ";"

def _sanitize_csv_field(value: str) -> str:
    """Sanitize a field for CSV export to prevent CSV injection"""
    value = str(value or "").replace('"', '""')
    # Prevent CSV injection - prefix with single quote if starts with dangerous char
    if value and value[0] in ('=', '+', '-', '@', '\t', '\r', '\n'):
        value = "'" + value
    return value


def export_clientes_csv() -> str:
    """Exporta todos los clientes a formato CSV (Excel compatible)"""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT id, nombre, telefono, direccion, zona FROM clientes ORDER BY nombre")
        rows = cur.fetchall()
        
        d = CSV_DELIMITER
        lines = [f"id{d}nombre{d}telefono{d}direccion{d}zona"]
        for r in rows:
            # Sanitize fields to prevent CSV injection
            nombre = _sanitize_csv_field(r["nombre"])
            telefono = _sanitize_csv_field(r["telefono"])
            direccion = _sanitize_csv_field(r["direccion"])
            zona = _sanitize_csv_field(r["zona"])
            lines.append(f'{r["id"]}{d}"{nombre}"{d}"{telefono}"{d}"{direccion}"{d}"{zona}"')
        
        # Add BOM for Excel UTF-8 compatibility
        return CSV_BOM + "\n".join(lines)


# -----------------------------------------------------------------------------
# Categorías
# -----------------------------------------------------------------------------
def get_categorias(incluir_inactivas: bool = False) -> List[Dict[str, Any]]:
    """Obtiene todas las categorías ordenadas."""
    with get_db_connection() as con:
        cur = con.cursor()
        query = "SELECT id, nombre, descripcion, color, orden, activa, fecha_creacion FROM categorias"
        if not incluir_inactivas:
            query += " WHERE activa = 1"
        query += " ORDER BY orden, nombre"
        _execute(cur, query)
        return _fetchall_as_dict(cur)


def get_categoria_by_id(categoria_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una categoría por su ID."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            "SELECT id, nombre, descripcion, color, orden, activa, fecha_creacion FROM categorias WHERE id = ?",
            (categoria_id,)
        )
        return _fetchone_as_dict(cur)


def add_categoria(categoria: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva categoría."""
    with get_db_transaction() as (con, cur):
        nombre = (categoria.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre es requerido"}
        
        # Verificar duplicados
        _execute(cur, "SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?)", (nombre,))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe una categoría con el nombre '{nombre}'"}
        
        descripcion = categoria.get("descripcion", "")
        color = categoria.get("color", "#6366f1")
        orden = categoria.get("orden", 0)
        
        _execute(
            cur,
            "INSERT INTO categorias (nombre, descripcion, color, orden, activa, fecha_creacion) VALUES (?, ?, ?, ?, 1, ?)",
            (nombre, descripcion, color, orden, _now_uruguay_iso())
        )
        return {"id": cur.lastrowid, "nombre": nombre, "descripcion": descripcion, "color": color, "orden": orden}


def update_categoria(categoria_id: int, categoria: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza una categoría existente."""
    with get_db_transaction() as (con, cur):
        nombre = (categoria.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre es requerido"}
        
        # Verificar que existe
        _execute(cur, "SELECT id FROM categorias WHERE id = ?", (categoria_id,))
        if not cur.fetchone():
            con.rollback()
            return {"error": "Categoría no encontrada"}
        
        # Verificar duplicados (excluyendo esta)
        _execute(cur, "SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND id != ?", (nombre, categoria_id))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe otra categoría con el nombre '{nombre}'"}
        
        descripcion = categoria.get("descripcion", "")
        color = categoria.get("color", "#6366f1")
        orden = categoria.get("orden", 0)
        activa = 1 if categoria.get("activa", True) else 0
        
        _execute(
            cur,
            "UPDATE categorias SET nombre = ?, descripcion = ?, color = ?, orden = ?, activa = ? WHERE id = ?",
            (nombre, descripcion, color, orden, activa, categoria_id)
        )
        return {"id": categoria_id, "nombre": nombre, "descripcion": descripcion, "color": color, "orden": orden, "activa": bool(activa)}


def delete_categoria(categoria_id: int) -> Dict[str, Any]:
    """Elimina una categoría (o desactiva si tiene productos)."""
    with get_db_transaction() as (con, cur):
        # Verificar si tiene productos asociados
        _execute(cur, "SELECT COUNT(*) FROM productos WHERE categoria_id = ?", (categoria_id,))
        count = cur.fetchone()[0]
        
        if count > 0:
            # Solo desactivar, no eliminar
            _execute(cur, "UPDATE categorias SET activa = 0 WHERE id = ?", (categoria_id,))
            return {"status": "deactivated", "message": f"Categoría desactivada (tiene {count} productos)"}
        else:
            _execute(cur, "DELETE FROM categorias WHERE id = ?", (categoria_id,))
            return {"status": "deleted", "message": "Categoría eliminada"}


def get_productos_por_categoria(categoria_id: int) -> List[Dict[str, Any]]:
    """Obtiene productos de una categoría específica."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            "SELECT id, nombre, precio, stock, imagen_url FROM productos WHERE categoria_id = ? ORDER BY nombre",
            (categoria_id,)
        )
        return _fetchall_as_dict(cur)


def asignar_categoria_producto(producto_id: int, categoria_id: Optional[int]) -> Dict[str, Any]:
    """Asigna o quita una categoría a un producto."""
    with get_db_transaction() as (con, cur):
        _execute(cur, "UPDATE productos SET categoria_id = ? WHERE id = ?", (categoria_id, producto_id))
        return {"status": "ok", "producto_id": producto_id, "categoria_id": categoria_id}


# -----------------------------------------------------------------------------
# Audit Log
# -----------------------------------------------------------------------------
def audit_log(
    usuario: str,
    accion: str,
    tabla: str,
    registro_id: Optional[int] = None,
    datos_antes: Optional[Dict] = None,
    datos_despues: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> None:
    """Registra una acción en el audit log."""
    import json
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            """INSERT INTO audit_log 
               (timestamp, usuario, accion, tabla, registro_id, datos_antes, datos_despues, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                _now_uruguay_iso(),
                usuario,
                accion,
                tabla,
                registro_id,
                json.dumps(datos_antes, ensure_ascii=False) if datos_antes else None,
                json.dumps(datos_despues, ensure_ascii=False) if datos_despues else None,
                ip_address,
                user_agent
            )
        )


def get_audit_logs(
    tabla: Optional[str] = None,
    usuario: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Obtiene registros del audit log con filtros."""
    import json
    with get_db_connection() as con:
        cur = con.cursor()
        
        query = "SELECT id, timestamp, usuario, accion, tabla, registro_id, datos_antes, datos_despues, ip_address FROM audit_log"
        count_query = "SELECT COUNT(*) FROM audit_log"
        conditions = []
        params: List[Any] = []
        
        if tabla:
            conditions.append("tabla = ?")
            params.append(tabla)
        if usuario:
            conditions.append("usuario = ?")
            params.append(usuario)
        if fecha_inicio:
            conditions.append("timestamp >= ?")
            params.append(fecha_inicio)
        if fecha_fin:
            conditions.append("timestamp <= ?")
            params.append(fecha_fin)
        
        if conditions:
            where = " WHERE " + " AND ".join(conditions)
            query += where
            count_query += where
        
        # Count total
        _execute(cur, count_query, tuple(params))
        total = cur.fetchone()[0]
        
        # Get data
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        _execute(cur, query, tuple(params))
        
        rows = _fetchall_as_dict(cur)
        for log in rows:
            # Parse JSON fields
            if log.get("datos_antes"):
                try:
                    log["datos_antes"] = json.loads(log["datos_antes"])
                except (json.JSONDecodeError, TypeError):
                    pass
            if log.get("datos_despues"):
                try:
                    log["datos_despues"] = json.loads(log["datos_despues"])
                except (json.JSONDecodeError, TypeError):
                    pass
        
        return {
            "data": rows,
            "total": total,
            "limit": limit,
            "offset": offset
        }


def get_audit_summary() -> Dict[str, Any]:
    """Resumen de actividad del audit log."""
    with get_db_connection() as con:
        cur = con.cursor()
        
        # Total de acciones hoy
        _execute(
            cur,
            "SELECT COUNT(*) FROM audit_log WHERE DATE(timestamp) = DATE('now')"
        )
        hoy = cur.fetchone()[0]
        
        # Por tabla
        _execute(
            cur,
            "SELECT tabla, COUNT(*) as count FROM audit_log GROUP BY tabla ORDER BY count DESC LIMIT 10"
        )
        por_tabla = _fetchall_as_dict(cur)
        
        # Por usuario (últimos 7 días)
        _execute(
            cur,
            """SELECT usuario, COUNT(*) as count FROM audit_log 
               WHERE timestamp >= datetime('now', '-7 days')
               GROUP BY usuario ORDER BY count DESC LIMIT 10"""
        )
        por_usuario = _fetchall_as_dict(cur)
        
        # Últimas 10 acciones
        _execute(
            cur,
            "SELECT timestamp, usuario, accion, tabla FROM audit_log ORDER BY timestamp DESC LIMIT 10"
        )
        ultimas = _fetchall_as_dict(cur)
        
        return {
            "acciones_hoy": hoy,
            "por_tabla": por_tabla,
            "por_usuario": por_usuario,
            "ultimas_acciones": ultimas
        }


# -----------------------------------------------------------------------------
# Productos
# -----------------------------------------------------------------------------
def get_productos(search: Optional[str] = None, sort: Optional[str] = None, categoria_id: Optional[int] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as con:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")
        sel = ["id", "nombre", "precio"]
        if "imagen_url" in cols:
            sel.append("imagen_url")
        if "stock" in cols:
            sel.append("stock")
        if "categoria_id" in cols:
            sel.append("categoria_id")

        base = f"SELECT {', '.join(sel)} FROM productos"
        conditions: List[str] = []
        params: List[Any] = []
        
        if search:
            conditions.append("LOWER(nombre) LIKE ?")
            params.append(f"%{search.lower()}%")
        
        if categoria_id is not None:
            conditions.append("categoria_id = ?")
            params.append(categoria_id)
        
        if conditions:
            base += " WHERE " + " AND ".join(conditions)

        order = " ORDER BY nombre"
        if sort:
            if sort == 'nombre_asc':
                order = " ORDER BY nombre ASC"
            elif sort == 'nombre_desc':
                order = " ORDER BY nombre DESC"
            elif sort == 'precio_asc':
                order = " ORDER BY precio ASC"
            elif sort == 'precio_desc':
                order = " ORDER BY precio DESC"

        _execute(cur, base + order, tuple(params))
        return _fetchall_as_dict(cur)


def get_producto_by_id(producto_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un producto por su ID"""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT * FROM productos WHERE id = ?", (producto_id,))
        return _fetchone_as_dict(cur)


def add_producto(producto: Dict[str, Any]) -> Dict[str, Any]:
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "productos")

        fields = ["nombre", "precio"]
        nombre = (producto.get("nombre") or "").strip()
        
        try:
            precio = float(producto.get("precio"))
        except (ValueError, TypeError):
            con.rollback()
            return {"error": "PRECIO_INVALIDO", "detail": "El precio debe ser un número."}


        # Validar duplicado por nombre (case-insensitive)
        if nombre:
            _execute(
                cur,
                "SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE LIMIT 1",
                (nombre,),
            )
            if cur.fetchone():
                con.rollback()
                return {"error": "PRODUCTO_DUPLICADO", "detail": f"El producto '{nombre}' ya existe"}

        values = [nombre, precio]

        if "imagen_url" in cols and producto.get("imagen_url") is not None:
            fields.append("imagen_url")
            values.append(producto.get("imagen_url"))
        
        if "stock" in cols:
            fields.append("stock")
            values.append(float(producto.get("stock", 0)))
        
        if "stock_minimo" in cols:
            fields.append("stock_minimo")
            values.append(float(producto.get("stock_minimo", 10)))
        
        if "stock_tipo" in cols:
            fields.append("stock_tipo")
            values.append(producto.get("stock_tipo", "unidad"))
        
        # categoria_id es opcional
        if "categoria_id" in cols and producto.get("categoria_id") is not None:
            fields.append("categoria_id")
            values.append(int(producto.get("categoria_id")))

        _execute(
            cur,
            f"INSERT INTO productos ({', '.join(fields)}) VALUES ({', '.join(['?'] * len(fields))})",
            tuple(values),
        )
        producto["id"] = cur.lastrowid
        producto["nombre"] = nombre
        producto["precio"] = precio
        return producto

# Helpers de existencia
def cliente_existe(nombre: str) -> bool:
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT id FROM clientes WHERE nombre = ? COLLATE NOCASE LIMIT 1", (nombre.strip(),))
        return cur.fetchone() is not None

def producto_existe(nombre: str) -> bool:
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE LIMIT 1", (nombre.strip(),))
        return cur.fetchone() is not None


def update_producto(producto_id: int, producto: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza fields permitidos de un producto (nombre, precio, imagen_url) si existen."""
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "productos")

        fields = []
        values: List[Any] = []

        if "nombre" in producto and producto.get("nombre") is not None and "nombre" in cols:
            nombre = (str(producto.get("nombre")) or "").strip()
            # Validar duplicado con otro id
            _execute(
                cur,
                "SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE AND id != ? LIMIT 1",
                (nombre, producto_id),
            )
            if cur.fetchone():
                con.rollback()
                return {"error": "PRODUCTO_DUPLICADO", "detail": f"El producto '{nombre}' ya existe"}
            fields.append("nombre = ?")
            values.append(nombre)
        if "precio" in producto and producto.get("precio") is not None and "precio" in cols:
            fields.append("precio = ?")
            values.append(float(producto.get("precio")))
        if "imagen_url" in producto and "imagen_url" in cols:
            fields.append("imagen_url = ?")
            values.append(producto.get("imagen_url"))
        
        if "stock" in producto and "stock" in cols:
            fields.append("stock = ?")
            values.append(float(producto.get("stock", 0)))
        
        if "stock_minimo" in producto and "stock_minimo" in cols:
            fields.append("stock_minimo = ?")
            values.append(float(producto.get("stock_minimo", 10)))
        
        if "stock_tipo" in producto and "stock_tipo" in cols:
            fields.append("stock_tipo = ?")
            values.append(producto.get("stock_tipo", "unidad"))
        
        # categoria_id es opcional - permitir NULL explícito
        if "categoria_id" in producto and "categoria_id" in cols:
            cat_id = producto.get("categoria_id")
            fields.append("categoria_id = ?")
            values.append(int(cat_id) if cat_id is not None else None)

        if not fields:
            return {"status": "no_changes"}

        values.append(producto_id)
        _execute(cur, f"UPDATE productos SET {', '.join(fields)} WHERE id = ?", tuple(values))

        # return updated row
        sel = ["id", "nombre", "precio"]
        if "imagen_url" in cols:
            sel.append("imagen_url")
        if "stock" in cols:
            sel.append("stock")
        if "stock_minimo" in cols:
            sel.append("stock_minimo")
        if "stock_tipo" in cols:
            sel.append("stock_tipo")
        if "categoria_id" in cols:
            sel.append("categoria_id")
        _execute(cur, f"SELECT {', '.join(sel)} FROM productos WHERE id = ?", (producto_id,))
        row = _fetchone_as_dict(cur)
        return row if row else {"status": "not_found"}


def delete_producto(producto_id: int) -> Dict[str, Any]:
    """Elimina un producto si no tiene pedidos asociados"""
    with get_db_transaction() as (con, cur):
        # Verificar si el producto existe
        _execute(cur, "SELECT id, nombre FROM productos WHERE id = ?", (producto_id,))
        producto = _fetchone_as_dict(cur)
        if not producto:
            con.rollback()
            return {"status": "not_found", "message": "Producto no encontrado"}
        
        # Verificar si tiene pedidos asociados
        _execute(cur, "SELECT COUNT(*) FROM detalles_pedido WHERE producto_id = ?", (producto_id,))
        pedidos_count = cur.fetchone()[0]
        if pedidos_count > 0:
            con.rollback()
            return {"status": "error", "message": f"No se puede eliminar el producto porque tiene {pedidos_count} pedido(s) asociado(s)"}
        
        # Eliminar de tablas relacionadas (usando nombres correctos de tablas)
        _execute(cur, "DELETE FROM oferta_productos WHERE producto_id = ?", (producto_id,))
        _execute(cur, "DELETE FROM precios_lista WHERE producto_id = ?", (producto_id,))
        _execute(cur, "DELETE FROM detalles_template WHERE producto_id = ?", (producto_id,))
        
        # Eliminar el producto
        _execute(cur, "DELETE FROM productos WHERE id = ?", (producto_id,))
        
        return {"status": "ok", "message": f"Producto '{producto['nombre']}' eliminado correctamente"}


def export_productos_csv() -> str:
    """Exporta todos los productos a formato CSV (Excel compatible)"""
    with get_db_connection() as con:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")
        has_stock = "stock" in cols
        has_categoria = "categoria_id" in cols
        
        select_cols = "p.id, p.nombre, p.precio, p.imagen_url"
        if has_stock:
            select_cols += ", p.stock"
        if has_categoria:
            select_cols += ", c.nombre as categoria_nombre"
        
        query = f"SELECT {select_cols} FROM productos p"
        if has_categoria:
            query += " LEFT JOIN categorias c ON p.categoria_id = c.id"
        query += " ORDER BY p.nombre"
        
        _execute(cur, query)
        rows = _fetchall_as_dict(cur)
        
        d = CSV_DELIMITER
        header = f"id{d}nombre{d}precio{d}imagen_url"
        if has_stock:
            header += f"{d}stock"
        if has_categoria:
            header += f"{d}categoria"
        lines = [header]
        
        for r in rows:
            nombre = _sanitize_csv_field(r["nombre"])
            precio = r["precio"] or 0
            imagen = _sanitize_csv_field(r["imagen_url"])
            line = f'{r["id"]}{d}"{nombre}"{d}{precio}{d}"{imagen}"'
            if has_stock:
                stock = r["stock"] if r["stock"] is not None else 0
                line += f'{d}{stock}'
            if has_categoria:
                categoria = _sanitize_csv_field(r["categoria_nombre"])
                line += f'{d}"{categoria}"'
            lines.append(line)
        
        return CSV_BOM + "\n".join(lines)


def update_stock(producto_id: int, cantidad: float, operacion: str = "restar") -> Dict[str, Any]:
    """Actualiza el stock de un producto. operacion: 'sumar' o 'restar'"""
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "productos")
        if "stock" not in cols:
            con.rollback()
            return {"error": "Stock no soportado"}
        
        # Obtener stock actual
        _execute(cur, "SELECT stock FROM productos WHERE id = ?", (producto_id,))
        row = _fetchone_as_dict(cur)
        if not row:
            con.rollback()
            return {"error": "Producto no encontrado"}
        
        stock_actual = row["stock"] or 0
        
        if operacion == "restar":
            nuevo_stock = max(0, stock_actual - cantidad)
        else:
            nuevo_stock = stock_actual + cantidad
        
        _execute(cur, "UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))
        return {"id": producto_id, "stock_anterior": stock_actual, "stock_nuevo": nuevo_stock}


def batch_update_stock_atomic(productos: List[Dict[str, Any]], operacion: str = "restar") -> Dict[str, Any]:
    """
    Actualiza el stock de múltiples productos de forma atómica (transaccional).
    Si alguno falla, se hace rollback de todos los cambios.
    
    Args:
        productos: Lista de dicts con 'id' y 'cantidad'
        operacion: 'sumar' o 'restar'
    
    Returns:
        Dict con 'ok': True si todo bien, o 'error' si hay problema
    """
    if not productos:
        return {"ok": True, "updated": []}
    
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "productos")
        if "stock" not in cols:
            con.rollback()
            return {"error": "Stock no soportado en esta versión de la base de datos"}
        
        updated = []
        
        for p in productos:
            producto_id = p.get("id")
            cantidad = p.get("cantidad", 0)
            
            if not producto_id or cantidad <= 0:
                continue
            
            # Obtener stock actual
            _execute(cur, "SELECT id, nombre, stock FROM productos WHERE id = ?", (producto_id,))
            row = _fetchone_as_dict(cur)
            
            if not row:
                con.rollback()
                return {"error": f"Producto ID {producto_id} no encontrado"}
            
            stock_actual = row["stock"] or 0
            
            if operacion == "restar":
                nuevo_stock = max(0, stock_actual - cantidad)
            else:
                nuevo_stock = stock_actual + cantidad
            
            _execute(cur, "UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))
            
            updated.append({
                "id": producto_id,
                "nombre": row["nombre"],
                "stock_anterior": stock_actual,
                "stock_nuevo": nuevo_stock,
                "cantidad": cantidad
            })
        
        return {"ok": True, "updated": updated, "count": len(updated)}


def verificar_stock_pedido(productos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Verifica si hay stock suficiente para los productos del pedido"""
    with get_db_connection() as con:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")
        if "stock" not in cols:
            return []  # Sin control de stock
        
        errores = []
        for p in productos:
            producto_id = p.get("id")
            cantidad = p.get("cantidad", 1)
            
            _execute(cur, "SELECT nombre, stock FROM productos WHERE id = ?", (producto_id,))
            row = _fetchone_as_dict(cur)
            if row:
                stock = row["stock"] or 0
                if stock < cantidad:
                    errores.append({
                        "producto_id": producto_id,
                        "nombre": row["nombre"],
                        "stock_disponible": stock,
                        "cantidad_pedida": cantidad
                    })
        
        return errores


# -----------------------------------------------------------------------------
# Pedidos
# -----------------------------------------------------------------------------
def _pedidos_cliente_col(cur: Union[sqlite3.Cursor, Any]) -> str:
    cols = _table_columns(cur, "pedidos")
    return "cliente_id" if "cliente_id" in cols else "id_cliente"


def _detalles_pedido_col(cur: Union[sqlite3.Cursor, Any]) -> str:
    cols = _table_columns(cur, "detalles_pedido")
    return "pedido_id" if "pedido_id" in cols else "id_pedido"


def _detalles_producto_col(cur: Union[sqlite3.Cursor, Any]) -> str:
    cols = _table_columns(cur, "detalles_pedido")
    return "producto_id" if "producto_id" in cols else "id_producto"


def add_pedido(pedido: Dict[str, Any], creado_por: str = None, dispositivo: str = None, user_agent: str = None) -> Dict[str, Any]:
    """
    Crea un pedido con transacción atómica.
    Espera el shape que manda tu main.py:
      pedido = {
        "cliente": {"id": ...},
        "productos": [{"id":.., "cantidad":.., "tipo":..}, ...],
        "pdf_generado": false,
        ...
      }
    creado_por: username del usuario que crea el pedido
    dispositivo: web/mobile/tablet
    user_agent: info del navegador
    
    Usa transacción atómica: si falla cualquier paso, todo se revierte.
    """
    with get_db_transaction() as (con, cur):

        cliente_id = pedido.get("cliente_id")
        if cliente_id is None:
            cliente = pedido.get("cliente") or {}
            cliente_id = cliente.get("id")

        if cliente_id is None:
            raise ValueError("Pedido inválido: falta cliente_id / cliente.id")

        cliente_col = _pedidos_cliente_col(cur)
        cols_pedidos = _table_columns(cur, "pedidos")

        fecha = pedido.get("fecha") or _now_iso()
        pdf_generado = 1 if bool(pedido.get("pdf_generado", False)) else 0
        fecha_creacion = _now_uruguay()  # Timestamp Uruguay legible
        notas = pedido.get("notas") or ""

        # Insert dinámico según columnas existentes
        fields: List[str] = [cliente_col]
        values: List[Any] = [cliente_id]

        if "fecha" in cols_pedidos:
            fields.append("fecha")
            values.append(fecha)
        if "pdf_generado" in cols_pedidos:
            fields.append("pdf_generado")
            values.append(pdf_generado)
        if "fecha_creacion" in cols_pedidos:
            fields.append("fecha_creacion")
            values.append(fecha_creacion)
        if "creado_por" in cols_pedidos and creado_por:
            fields.append("creado_por")
            values.append(creado_por)
        if "notas" in cols_pedidos and notas:
            fields.append("notas")
            values.append(notas)
        if "dispositivo" in cols_pedidos and dispositivo:
            fields.append("dispositivo")
            values.append(dispositivo)
        if "user_agent" in cols_pedidos and user_agent:
            fields.append("user_agent")
            values.append(user_agent[:500] if user_agent else None)

        _execute(
            cur,
            f"INSERT INTO pedidos ({', '.join(fields)}) VALUES ({', '.join(['?'] * len(fields))})",
            tuple(values),
        )
        pid = cur.lastrowid

        # Insert detalles
        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        cols_det = _table_columns(cur, "detalles_pedido")

        for prod in pedido.get("productos", []):
            product_id = prod.get("id") or prod.get("producto_id")
            if product_id is None:
                # fallback: buscar por nombre si vino sin id
                nombre = prod.get("nombre")
                if not nombre:
                    raise ValueError("Producto inválido en pedido: falta id/producto_id y nombre")
                _execute(cur, "SELECT id FROM productos WHERE nombre = ? LIMIT 1", (nombre,))
                r = _fetchone_as_dict(cur)
                if not r:
                    raise ValueError(f"Producto no existe en DB: {nombre}")
                product_id = r["id"]

            cantidad = float(prod.get("cantidad", 0))
            tipo = prod.get("tipo", "unidad")

            if "tipo" in cols_det:
                _execute(
                    cur,
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad, tipo) VALUES (?, ?, ?, ?)",
                    (pid, product_id, cantidad, tipo),
                )
            else:
                _execute(
                    cur,
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad) VALUES (?, ?, ?)",
                    (pid, product_id, cantidad),
                )

        # Return payload with generated id - commit automático por context manager
        return {**pedido, "id": pid}


def get_pedidos(page: int = None, limit: int = 50, estado: str = None, creado_por: str = None) -> List[Dict[str, Any]] | Dict[str, Any]:
    """
    Obtiene pedidos con paginación opcional y filtros.
    
    Args:
        page: Número de página (1-based). Si es None, retorna todos los pedidos.
        limit: Cantidad de pedidos por página (default 50, max 200).
        estado: Filtrar por estado (pendiente, preparando, entregado, cancelado).
        creado_por: Filtrar por usuario que creó el pedido (para rol 'ventas').
    
    Returns:
        Sin paginación: Lista de pedidos (compatibilidad hacia atrás).
        Con paginación: Dict con {data: [], total: int, page: int, limit: int, pages: int}.
    
    OPTIMIZADO: Usa batch loading para eliminar N+1 queries.
    """
    with get_db_connection() as con:
        cur = con.cursor()

        cliente_col = _pedidos_cliente_col(cur)
        cols_ped = _table_columns(cur, "pedidos")
        cols_det = _table_columns(cur, "detalles_pedido")
        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        pr_cols = _table_columns(cur, "productos")
        include_img = "imagen_url" in pr_cols
        has_tipo = "tipo" in cols_det

        # Build SELECT columns for pedidos
        sel = ["id", cliente_col]
        optional_cols = ["fecha", "pdf_generado", "fecha_creacion", "fecha_generacion", 
                        "creado_por", "generado_por", "notas", "dispositivo", 
                        "ultimo_editor", "fecha_ultima_edicion", "estado", 
                        "repartidor", "fecha_entrega"]
        for col in optional_cols:
            if col in cols_ped:
                sel.append(col)

        # Build base query with optional estado filter and creado_por filter
        where_clauses = []
        params = []
        
        if estado:
            # Handle 'pendiente' as default for NULL estado
            if estado == 'pendiente':
                where_clauses.append("(estado = ? OR estado IS NULL)")
            else:
                where_clauses.append("estado = ?")
            params.append(estado)
        
        if creado_por:
            where_clauses.append("creado_por = ?")
            params.append(creado_por)
        
        where_clause = ""
        if where_clauses:
            where_clause = "WHERE " + " AND ".join(where_clauses)

        # Get total count for pagination
        count_query = f"SELECT COUNT(*) FROM pedidos {where_clause}"
        _execute(cur, count_query, params)
        total_count = cur.fetchone()[0]

        # Build main query with pagination
        base_query = f"SELECT {', '.join(sel)} FROM pedidos {where_clause} ORDER BY id DESC"
        
        if page is not None:
            limit = min(max(1, limit), 200) # Clamp limit
            offset = (page - 1) * limit
            base_query += f" LIMIT {limit} OFFSET {offset}"
        
        _execute(cur, base_query, params)
        pedidos_rows = _fetchall_as_dict(cur)

        if not pedidos_rows:
            if page is not None:
                return {"data": [], "total": total_count, "page": page, "limit": limit, "pages": 0}
            return []

        # OPTIMIZATION: Batch load all productos for all pedidos in ONE query
        pedido_ids = [r["id"] for r in pedidos_rows]
        placeholders = ",".join("?" * len(pedido_ids))
        
        sel_cols = f"dp.{pedido_fk} as pedido_id, pr.id, pr.nombre, pr.precio, dp.cantidad"
        if has_tipo:
            sel_cols += ", dp.tipo"
        if include_img:
            sel_cols += ", pr.imagen_url"
        
        _execute(
            cur,
            f"""SELECT {sel_cols} 
                FROM detalles_pedido dp 
                JOIN productos pr ON dp.{prod_fk} = pr.id 
                WHERE dp.{pedido_fk} IN ({placeholders})""",
            tuple(pedido_ids)
        )
        
        # Group productos by pedido_id
        productos_por_pedido: Dict[int, List[Dict]] = {}
        for rr in _fetchall_as_dict(cur):
            pid = rr["pedido_id"]
            if pid not in productos_por_pedido:
                productos_por_pedido[pid] = []
            item = {
                "id": rr["id"],
                "nombre": rr["nombre"],
                "precio": rr["precio"],
                "cantidad": rr["cantidad"],
                "tipo": rr["tipo"] if has_tipo else "unidad",
            }
            if include_img:
                item["imagen_url"] = rr["imagen_url"]
            productos_por_pedido[pid].append(item)

        # Build final pedidos list
        # Get column names for safe access
        col_names = set(pedidos_rows[0].keys()) if pedidos_rows else set()
        
        def safe_get(row, col, default=None):
            """Safely get value from dict."""
            val = row.get(col, default)
            return val if val is not None else default
        
        pedidos: List[Dict[str, Any]] = []
        for r in pedidos_rows:
            pid = r["id"]
            pedido = {
                "id": pid,
                "cliente_id": r.get(cliente_col),
                "fecha": safe_get(r, "fecha"),
                "pdf_generado": bool(safe_get(r, "pdf_generado", False)),
                "fecha_creacion": safe_get(r, "fecha_creacion"),
                "fecha_generacion": safe_get(r, "fecha_generacion"),
                "creado_por": safe_get(r, "creado_por"),
                "generado_por": safe_get(r, "generado_por"),
                "notas": safe_get(r, "notas"),
                "dispositivo": safe_get(r, "dispositivo"),
                "ultimo_editor": safe_get(r, "ultimo_editor"),
                "fecha_ultima_edicion": safe_get(r, "fecha_ultima_edicion"),
                "estado": safe_get(r, "estado", "pendiente"),
                "repartidor": safe_get(r, "repartidor"),
                "fecha_entrega": safe_get(r, "fecha_entrega"),
                "productos": productos_por_pedido.get(pid, []),
            }
            pedidos.append(pedido)

        # Return with pagination info or just list
        if page is not None:
            pages = (total_count + limit - 1) // limit if limit > 0 else 0 # Ceiling division
            return {
                "data": pedidos,
                "total": total_count,
                "page": page,
                "limit": limit,
                "pages": pages
            }
        
        return pedidos


def delete_pedido(pedido_id: int) -> Dict[str, Any]:
    """Elimina un pedido y todos sus registros relacionados (detalles, historial)."""
    with get_db_transaction() as (con, cur):
        pedido_fk = _detalles_pedido_col(cur)

        # Eliminar en orden: primero tablas dependientes, luego pedido principal
        _execute(cur, f"DELETE FROM detalles_pedido WHERE {pedido_fk} = ?", (pedido_id,))
        
        # Eliminar historial de modificaciones si existe
        if _table_exists(cur, "historial_pedidos"):
            _execute(cur, "DELETE FROM historial_pedidos WHERE pedido_id = ?", (pedido_id,))
        
        _execute(cur, "DELETE FROM pedidos WHERE id = ?", (pedido_id,))
        return {"status": "deleted"}


def _pedido_pendiente(cur: Union[sqlite3.Cursor, Any], pedido_id: int) -> bool:
    cols = _table_columns(cur, "pedidos")
    if "pdf_generado" not in cols:
        return True
    _execute(cur, "SELECT pdf_generado FROM pedidos WHERE id = ?", (pedido_id,))
    r = cur.fetchone()
    if not r:
        return False
    return int(r[0] or 0) == 0


def add_pedido_item(pedido_id: int, producto_id: int, cantidad: float, tipo: str = "unidad") -> Dict[str, Any]:
    """Agrega o actualiza un ítem del pedido pendiente."""
    with get_db_transaction() as (con, cur):
        if not _pedido_pendiente(cur, pedido_id):
            con.rollback()
            return {"error": "PEDIDO_YA_GENERADO", "detail": "No se puede editar un pedido ya generado"}

        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        cols_det = _table_columns(cur, "detalles_pedido")

        # Si ya existe, actualizamos
        _execute(
            cur,
            f"SELECT id FROM detalles_pedido WHERE {pedido_fk} = ? AND {prod_fk} = ? LIMIT 1",
            (pedido_id, producto_id),
        )
        r = _fetchone_as_dict(cur)
        if r:
            # update path
            if "tipo" in cols_det:
                _execute(
                    cur,
                    f"UPDATE detalles_pedido SET cantidad = ?, tipo = ? WHERE id = ?",
                    (float(cantidad), tipo, r["id"]),
                )
            else:
                _execute(
                    cur,
                    f"UPDATE detalles_pedido SET cantidad = ? WHERE id = ?",
                    (float(cantidad), r["id"]),
                )
        else:
            # insert path
            if "tipo" in cols_det:
                _execute(
                    cur,
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad, tipo) VALUES (?, ?, ?, ?)",
                    (pedido_id, producto_id, float(cantidad), tipo),
                )
            else:
                _execute(
                    cur,
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad) VALUES (?, ?, ?)",
                    (pedido_id, producto_id, float(cantidad)),
                )

        return {"status": "ok"}


def update_pedido_item(pedido_id: int, producto_id: int, cantidad: float, tipo: Optional[str] = None) -> Dict[str, Any]:
    """Actualiza cantidad/tipo de un ítem de pedido pendiente."""
    with get_db_transaction() as (con, cur):
        if not _pedido_pendiente(cur, pedido_id):
            con.rollback()
            return {"error": "PEDIDO_YA_GENERADO", "detail": "No se puede editar un pedido ya generado"}

        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        cols_det = _table_columns(cur, "detalles_pedido")

        _execute(
            cur,
            f"SELECT id FROM detalles_pedido WHERE {pedido_fk} = ? AND {prod_fk} = ? LIMIT 1",
            (pedido_id, producto_id),
        )
        r = _fetchone_as_dict(cur)
        if not r:
            con.rollback()
            return {"error": "ITEM_NO_EXISTE", "detail": "El ítem no existe en el pedido"}

        fields = ["cantidad = ?"]
        values: List[Any] = [float(cantidad)]
        if tipo is not None and "tipo" in cols_det:
            fields.append("tipo = ?")
            values.append(tipo)
        values.append(r["id"])

        _execute(cur, f"UPDATE detalles_pedido SET {', '.join(fields)} WHERE id = ?", tuple(values))
        return {"status": "ok"}


def delete_pedido_item(pedido_id: int, producto_id: int) -> Dict[str, Any]:
    """Elimina un ítem de un pedido pendiente."""
    with get_db_transaction() as (con, cur):
        if not _pedido_pendiente(cur, pedido_id):
            con.rollback()
            return {"error": "PEDIDO_YA_GENERADO", "detail": "No se puede editar un pedido ya generado"}

        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        _execute(
            cur,
            f"DELETE FROM detalles_pedido WHERE {pedido_fk} = ? AND {prod_fk} = ?",
            (pedido_id, producto_id),
        )
        return {"status": "deleted"}


def update_pedido_estado(pedido_id: int, estado: Any, generado_por: str = None) -> Dict[str, Any]:
    """
    Actualiza el estado del pedido (pdf_generado) y opcionalmente registra
    fecha_generacion y usuario que generó el PDF.
    """
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "pedidos")
        if "pdf_generado" not in cols:
            raise ValueError("La tabla pedidos no tiene columna pdf_generado")

        # Construir query dinámicamente según columnas disponibles
        updates = ["pdf_generado = ?"]
        values: List[Any] = [int(bool(estado))]
        
        # Si se está marcando como generado, agregar timestamp y usuario
        if estado and "fecha_generacion" in cols:
            updates.append("fecha_generacion = ?")
            values.append(_now_uruguay())
        
        if estado and generado_por and "generado_por" in cols:
            updates.append("generado_por = ?")
            values.append(generado_por)
        
        values.append(pedido_id)
        
        _execute(cur, f"UPDATE pedidos SET {', '.join(updates)} WHERE id = ?", tuple(values))
        return {"id": pedido_id, "pdf_generado": bool(estado)}


# === ESTADOS DE PEDIDO WORKFLOW ===
# Estados válidos: SIMPLIFICADO (3 estados principales)
# pendiente (nuevo pedido) → preparando (en cocina) → entregado (finalizado)
# cancelado puede ocurrir desde cualquier estado
ESTADOS_PEDIDO_VALIDOS = ["pendiente", "preparando", "entregado", "cancelado"]

def update_pedido_workflow(pedido_id: int, nuevo_estado: str, repartidor: str = None, usuario: str = None) -> Dict[str, Any]:
    """
    Actualiza el estado del workflow del pedido.
    Estados: tomado → preparando → listo → entregado (o cancelado)
    """
    if nuevo_estado not in ESTADOS_PEDIDO_VALIDOS:
        raise ValueError(f"Estado inválido: {nuevo_estado}. Válidos: {ESTADOS_PEDIDO_VALIDOS}")
    
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "pedidos")
        
        if "estado" not in cols:
            raise ValueError("La tabla pedidos no tiene columna estado")
        
        updates = ["estado = ?"]
        values: List[Any] = [nuevo_estado]
        
        # Si se asigna repartidor
        if repartidor and "repartidor" in cols:
            updates.append("repartidor = ?")
            values.append(repartidor)
        
        # Si se marca como entregado, registrar fecha
        if nuevo_estado == "entregado" and "fecha_entrega" in cols:
            updates.append("fecha_entrega = ?")
            values.append(_now_uruguay())
        
        # Registrar quién hizo el cambio
        if usuario and "ultimo_editor" in cols:
            updates.append("ultimo_editor = ?")
            values.append(usuario)
        if "fecha_ultima_edicion" in cols:
            updates.append("fecha_ultima_edicion = ?")
            values.append(_now_uruguay())
        
        values.append(pedido_id)
        _execute(cur, f"UPDATE pedidos SET {', '.join(updates)} WHERE id = ?", tuple(values))
        
        # Registrar en historial si existe la tabla
        if _table_exists(cur, "historial_pedidos"):
            _execute(cur, """
                INSERT INTO historial_pedidos (pedido_id, accion, usuario, fecha, detalles)
                VALUES (?, ?, ?, ?, ?)
            """, (pedido_id, "cambio_estado", usuario or "sistema", _now_uruguay(), f"Estado cambiado a: {nuevo_estado}"))
        
        return {"id": pedido_id, "estado": nuevo_estado, "repartidor": repartidor}


def get_pedidos_por_estado(estado: str = None) -> List[Dict[str, Any]]:
    """
    Obtiene pedidos filtrados por estado.
    Si estado es None, devuelve todos.
    """
    # Esta función ahora puede usar el filtro directo de get_pedidos
    # Se mantiene por compatibilidad, pero podría delegar
    pedidos_data = get_pedidos(page=None, estado=estado)
    return pedidos_data if isinstance(pedidos_data, list) else pedidos_data.get("data", [])


def get_pedidos_por_repartidor(repartidor: str) -> List[Dict[str, Any]]:
    """
    Obtiene pedidos asignados a un repartidor específico.
    Útil para la hoja de ruta.
    """
    with get_db_connection() as con:
        cur = con.cursor()
        # Asumimos que get_pedidos es la forma principal y esto es un helper específico
        # Para no re-implementar toda la lógica de join, filtramos post-fetch
        # Una implementación más optimizada haría un query directo
        pedidos_data = get_pedidos(page=None)
        all_pedidos = pedidos_data if isinstance(pedidos_data, list) else pedidos_data.get("data", [])
        return [p for p in all_pedidos if p.get("repartidor") == repartidor]


def update_pedido_cliente(pedido_id: int, cliente_id: int) -> Dict[str, Any]:
    """Actualizar el cliente de un pedido existente"""
    with get_db_transaction() as (con, cur):
        cliente_col = _pedidos_cliente_col(cur)
        _execute(cur, f"UPDATE pedidos SET {cliente_col} = ? WHERE id = ?", (cliente_id, pedido_id))
        return {"id": pedido_id, "cliente_id": cliente_id}


def export_pedidos_csv(desde: Optional[str] = None, hasta: Optional[str] = None) -> str:
    """Exporta pedidos a formato CSV (Excel compatible) con filtro de fechas opcional"""
    with get_db_connection() as con:
        cur = con.cursor()
        cliente_col = _pedidos_cliente_col(cur)
        
        query = f"""
            SELECT p.id, p.{cliente_col} as cliente_id, c.nombre as cliente_nombre, 
                   p.fecha, p.pdf_generado
            FROM pedidos p
            LEFT JOIN clientes c ON p.{cliente_col} = c.id
            WHERE 1=1
        """
        params: List[Any] = []
        
        if desde:
            query += " AND p.fecha >= ?"
            params.append(desde)
        if hasta:
            query += " AND p.fecha <= ?"
            params.append(hasta + "T23:59:59")
        
        query += " ORDER BY p.fecha DESC"
        _execute(cur, query, tuple(params))
        rows = _fetchall_as_dict(cur)
        
        d = CSV_DELIMITER
        lines = [f"id{d}cliente_id{d}cliente_nombre{d}fecha{d}pdf_generado{d}productos"]
        
        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        
        for r in rows:
            pid = r["id"]
            cliente_nombre = _sanitize_csv_field(r.get("cliente_nombre") or "Sin cliente")
            fecha = r.get("fecha") or ""
            generado = "Si" if r.get("pdf_generado") else "No"
            
            # Fetch productos para este pedido
            _execute(
                cur,
                f"""SELECT pr.nombre, dp.cantidad, dp.tipo 
                    FROM detalles_pedido dp
                    JOIN productos pr ON dp.{prod_fk} = pr.id
                    WHERE dp.{pedido_fk} = ?""",
                (pid,)
            )
            productos_rows = _fetchall_as_dict(cur)
            productos_str = ", ".join([f"{p['cantidad']} x {p['nombre']}" for p in productos_rows])
            productos_str = _sanitize_csv_field(productos_str)

            lines.append(f'{pid}{d}{r.get("cliente_id")}{d}"{cliente_nombre}"{d}"{fecha}"{d}{generado}{d}"{productos_str}"')
        
        return CSV_BOM + "\n".join(lines)


# -----------------------------------------------------------------------------
# Usuarios
# -----------------------------------------------------------------------------
def _usuarios_username_col(cur: Union[sqlite3.Cursor, Any]) -> str:
    cols = _table_columns(cur, "usuarios")
    return "username" if "username" in cols else "nombre_usuario"


def get_user(username: str) -> Optional[Dict[str, Any]]:
    """Obtiene un usuario por su username (o nombre_usuario por compatibilidad)"""
    with get_db_connection() as con:
        cur = con.cursor()
        username_col = _usuarios_username_col(cur)
        cols = _table_columns(cur, "usuarios")
        
        sel = ["id", username_col, "password_hash", "rol"]
        if "activo" in cols:
            sel.append("activo")
        if "last_login" in cols:
            sel.append("last_login")
            
        _execute(cur, f"SELECT {', '.join(sel)} FROM usuarios WHERE {username_col} = ?", (username,))
        row = _fetchone_as_dict(cur)
        
        if row:
            # Normalizar a 'username'
            row['username'] = row.pop(username_col, None)
        return row


def get_users() -> List[Dict[str, Any]]:
    """Obtiene todos los usuarios (sin password hash)"""
    with get_db_connection() as con:
        cur = con.cursor()
        username_col = _usuarios_username_col(cur)
        cols = _table_columns(cur, "usuarios")
        
        sel = ["id", username_col, "rol"]
        if "activo" in cols:
            sel.append("activo")
        if "last_login" in cols:
            sel.append("last_login")
            
        _execute(cur, f"SELECT {', '.join(sel)} FROM usuarios ORDER BY {username_col}")
        rows = _fetchall_as_dict(cur)
        
        # Normalizar a 'username'
        for row in rows:
            row['username'] = row.pop(username_col, None)
        return rows


def add_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Agrega un nuevo usuario"""
    with get_db_transaction() as (con, cur):
        username_col = _usuarios_username_col(cur)
        
        # Check for duplicates
        _execute(cur, f"SELECT id FROM usuarios WHERE {username_col} = ?", (user["username"],))
        if cur.fetchone():
            con.rollback()
            return {"error": "USER_EXISTS", "detail": "El nombre de usuario ya existe"}
            
        _execute(
            cur,
            f"INSERT INTO usuarios ({username_col}, password_hash, rol, activo) VALUES (?, ?, ?, ?)",
            (user["username"], user["password_hash"], user["rol"], 1),
        )
        return {"id": cur.lastrowid, "username": user["username"], "rol": user["rol"]}


def update_user(username: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza rol, activo o password de un usuario"""
    with get_db_transaction() as (con, cur):
        username_col = _usuarios_username_col(cur)
        
        fields = []
        values: List[Any] = []
        
        if "rol" in updates:
            fields.append("rol = ?")
            values.append(updates["rol"])
        if "activo" in updates:
            fields.append("activo = ?")
            values.append(int(bool(updates["activo"])))
        if "password_hash" in updates:
            fields.append("password_hash = ?")
            values.append(updates["password_hash"])
            
        if not fields:
            return {"status": "no_changes"}
            
        values.append(username)
        _execute(cur, f"UPDATE usuarios SET {', '.join(fields)} WHERE {username_col} = ?", tuple(values))
        
        return {"status": "updated", "username": username}


def delete_user(username: str) -> Dict[str, Any]:
    """Elimina un usuario"""
    with get_db_transaction() as (con, cur):
        username_col = _usuarios_username_col(cur)
        _execute(cur, f"DELETE FROM usuarios WHERE {username_col} = ?", (username,))
        return {"status": "deleted"}


def record_login(username: str) -> None:
    """Registra el timestamp del último login"""
    with get_db_transaction() as (con, cur):
        cols = _table_columns(cur, "usuarios")
        if "last_login" in cols:
            _execute(cur, f"UPDATE usuarios SET last_login = ? WHERE {username_col} = ?", (_now_uruguay_iso(), username))


# -----------------------------------------------------------------------------
# Token Revocation List (Blacklist)
# -----------------------------------------------------------------------------
def revoke_token(jti: str, expires_at, username: str) -> bool:
    """Agrega un JTI a la lista de revocación.
    
    Args:
        jti: Token identifier
        expires_at: Expiration time - can be datetime object or ISO string
        username: Username associated with the token
    
    Returns:
        True on success (new token revoked), False if already revoked
    """
    with get_db_transaction() as (con, cur):
        # Check if already revoked
        _execute(cur, "SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1", (jti,))
        if cur.fetchone() is not None:
            return False  # Already revoked, skip silently
        
        # Handle both datetime objects and strings
        if isinstance(expires_at, str):
            expires_at_str = expires_at
        else:
            # Convert aware datetime to naive UTC string for storage
            expires_at_str = expires_at.astimezone(timezone.utc).replace(tzinfo=None).isoformat()
        
        _execute(
            cur,
            "INSERT INTO revoked_tokens (jti, revoked_at, expires_at, username) VALUES (?, ?, ?, ?)",
            (jti, _now_iso(), expires_at_str, username)
        )
        return True


def is_token_revoked(jti: str) -> bool:
    """Verifica si un JTI está en la lista de revocación."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1", (jti,))
        return cur.fetchone() is not None


def get_active_user_if_token_valid(username: str, jti: str) -> Optional[Dict[str, Any]]:
    """
    Atomic check: returns user if active AND token is not revoked.
    Returns None if user is inactive or token is revoked.
    """
    with get_db_connection() as con:
        cur = con.cursor()
        
        # Check if token is revoked
        _execute(cur, "SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1", (jti,))
        if cur.fetchone() is not None:
            return None
        
        # Get user and check if active
        user = get_user(username)
        if user is None or not user.get("activo"):
            return None
        
        # Convert activo to boolean for consistency
        user["activo"] = bool(user.get("activo"))
        return user

def cleanup_revoked_tokens() -> int:
    """Elimina tokens expirados de la lista de revocación."""
    with get_db_transaction() as (con, cur):
        now_str = _now_iso()
        
        # Contar cuántos se van a borrar
        _execute(cur, "SELECT COUNT(*) FROM revoked_tokens WHERE expires_at < ?", (now_str,))
        count = cur.fetchone()[0]
        
        if count > 0:
            _execute(cur, "DELETE FROM revoked_tokens WHERE expires_at < ?", (now_str,))
        
        return count


# Alias for backward compatibility with tests
cleanup_expired_tokens = cleanup_revoked_tokens


# -----------------------------------------------------------------------------
# Listas de Precios
# -----------------------------------------------------------------------------
def get_listas_precios(incluir_inactivas: bool = False) -> List[Dict[str, Any]]:
    """Obtiene todas las listas de precios."""
    with get_db_connection() as con:
        cur = con.cursor()
        query = "SELECT id, nombre, descripcion, multiplicador, activa, fecha_creacion FROM listas_precios"
        if not incluir_inactivas:
            query += " WHERE activa = 1"
        query += " ORDER BY nombre"
        _execute(cur, query)
        return _fetchall_as_dict(cur)


def get_lista_precios_by_id(lista_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una lista de precios por ID."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT * FROM listas_precios WHERE id = ?", (lista_id,))
        return _fetchone_as_dict(cur)


def add_lista_precios(lista: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva lista de precios."""
    with get_db_transaction() as (con, cur):
        nombre = (lista.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre de la lista es requerido"}
        
        _execute(cur, "SELECT id FROM listas_precios WHERE LOWER(nombre) = LOWER(?)", (nombre,))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe una lista con el nombre '{nombre}'"}
        
        _execute(
            cur,
            "INSERT INTO listas_precios (nombre, descripcion, multiplicador, activa, fecha_creacion) VALUES (?, ?, ?, 1, ?)",
            (nombre, lista.get("descripcion", ""), float(lista.get("multiplicador", 1.0)), _now_uruguay_iso())
        )
        lista["id"] = cur.lastrowid
        return lista


def update_lista_precios(lista_id: int, lista: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza una lista de precios."""
    with get_db_transaction() as (con, cur):
        nombre = (lista.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre de la lista es requerido"}
        
        _execute(cur, "SELECT id FROM listas_precios WHERE LOWER(nombre) = LOWER(?) AND id != ?", (nombre, lista_id))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe otra lista con el nombre '{nombre}'"}
        
        _execute(
            cur,
            "UPDATE listas_precios SET nombre = ?, descripcion = ?, multiplicador = ?, activa = ? WHERE id = ?",
            (
                nombre,
                lista.get("descripcion", ""),
                float(lista.get("multiplicador", 1.0)),
                1 if lista.get("activa", True) else 0,
                lista_id
            )
        )
        return {"id": lista_id, **lista}


def delete_lista_precios(lista_id: int) -> Dict[str, Any]:
    """Elimina una lista de precios."""
    with get_db_transaction() as (con, cur):
        # Des-asignar de clientes
        _execute(cur, "UPDATE clientes SET lista_precio_id = NULL WHERE lista_precio_id = ?", (lista_id,))
        # Eliminar precios especiales (trigger debería hacerlo, pero por seguridad)
        _execute(cur, "DELETE FROM precios_lista WHERE lista_id = ?", (lista_id,))
        # Eliminar lista
        _execute(cur, "DELETE FROM listas_precios WHERE id = ?", (lista_id,))
        return {"status": "deleted"}


def get_precios_de_lista(lista_id: int) -> List[Dict[str, Any]]:
    """Obtiene los precios especiales de una lista."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            """SELECT pl.producto_id, p.nombre as producto_nombre, pl.precio_especial
               FROM precios_lista pl
               JOIN productos p ON pl.producto_id = p.id
               WHERE pl.lista_id = ?
               ORDER BY p.nombre""",
            (lista_id,)
        )
        return _fetchall_as_dict(cur)


def set_precio_en_lista(lista_id: int, producto_id: int, precio: float) -> Dict[str, Any]:
    """Establece o actualiza un precio especial en una lista."""
    with get_db_transaction() as (con, cur):
        # Upsert
        _execute(cur, "SELECT id FROM precios_lista WHERE lista_id = ? AND producto_id = ?", (lista_id, producto_id))
        if cur.fetchone():
            _execute(
                cur,
                "UPDATE precios_lista SET precio_especial = ? WHERE lista_id = ? AND producto_id = ?",
                (precio, lista_id, producto_id)
            )
        else:
            _execute(
                cur,
                "INSERT INTO precios_lista (lista_id, producto_id, precio_especial) VALUES (?, ?, ?)",
                (lista_id, producto_id, precio)
            )
        return {"status": "ok"}


def delete_precio_de_lista(lista_id: int, producto_id: int) -> Dict[str, Any]:
    """Elimina un precio especial de una lista."""
    with get_db_transaction() as (con, cur):
        _execute("DELETE FROM precios_lista WHERE lista_id = ? AND producto_id = ?", (lista_id, producto_id))
        return {"status": "deleted"}


def get_productos_con_precios_lista(cliente_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Obtiene todos los productos con su precio final, aplicando la lista de precios
    del cliente si corresponde.
    """
    with get_db_connection() as con:
        cur = con.cursor()
        
        lista_id = None
        multiplicador = 1.0
        
        if cliente_id:
            _execute(cur, "SELECT lista_precio_id FROM clientes WHERE id = ?", (cliente_id,))
            row = cur.fetchone()
            if row and row[0]:
                lista_id = row[0]
                _execute(cur, "SELECT multiplicador FROM listas_precios WHERE id = ?", (lista_id,))
                row_lista = cur.fetchone()
                if row_lista:
                    multiplicador = row_lista[0]

        # 1. Get all products
        _execute(cur, "SELECT id, nombre, precio, categoria_id, imagen_url, stock FROM productos ORDER BY nombre")
        productos = _fetchall_as_dict(cur)
        
        # 2. Get special prices if a list is active
        precios_especiales = {}
        if lista_id:
            _execute(cur, "SELECT producto_id, precio_especial FROM precios_lista WHERE lista_id = ?", (lista_id,))
            for row in cur.fetchall():
                precios_especiales[row[0]] = row[1]
        
        # 3. Calculate final prices
        for p in productos:
            producto_id = p['id']
            if producto_id in precios_especiales:
                p['precio_final'] = precios_especiales[producto_id]
                p['en_lista'] = True
            else:
                p['precio_final'] = p['precio'] * multiplicador
                p['en_lista'] = False
        
        return productos


# -----------------------------------------------------------------------------
# Pedidos Template (Recurrentes)
# -----------------------------------------------------------------------------
def get_pedidos_templates(cliente_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Obtiene todos los templates de pedidos, opcionalmente filtrados por cliente."""
    with get_db_connection() as con:
        cur = con.cursor()
        query = "SELECT * FROM pedidos_template"
        params = []
        if cliente_id:
            query += " WHERE cliente_id = ?"
            params.append(cliente_id)
        query += " ORDER BY nombre"
        _execute(cur, query, tuple(params))
        return _fetchall_as_dict(cur)


def get_pedido_template_by_id(template_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un template de pedido por ID, incluyendo sus detalles."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT * FROM pedidos_template WHERE id = ?", (template_id,))
        template = _fetchone_as_dict(cur)
        if not template:
            return None
        
        _execute(
            cur,
            """SELECT dt.producto_id, p.nombre, dt.cantidad, dt.tipo
               FROM detalles_template dt
               JOIN productos p ON dt.producto_id = p.id
               WHERE dt.template_id = ?""",
            (template_id,)
        )
        template['productos'] = _fetchall_as_dict(cur)
        return template


def add_pedido_template(template: Dict[str, Any], creado_por: str) -> Dict[str, Any]:
    """Crea un nuevo template de pedido."""
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            """INSERT INTO pedidos_template 
               (nombre, cliente_id, frecuencia, activo, creado_por, fecha_creacion)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                template['nombre'],
                template.get('cliente_id'),
                template.get('frecuencia'),
                1,
                creado_por,
                _now_uruguay_iso()
            )
        )
        template_id = cur.lastrowid
        
        for prod in template.get('productos', []):
            _execute(
                cur,
                "INSERT INTO detalles_template (template_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (template_id, prod['producto_id'], prod['cantidad'], prod.get('tipo', 'unidad'))
            )
            
        template['id'] = template_id
        return template


def update_pedido_template(template_id: int, template: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un template de pedido."""
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            "UPDATE pedidos_template SET nombre = ?, cliente_id = ?, frecuencia = ?, activo = ? WHERE id = ?",
            (
                template['nombre'],
                template.get('cliente_id'),
                template.get('frecuencia'),
                1 if template.get('activo', True) else 0,
                template_id
            )
        )
        
        # Reemplazar detalles
        _execute(cur, "DELETE FROM detalles_template WHERE template_id = ?", (template_id,))
        for prod in template.get('productos', []):
            _execute(
                cur,
                "INSERT INTO detalles_template (template_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (template_id, prod['producto_id'], prod['cantidad'], prod.get('tipo', 'unidad'))
            )
            
        return {"id": template_id, **template}


def delete_pedido_template(template_id: int) -> Dict[str, Any]:
    """Elimina un template de pedido."""
    with get_db_transaction() as (con, cur):
        # Trigger debería encargarse de los detalles, pero por si acaso
        _execute(cur, "DELETE FROM detalles_template WHERE template_id = ?", (template_id,))
        _execute(cur, "DELETE FROM pedidos_template WHERE id = ?", (template_id,))
        return {"status": "deleted"}


# -----------------------------------------------------------------------------
# Ofertas
# -----------------------------------------------------------------------------
def get_ofertas(solo_activas: bool = True) -> List[Dict[str, Any]]:
    """Obtiene ofertas, con opción de ver solo las activas y vigentes."""
    with get_db_connection() as con:
        cur = con.cursor()
        query = "SELECT * FROM ofertas"
        params = []
        if solo_activas:
            now_str = datetime.now(URUGUAY_TZ).isoformat()
            query += " WHERE activa = 1 AND desde <= ? AND hasta >= ?"
            params.extend([now_str, now_str])
        query += " ORDER BY hasta DESC"
        _execute(cur, query, tuple(params))
        return _fetchall_as_dict(cur)


def get_oferta_by_id(oferta_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una oferta por ID, incluyendo sus productos."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT * FROM ofertas WHERE id = ?", (oferta_id,))
        oferta = _fetchone_as_dict(cur)
        if not oferta:
            return None
        
        _execute(
            cur,
            """SELECT op.producto_id, p.nombre, op.cantidad
               FROM oferta_productos op
               JOIN productos p ON op.producto_id = p.id
               WHERE op.oferta_id = ?""",
            (oferta_id,)
        )
        oferta['productos'] = _fetchall_as_dict(cur)
        return oferta


def add_oferta(oferta: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva oferta."""
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            "INSERT INTO ofertas (titulo, descripcion, desde, hasta, activa, descuento_porcentaje) VALUES (?, ?, ?, ?, ?, ?)",
            (
                oferta['titulo'],
                oferta.get('descripcion'),
                oferta['desde'],
                oferta['hasta'],
                1 if oferta.get('activa', True) else 0,
                float(oferta.get('descuento_porcentaje', 10.0))
            )
        )
        oferta_id = cur.lastrowid
        
        for prod in oferta.get('productos', []):
            _execute(
                cur,
                "INSERT INTO oferta_productos (oferta_id, producto_id, cantidad) VALUES (?, ?, ?)",
                (oferta_id, prod['producto_id'], prod.get('cantidad', 1))
            )
            
        oferta['id'] = oferta_id
        return oferta


def update_oferta(oferta_id: int, oferta: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza una oferta."""
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            "UPDATE ofertas SET titulo = ?, descripcion = ?, desde = ?, hasta = ?, activa = ?, descuento_porcentaje = ? WHERE id = ?",
            (
                oferta['titulo'],
                oferta.get('descripcion'),
                oferta['desde'],
                oferta['hasta'],
                1 if oferta.get('activa', True) else 0,
                float(oferta.get('descuento_porcentaje', 10.0)),
                oferta_id
            )
        )
        
        # Reemplazar productos
        _execute(cur, "DELETE FROM oferta_productos WHERE oferta_id = ?", (oferta_id,))
        for prod in oferta.get('productos', []):
            _execute(
                cur,
                "INSERT INTO oferta_productos (oferta_id, producto_id, cantidad) VALUES (?, ?, ?)",
                (oferta_id, prod['producto_id'], prod.get('cantidad', 1))
            )
            
        return {"id": oferta_id, **oferta}


def delete_oferta(oferta_id: int) -> Dict[str, Any]:
    """Elimina una oferta."""
    with get_db_transaction() as (con, cur):
        # Trigger debería encargarse de oferta_productos, pero por si acaso
        _execute(cur, "DELETE FROM oferta_productos WHERE oferta_id = ?", (oferta_id,))
        _execute(cur, "DELETE FROM ofertas WHERE id = ?", (oferta_id,))
        return {"status": "deleted"}


# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------
def get_tags() -> List[Dict[str, Any]]:
    """Obtiene todos los tags."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT id, nombre, color, icono, tipo FROM tags ORDER BY nombre")
        return _fetchall_as_dict(cur)


def add_tag(tag: Dict[str, Any]) -> Dict[str, Any]:
    """Crea un nuevo tag."""
    with get_db_transaction() as (con, cur):
        nombre = (tag.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre es requerido"}
        
        _execute(cur, "SELECT id FROM tags WHERE LOWER(nombre) = LOWER(?)", (nombre,))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe un tag con el nombre '{nombre}'"}
        
        _execute(
            cur,
            "INSERT INTO tags (nombre, color, icono, tipo) VALUES (?, ?, ?, ?)",
            (nombre, tag.get('color', '#6366f1'), tag.get('icono', '🏷️'), tag.get('tipo', 'general'))
        )
        tag['id'] = cur.lastrowid
        return tag


def update_tag(tag_id: int, tag: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un tag."""
    with get_db_transaction() as (con, cur):
        nombre = (tag.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre es requerido"}
        
        _execute(cur, "SELECT id FROM tags WHERE LOWER(nombre) = LOWER(?) AND id != ?", (nombre, tag_id))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe otro tag con el nombre '{nombre}'"}
        
        _execute(
            cur,
            "UPDATE tags SET nombre = ?, color = ?, icono = ?, tipo = ? WHERE id = ?",
            (nombre, tag.get('color'), tag.get('icono'), tag.get('tipo'), tag_id)
        )
        return {"id": tag_id, **tag}


def delete_tag(tag_id: int) -> Dict[str, Any]:
    """Elimina un tag."""
    with get_db_transaction() as (con, cur):
        # Trigger debería encargarse de productos_tags, pero por si acaso
        _execute(cur, "DELETE FROM productos_tags WHERE tag_id = ?", (tag_id,))
        _execute(cur, "DELETE FROM tags WHERE id = ?", (tag_id,))
        return {"status": "deleted"}


def get_tags_for_producto(producto_id: int) -> List[Dict[str, Any]]:
    """Obtiene los tags de un producto específico."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            """SELECT t.id, t.nombre, t.color, t.icono, t.tipo
               FROM tags t
               JOIN productos_tags pt ON t.id = pt.tag_id
               WHERE pt.producto_id = ?""",
            (producto_id,)
        )
        return _fetchall_as_dict(cur)


def set_tags_for_producto(producto_id: int, tag_ids: List[int]) -> Dict[str, Any]:
    """Establece los tags para un producto, reemplazando los existentes."""
    with get_db_transaction() as (con, cur):
        # Borrar tags existentes para este producto
        _execute(cur, "DELETE FROM productos_tags WHERE producto_id = ?", (producto_id,))
        
        # Añadir nuevos tags
        if tag_ids:
            for tag_id in tag_ids:
                _execute(
                    cur,
                    "INSERT INTO productos_tags (producto_id, tag_id) VALUES (?, ?)",
                    (producto_id, tag_id)
                )
        
        return {"status": "ok", "producto_id": producto_id, "tag_ids": tag_ids}


def get_productos_by_tag(tag_id: int) -> List[Dict[str, Any]]:
    """Obtiene productos que tienen un tag específico."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            """SELECT p.id, p.nombre, p.precio, p.stock, p.imagen_url
               FROM productos p
               JOIN productos_tags pt ON p.id = pt.producto_id
               WHERE pt.tag_id = ?
               ORDER BY p.nombre""",
            (tag_id,)
        )
        return _fetchall_as_dict(cur)


def get_productos_with_tags() -> List[Dict[str, Any]]:
    """Obtiene todos los productos con sus tags incluidos."""
    with get_db_connection() as con:
        cur = con.cursor()
        
        # Primero obtener todos los productos
        _execute(cur, "SELECT * FROM productos ORDER BY nombre")
        productos = _fetchall_as_dict(cur)
        
        # Luego obtener todos los tags de productos en una sola query
        _execute(
            cur,
            """SELECT pt.producto_id, t.id, t.nombre, t.color, t.icono, t.tipo
               FROM productos_tags pt
               JOIN tags t ON pt.tag_id = t.id
            """
        )
        tags_by_product = {}
        for row in cur.fetchall():
            pid = row[0]
            if pid not in tags_by_product:
                tags_by_product[pid] = []
            tags_by_product[pid].append({
                "id": row[1], "nombre": row[2], "color": row[3],
                "icono": row[4], "tipo": row[5]
            })
        
        # Añadir tags a cada producto
        for producto in productos:
            producto["tags"] = tags_by_product.get(producto["id"], [])
        
        return productos


# -----------------------------------------------------------------------------
# REPORTES AVANZADOS
# -----------------------------------------------------------------------------
def get_reporte_ventas(desde: str, hasta: str) -> Dict[str, Any]:
    """Reporte de ventas por período"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        cliente_col = "cliente_id" if "cliente_id" in cols else "id_cliente"
        
        cur.execute(f"""
            SELECT COUNT(DISTINCT p.id) as total_pedidos,
                   SUM(dp.cantidad * pr.precio) as total_ventas
            FROM pedidos p
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= ? AND p.fecha <= ?
        """, (desde, hasta))
        totales = cur.fetchone()
        
        cur.execute(f"""
            SELECT DATE(p.fecha) as dia, COUNT(DISTINCT p.id) as pedidos,
                   SUM(dp.cantidad * pr.precio) as ventas
            FROM pedidos p
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= ? AND p.fecha <= ?
            GROUP BY DATE(p.fecha) ORDER BY dia
        """, (desde, hasta))
        por_dia = [dict(r) for r in cur.fetchall()]
        
        cur.execute(f"""
            SELECT pr.id, pr.nombre, pr.precio, SUM(dp.cantidad) as cantidad_vendida,
                   SUM(dp.cantidad * pr.precio) as total_vendido
            FROM detalles_pedido dp
            JOIN productos pr ON dp.producto_id = pr.id
            JOIN pedidos p ON dp.pedido_id = p.id
            WHERE p.fecha >= ? AND p.fecha <= ?
            GROUP BY pr.id ORDER BY cantidad_vendida DESC LIMIT 10
        """, (desde, hasta))
        top_productos = [dict(r) for r in cur.fetchall()]
        
        cur.execute(f"""
            SELECT c.id, c.nombre, c.telefono, COUNT(DISTINCT p.id) as total_pedidos,
                   SUM(dp.cantidad * pr.precio) as total_compras
            FROM clientes c
            JOIN pedidos p ON p.{cliente_col} = c.id
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= ? AND p.fecha <= ?
            GROUP BY c.id ORDER BY total_compras DESC LIMIT 10
        """, (desde, hasta))
        top_clientes = [dict(r) for r in cur.fetchall()]
        
        return {
            "periodo": {"desde": desde, "hasta": hasta},
            "totales": {"pedidos": totales[0] or 0, "ventas": round(totales[1] or 0, 2)},
            "por_dia": por_dia,
            "top_productos": top_productos,
            "top_clientes": top_clientes
        }
    finally:
        con.close()


def get_reporte_inventario() -> Dict[str, Any]:
    """Reporte de estado del inventario"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT COUNT(*) as total_productos, SUM(stock) as stock_total,
                   SUM(stock * precio) as valor_inventario,
                   SUM(CASE WHEN stock < stock_minimo THEN 1 ELSE 0 END) as productos_bajo_stock
            FROM productos
        """)
        resumen = cur.fetchone()
        
        cur.execute("""
            SELECT id, nombre, precio, stock, stock_minimo, stock_tipo,
                   (stock_minimo - stock) as faltante
            FROM productos WHERE stock < stock_minimo ORDER BY faltante DESC
        """)
        bajo_stock = [dict(r) for r in cur.fetchall()]
        
        fecha_limite = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        cur.execute("""
            SELECT p.id, p.nombre, p.precio, p.stock, MAX(pe.fecha) as ultima_venta
            FROM productos p
            LEFT JOIN detalles_pedido dp ON dp.producto_id = p.id
            LEFT JOIN pedidos pe ON dp.pedido_id = pe.id AND pe.fecha >= ?
            WHERE dp.id IS NULL GROUP BY p.id ORDER BY p.stock DESC LIMIT 20
        """, (fecha_limite,))
        sin_movimiento = [dict(r) for r in cur.fetchall()]
        
        return {
            "resumen": {
                "total_productos": resumen[0] or 0,
                "stock_total": resumen[1] or 0,
                "valor_inventario": round(resumen[2] or 0, 2),
                "productos_bajo_stock": resumen[3] or 0
            },
            "bajo_stock": bajo_stock,
            "sin_movimiento": sin_movimiento
        }
    finally:
        con.close()


def get_reporte_clientes() -> Dict[str, Any]:
    """Reporte de análisis de clientes"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        cliente_col = "cliente_id" if "cliente_id" in cols else "id_cliente"
        
        fecha_30 = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        cur.execute(f"SELECT COUNT(DISTINCT {cliente_col}) FROM pedidos WHERE fecha >= ?", (fecha_30,))
        clientes_activos = cur.fetchone()[0] or 0
        
        cur.execute("SELECT COUNT(*) FROM clientes")
        total_clientes = cur.fetchone()[0] or 0
        
        cur.execute(f"""
            SELECT c.id, c.nombre, c.telefono, c.direccion, COUNT(DISTINCT p.id) as total_pedidos,
                   SUM(dp.cantidad * pr.precio) as total_compras, MAX(p.fecha) as ultimo_pedido
            FROM clientes c
            LEFT JOIN pedidos p ON p.{cliente_col} = c.id
            LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
            LEFT JOIN productos pr ON dp.producto_id = pr.id
            GROUP BY c.id ORDER BY total_compras DESC LIMIT 20
        """)
        ranking = [dict(r) for r in cur.fetchall()]
        
        fecha_60 = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        cur.execute(f"""
            SELECT c.id, c.nombre, c.telefono, MAX(p.fecha) as ultimo_pedido
            FROM clientes c LEFT JOIN pedidos p ON p.{cliente_col} = c.id
            GROUP BY c.id HAVING ultimo_pedido IS NULL OR ultimo_pedido < ?
            ORDER BY ultimo_pedido DESC LIMIT 20
        """, (fecha_60,))
        inactivos = [dict(r) for r in cur.fetchall()]
        
        return {
            "resumen": {"total_clientes": total_clientes, "clientes_activos": clientes_activos,
                        "clientes_inactivos": total_clientes - clientes_activos},
            "ranking": ranking, "inactivos": inactivos
        }
    finally:
        con.close()


def get_reporte_productos(desde: str, hasta: str) -> Dict[str, Any]:
    """Reporte de productos más vendidos y tendencias"""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Top 20 productos más vendidos en el período
        cur.execute("""
            SELECT p.id, p.nombre, p.precio, p.stock,
                   SUM(dp.cantidad) as total_vendido,
                   SUM(dp.cantidad * p.precio) as total_facturado,
                   COUNT(DISTINCT pe.id) as veces_pedido
            FROM productos p
            JOIN detalles_pedido dp ON dp.producto_id = p.id
            JOIN pedidos pe ON pe.id = dp.pedido_id
            WHERE pe.fecha BETWEEN ? AND ?
            GROUP BY p.id
            ORDER BY total_vendido DESC
            LIMIT 20
        """, (desde, hasta))
        mas_vendidos = [dict(r) for r in cur.fetchall()]
        
        # Productos nunca vendidos en el período
        cur.execute("""
            SELECT p.id, p.nombre, p.precio, p.stock
            FROM productos p
            WHERE p.id NOT IN (
                SELECT DISTINCT dp.producto_id FROM detalles_pedido dp
                JOIN pedidos pe ON pe.id = dp.pedido_id
                WHERE pe.fecha BETWEEN ? AND ?
            )
            ORDER BY p.nombre
            LIMIT 30
        """, (desde, hasta))
        sin_ventas = [dict(r) for r in cur.fetchall()]
        
        # Resumen
        cur.execute("""
            SELECT COUNT(DISTINCT p.id) as productos_vendidos,
                   SUM(dp.cantidad) as unidades_totales
            FROM productos p
            JOIN detalles_pedido dp ON dp.producto_id = p.id
            JOIN pedidos pe ON pe.id = dp.pedido_id
            WHERE pe.fecha BETWEEN ? AND ?
        """, (desde, hasta))
        resumen = dict(cur.fetchone() or {})
        
        cur.execute("SELECT COUNT(*) FROM productos")
        resumen["total_productos"] = cur.fetchone()[0] or 0
        resumen["sin_ventas_periodo"] = len(sin_ventas)
        
        return {
            "resumen": resumen,
            "mas_vendidos": mas_vendidos,
            "sin_ventas": sin_ventas,
            "por_categoria": []  # No hay columna categoría en esta DB
        }
    finally:
        con.close()


def get_reporte_rendimiento() -> Dict[str, Any]:
    """Reporte de rendimiento operativo"""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Pedidos por día de la semana
        cur.execute("""
            SELECT 
                CASE CAST(strftime('%w', fecha) AS INTEGER)
                    WHEN 0 THEN 'Domingo'
                    WHEN 1 THEN 'Lunes'
                    WHEN 2 THEN 'Martes'
                    WHEN 3 THEN 'Miércoles'
                    WHEN 4 THEN 'Jueves'
                    WHEN 5 THEN 'Viernes'
                    WHEN 6 THEN 'Sábado'
                END as dia,
                CAST(strftime('%w', fecha) AS INTEGER) as dia_num,
                COUNT(*) as total_pedidos
            FROM pedidos
            WHERE fecha >= date('now', '-90 days')
            GROUP BY dia_num
            ORDER BY dia_num
        """)
        por_dia_semana = [dict(r) for r in cur.fetchall()]
        
        # Pedidos por hora del día
        cur.execute("""
            SELECT 
                CAST(strftime('%H', fecha_creacion) AS INTEGER) as hora,
                COUNT(*) as total_pedidos
            FROM pedidos
            WHERE fecha_creacion IS NOT NULL AND fecha >= date('now', '-30 days')
            GROUP BY hora
            ORDER BY hora
        """)
        por_hora = [dict(r) for r in cur.fetchall()]
        
        # Usuarios más activos
        cur.execute("""
            SELECT creado_por as usuario, COUNT(*) as pedidos_creados
            FROM pedidos
            WHERE creado_por IS NOT NULL AND fecha >= date('now', '-30 days')
            GROUP BY creado_por
            ORDER BY pedidos_creados DESC
            LIMIT 10
        """)
        usuarios_activos = [dict(r) for r in cur.fetchall()]
        
        # Tiempo promedio de generación (creación a PDF)
        cur.execute("""
            SELECT 
                AVG(JULIANDAY(fecha_generacion) - JULIANDAY(fecha_creacion)) * 24 as horas_promedio
            FROM pedidos
            WHERE pdf_generado = 1 AND fecha_creacion IS NOT NULL AND fecha_generacion IS NOT NULL
            AND fecha >= date('now', '-30 days')
        """)
        tiempo_generacion = cur.fetchone()[0] or 0
        
        # Tasa de pedidos con cliente asignado
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN cliente_id IS NOT NULL THEN 1 ELSE 0 END) as con_cliente
            FROM pedidos
            WHERE fecha >= date('now', '-30 days')
        """)
        r = cur.fetchone()
        tasa_cliente = (r[1] / r[0] * 100) if r[0] > 0 else 0
        
        return {
            "por_dia_semana": por_dia_semana,
            "por_hora": por_hora,
            "usuarios_activos": usuarios_activos,
            "metricas": {
                "tiempo_promedio_generacion_horas": round(tiempo_generacion, 2),
                "tasa_pedidos_con_cliente": round(tasa_cliente, 1)
            }
        }
    finally:
        con.close()


def get_reporte_comparativo() -> Dict[str, Any]:
    """Reporte comparativo entre períodos"""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Este mes vs mes anterior
        cur.execute("""
            SELECT 
                COUNT(*) as pedidos,
                COALESCE(SUM(dp.cantidad * pr.precio), 0) as facturado
            FROM pedidos p
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= date('now', 'start of month')
        """)
        row = cur.fetchone()
        este_mes = {"pedidos": row[0] or 0, "facturado": row[1] or 0}
        
        cur.execute("""
            SELECT 
                COUNT(*) as pedidos,
                COALESCE(SUM(dp.cantidad * pr.precio), 0) as facturado
            FROM pedidos p
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= date('now', 'start of month', '-1 month')
              AND p.fecha < date('now', 'start of month')
        """)
        row = cur.fetchone()
        mes_anterior = {"pedidos": row[0] or 0, "facturado": row[1] or 0}
        
        # Calcular variación
        var_pedidos = 0
        var_facturado = 0
        if mes_anterior.get("pedidos") and mes_anterior["pedidos"] > 0:
            este_pedidos = este_mes.get("pedidos") or 0
            var_pedidos = ((este_pedidos - mes_anterior["pedidos"]) / mes_anterior["pedidos"]) * 100
        if mes_anterior.get("facturado") and mes_anterior["facturado"] > 0:
            este_facturado = este_mes.get("facturado") or 0
            var_facturado = ((este_facturado - mes_anterior["facturado"]) / mes_anterior["facturado"]) * 100
        
        # Últimos 7 días por día
        cur.execute("""
            SELECT 
                date(p.fecha) as dia,
                COUNT(DISTINCT p.id) as pedidos,
                SUM(dp.cantidad * pr.precio) as facturado
            FROM pedidos p
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= date('now', '-7 days')
            GROUP BY date(p.fecha)
            ORDER BY dia
        """)
        ultimos_7_dias = [dict(r) for r in cur.fetchall()]
        
        # Últimos 6 meses
        cur.execute("""
            SELECT 
                strftime('%Y-%m', p.fecha) as mes,
                COUNT(DISTINCT p.id) as pedidos,
                SUM(dp.cantidad * pr.precio) as facturado
            FROM pedidos p
            JOIN detalles_pedido dp ON dp.pedido_id = p.id
            JOIN productos pr ON dp.producto_id = pr.id
            WHERE p.fecha >= date('now', '-6 months')
            GROUP BY strftime('%Y-%m', p.fecha)
            ORDER BY mes
        """)
        ultimos_6_meses = [dict(r) for r in cur.fetchall()]
        
        return {
            "mensual": {
                "este_mes": este_mes,
                "mes_anterior": mes_anterior,
                "variacion_pedidos": round(var_pedidos, 1),
                "variacion_facturado": round(var_facturado, 1)
            },
            "ultimos_7_dias": ultimos_7_dias,
            "ultimos_6_meses": ultimos_6_meses
        }
    finally:
        con.close()


# -----------------------------------------------------------------------------
# PEDIDOS RECURRENTES (Templates)
# -----------------------------------------------------------------------------
def get_pedidos_templates(cliente_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Obtiene todos los templates de pedidos, opcionalmente filtrados por cliente."""
    with get_db_connection() as con:
        cur = con.cursor()
        query = "SELECT * FROM pedidos_template"
        params = []
        if cliente_id:
            query += " WHERE cliente_id = ?"
            params.append(cliente_id)
        query += " ORDER BY nombre"
        _execute(cur, query, tuple(params))
        return _fetchall_as_dict(cur)


def get_pedido_template_by_id(template_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un template de pedido por ID, incluyendo sus detalles."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT * FROM pedidos_template WHERE id = ?", (template_id,))
        template = _fetchone_as_dict(cur)
        if not template:
            return None
        
        _execute(
            cur,
            """SELECT dt.producto_id, p.nombre, dt.cantidad, dt.tipo
               FROM detalles_template dt
               JOIN productos p ON dt.producto_id = p.id
               WHERE dt.template_id = ?""",
            (template_id,)
        )
        template['productos'] = _fetchall_as_dict(cur)
        return template


def add_pedido_template(template: Dict[str, Any], creado_por: str) -> Dict[str, Any]:
    """Crea un nuevo template de pedido."""
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            """INSERT INTO pedidos_template 
               (nombre, cliente_id, frecuencia, activo, creado_por, fecha_creacion)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                template['nombre'],
                template.get('cliente_id'),
                template.get('frecuencia'),
                1,
                creado_por,
                _now_uruguay_iso()
            )
        )
        template_id = cur.lastrowid
        
        for prod in template.get('productos', []):
            _execute(
                cur,
                "INSERT INTO detalles_template (template_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (template_id, prod['producto_id'], prod['cantidad'], prod.get('tipo', 'unidad'))
            )
            
        template['id'] = template_id
        return template


def update_pedido_template(template_id: int, template: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un template de pedido."""
    with get_db_transaction() as (con, cur):
        _execute(
            cur,
            "UPDATE pedidos_template SET nombre = ?, cliente_id = ?, frecuencia = ?, activo = ? WHERE id = ?",
            (
                template['nombre'],
                template.get('cliente_id'),
                template.get('frecuencia'),
                1 if template.get('activo', True) else 0,
                template_id
            )
        )
        
        # Reemplazar detalles
        _execute(cur, "DELETE FROM detalles_template WHERE template_id = ?", (template_id,))
        for prod in template.get('productos', []):
            _execute(
                cur,
                "INSERT INTO detalles_template (template_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                (template_id, prod['producto_id'], prod['cantidad'], prod.get('tipo', 'unidad'))
            )
            
        return {"id": template_id, **template}


def delete_pedido_template(template_id: int) -> Dict[str, Any]:
    """Elimina un template de pedido."""
    with get_db_transaction() as (con, cur):
        # Trigger debería encargarse de los detalles, pero por si acaso
        _execute(cur, "DELETE FROM detalles_template WHERE template_id = ?", (template_id,))
        _execute(cur, "DELETE FROM pedidos_template WHERE id = ?", (template_id,))
        return {"status": "deleted"}


def crear_pedido_desde_template(template_id: int, usuario: str) -> Optional[int]:
    """Crea un pedido real desde un template"""
    with get_db_transaction() as (con, cur):
        _execute(cur, "SELECT * FROM pedidos_template WHERE id = ?", (template_id,))
        template = _fetchone_as_dict(cur)
        if not template:
            return None
        template = dict(template)
        
        _execute(
            cur,
            """INSERT INTO pedidos (cliente_id, fecha, pdf_generado, fecha_creacion, creado_por)
               VALUES (?, ?, 0, ?, ?)""",
            (template.get("cliente_id"), datetime.now().strftime("%Y-%m-%d"), _now_uruguay(), usuario)
        )
        pedido_id = cur.lastrowid
        
        _execute(
            cur,
            """INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, tipo)
               SELECT ?, producto_id, cantidad, tipo FROM detalles_template WHERE template_id = ?""",
            (pedido_id, template_id)
        )
        
        _execute(cur, "UPDATE pedidos_template SET ultima_ejecucion = ? WHERE id = ?", (_now_uruguay(), template_id))
        return pedido_id


def get_ultimo_pedido_cliente(cliente_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene el último pedido de un cliente para poder repetirlo"""
    with get_db_connection() as con:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        cliente_col = "cliente_id" if "cliente_id" in cols else "id_cliente"
        
        _execute(
            cur,
            f"SELECT id, fecha FROM pedidos WHERE {cliente_col} = ? ORDER BY fecha DESC, id DESC LIMIT 1",
            (cliente_id,)
        )
        pedido = cur.fetchone()
        if not pedido:
            return None
        
        _execute(
            cur,
            """SELECT dp.producto_id, dp.cantidad, dp.tipo, p.nombre, p.precio
               FROM detalles_pedido dp JOIN productos p ON dp.producto_id = p.id
               WHERE dp.pedido_id = ?""",
            (pedido[0],)
        )
        productos = _fetchall_as_dict(cur)
        return {"pedido_id": pedido[0], "fecha": pedido[1], "productos": productos}


# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------
def get_tags() -> List[Dict[str, Any]]:
    """Obtiene todos los tags."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(cur, "SELECT id, nombre, color, icono, tipo FROM tags ORDER BY nombre")
        return _fetchall_as_dict(cur)


def add_tag(tag: Dict[str, Any]) -> Dict[str, Any]:
    """Crea un nuevo tag."""
    with get_db_transaction() as (con, cur):
        nombre = (tag.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre es requerido"}
        
        _execute(cur, "SELECT id FROM tags WHERE LOWER(nombre) = LOWER(?)", (nombre,))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe un tag con el nombre '{nombre}'"}
        
        _execute(
            cur,
            "INSERT INTO tags (nombre, color, icono, tipo) VALUES (?, ?, ?, ?)",
            (nombre, tag.get('color', '#6366f1'), tag.get('icono', '🏷️'), tag.get('tipo', 'general'))
        )
        tag['id'] = cur.lastrowid
        return tag


def update_tag(tag_id: int, tag: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un tag."""
    with get_db_transaction() as (con, cur):
        nombre = (tag.get("nombre") or "").strip()
        if not nombre:
            con.rollback()
            return {"error": "El nombre es requerido"}
        
        _execute(cur, "SELECT id FROM tags WHERE LOWER(nombre) = LOWER(?) AND id != ?", (nombre, tag_id))
        if cur.fetchone():
            con.rollback()
            return {"error": f"Ya existe otro tag con el nombre '{nombre}'"}
        
        _execute(
            cur,
            "UPDATE tags SET nombre = ?, color = ?, icono = ?, tipo = ? WHERE id = ?",
            (nombre, tag.get('color'), tag.get('icono'), tag.get('tipo'), tag_id)
        )
        return {"id": tag_id, **tag}


def delete_tag(tag_id: int) -> Dict[str, Any]:
    """Elimina un tag."""
    with get_db_transaction() as (con, cur):
        # Trigger debería encargarse de productos_tags, pero por si acaso
        _execute(cur, "DELETE FROM productos_tags WHERE tag_id = ?", (tag_id,))
        _execute(cur, "DELETE FROM tags WHERE id = ?", (tag_id,))
        return {"status": "deleted"}


def get_tags_for_producto(producto_id: int) -> List[Dict[str, Any]]:
    """Obtiene los tags de un producto específico."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            """SELECT t.id, t.nombre, t.color, t.icono, t.tipo
               FROM tags t
               JOIN productos_tags pt ON t.id = pt.tag_id
               WHERE pt.producto_id = ?""",
            (producto_id,)
        )
        return _fetchall_as_dict(cur)


def set_tags_for_producto(producto_id: int, tag_ids: List[int]) -> Dict[str, Any]:
    """Establece los tags para un producto, reemplazando los existentes."""
    with get_db_transaction() as (con, cur):
        # Borrar tags existentes para este producto
        _execute(cur, "DELETE FROM productos_tags WHERE producto_id = ?", (producto_id,))
        
        # Añadir nuevos tags
        if tag_ids:
            for tag_id in tag_ids:
                _execute(
                    cur,
                    "INSERT INTO productos_tags (producto_id, tag_id) VALUES (?, ?)",
                    (producto_id, tag_id)
                )
        
        return {"status": "ok", "producto_id": producto_id, "tag_ids": tag_ids}


def get_productos_by_tag(tag_id: int) -> List[Dict[str, Any]]:
    """Obtiene productos que tienen un tag específico."""
    with get_db_connection() as con:
        cur = con.cursor()
        _execute(
            cur,
            """SELECT p.id, p.nombre, p.precio, p.stock, p.imagen_url
               FROM productos p
               JOIN productos_tags pt ON p.id = pt.producto_id
               WHERE pt.tag_id = ?
               ORDER BY p.nombre""",
            (tag_id,)
        )
        return _fetchall_as_dict(cur)
