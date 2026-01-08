import os
import re
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from contextlib import contextmanager

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")

# Timezone Uruguay (UTC-3)
URUGUAY_TZ = timezone(timedelta(hours=-3))


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


def conectar() -> sqlite3.Connection:
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


@contextmanager
def get_db_connection():
    """Context manager para conexiones de base de datos con manejo automático de errores"""
    con = conectar()
    try:
        yield con
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


@contextmanager
def get_db_transaction():
    """Context manager para transacciones atómicas"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("BEGIN TRANSACTION")
        yield con, cur
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


# Lista blanca de tablas válidas para prevenir SQL injection
VALID_TABLES = {
    'clientes', 'productos', 'pedidos', 'detalles_pedido', 'usuarios',
    'categorias', 'ofertas', 'audit_log', 'historial_pedidos', 'revoked_tokens',
    'listas_precios', 'precios_lista', 'pedidos_template', 'detalles_template',
    'oferta_productos', 'tags', 'productos_tags'
}

def _table_columns(cur: sqlite3.Cursor, table: str) -> List[str]:
    # Validar nombre de tabla contra lista blanca
    if table not in VALID_TABLES:
        raise ValueError(f"Tabla no válida: {table}")
    cur.execute(f"PRAGMA table_info({table})")
    return [r[1] for r in cur.fetchall()]


def _has_column(cur: sqlite3.Cursor, table: str, col: str) -> bool:
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

def _ensure_column(cur: sqlite3.Cursor, table: str, col: str, type_def: str) -> None:
    # Validate all parameters to prevent SQL injection
    _validate_sql_identifier(col, 'column')
    _validate_type_def(type_def)
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table!r}")
    
    if not _has_column(cur, table, col):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {type_def}")


def ensure_schema() -> None:
    """
    Crea tablas si no existen (para instalaciones nuevas) y agrega columnas nuevas
    de forma segura (ALTER TABLE) si faltan.
    """
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
        # Estados: tomado → preparando → listo → entregado (o cancelado)
        _ensure_column(cur, "pedidos", "estado", "TEXT DEFAULT 'tomado'")
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


def _get_tables(cur: sqlite3.Cursor) -> List[str]:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1")
    return [r[0] for r in cur.fetchall()]


def ensure_indexes() -> None:
    """Create performance indexes on key columns."""
    con = conectar()
    try:
        cur = con.cursor()
        # Index on usuarios.username for auth lookups
        cur.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)")
        # Index on pedidos.cliente_id for filtering
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id)")
        # Index on detalles_pedido.pedido_id for joins
        cur.execute("CREATE INDEX IF NOT EXISTS idx_detalles_pedido_pedido_id ON detalles_pedido(pedido_id)")
        # Index on detalles_pedido.producto_id for joins
        cur.execute("CREATE INDEX IF NOT EXISTS idx_detalles_pedido_producto_id ON detalles_pedido(producto_id)")
        
        # NEW: Performance indexes for searches (Semana 1)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_stock ON productos(stock)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_creacion ON pedidos(fecha_creacion)")
        
        # Indexes for categorías
        cur.execute("CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre)")
        
        # Indexes for audit_log
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON audit_log(tabla)")
        
        con.commit()
    finally:
        con.close()


def ensure_cascade_triggers() -> None:
    """
    Crea triggers para simular CASCADE DELETE en SQLite.
    Asegura que al eliminar una lista de precios, se eliminen sus precios especiales.
    """
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
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT id, nombre, telefono, direccion, zona, lista_precio_id FROM clientes WHERE id = ?",
            (cliente_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def get_clientes(page: Optional[int] = None, limit: int = 50, search: Optional[str] = None) -> Dict[str, Any]:
    """
    Obtiene clientes con paginación opcional.
    Si page es None, devuelve todos (formato lista para compatibilidad).
    Si page es número, devuelve objeto con data, total, page, pages.
    """
    con = conectar()
    try:
        cur = con.cursor()
        
        # Construir query base
        base_query = "FROM clientes"
        params: List[Any] = []
        
        if search:
            base_query += " WHERE LOWER(nombre) LIKE ? OR LOWER(telefono) LIKE ? OR LOWER(direccion) LIKE ? OR LOWER(zona) LIKE ?"
            search_term = f"%{search.lower()}%"
            params = [search_term, search_term, search_term, search_term]
        
        # Contar total
        cur.execute(f"SELECT COUNT(*) {base_query}", tuple(params))
        total = cur.fetchone()[0]
        
        # Si no hay paginación, devolver lista simple (compatibilidad)
        if page is None:
            cur.execute(f"SELECT id, nombre, telefono, direccion, zona, lista_precio_id {base_query} ORDER BY nombre", tuple(params))
            return [dict(r) for r in cur.fetchall()]
        
        # Con paginación
        offset = (page - 1) * limit
        pages = (total + limit - 1) // limit if limit > 0 else 1
        
        cur.execute(
            f"SELECT id, nombre, telefono, direccion, zona, lista_precio_id {base_query} ORDER BY nombre LIMIT ? OFFSET ?",
            tuple(params) + (limit, offset)
        )
        
        return {
            "data": [dict(r) for r in cur.fetchall()],
            "total": total,
            "page": page,
            "pages": pages,
            "limit": limit
        }
    finally:
        con.close()


def add_cliente(cliente: Dict[str, Any]) -> Dict[str, Any]:
    con = conectar()
    try:
        cur = con.cursor()
        # Validar duplicado por nombre (case-insensitive)
        nombre = (cliente.get("nombre") or "").strip()
        if nombre:
            cur.execute(
                "SELECT id FROM clientes WHERE nombre = ? COLLATE NOCASE LIMIT 1",
                (nombre,),
            )
            if cur.fetchone():
                return {"error": "CLIENTE_DUPLICADO", "detail": f"El cliente '{nombre}' ya existe"}

        cur.execute(
            "INSERT INTO clientes (nombre, telefono, direccion, zona) VALUES (?, ?, ?, ?)",
            (nombre, cliente.get("telefono", ""), cliente.get("direccion", ""), cliente.get("zona", "")),
        )
        con.commit()
        cliente["id"] = cur.lastrowid
        cliente["nombre"] = nombre
        return cliente
    finally:
        con.close()


def update_cliente(cliente_id: int, cliente: Dict[str, Any]) -> Dict[str, Any]:
    con = conectar()
    try:
        cur = con.cursor()
        # Validar duplicado si se modifica nombre
        nombre = cliente.get("nombre")
        if nombre is not None:
            nombre = (str(nombre) or "").strip()
            cur.execute(
                "SELECT id FROM clientes WHERE nombre = ? COLLATE NOCASE AND id != ? LIMIT 1",
                (nombre, cliente_id),
            )
            if cur.fetchone():
                return {"error": "CLIENTE_DUPLICADO", "detail": f"El cliente '{nombre}' ya existe"}
        else:
            nombre = None
        
        # Obtener valores para actualizar
        nombre_final = nombre if nombre is not None else cliente.get("nombre")
        telefono = cliente.get("telefono", "")
        direccion = cliente.get("direccion", "")
        lista_precio_id = cliente.get("lista_precio_id")
        
        # Validar que lista_precio_id exista si se proporciona
        if lista_precio_id is not None:
            cur.execute("SELECT id FROM listas_precios WHERE id = ?", (lista_precio_id,))
            if not cur.fetchone():
                return {"error": "LISTA_NO_EXISTE", "detail": f"Lista de precios {lista_precio_id} no existe"}
        
        zona = cliente.get("zona", "")
        cur.execute(
            "UPDATE clientes SET nombre=?, telefono=?, direccion=?, zona=?, lista_precio_id=? WHERE id=?",
            (nombre_final, telefono, direccion, zona, lista_precio_id, cliente_id),
        )
        con.commit()
        return {"status": "updated"}
    finally:
        con.close()


def delete_cliente(cliente_id: int) -> Dict[str, Any]:
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
        con.commit()
        return {"status": "deleted"}
    finally:
        con.close()


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
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT id, nombre, telefono, direccion, zona FROM clientes ORDER BY nombre")
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
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Categorías
# -----------------------------------------------------------------------------
def get_categorias(incluir_inactivas: bool = False) -> List[Dict[str, Any]]:
    """Obtiene todas las categorías ordenadas."""
    con = conectar()
    try:
        cur = con.cursor()
        query = "SELECT id, nombre, descripcion, color, orden, activa, fecha_creacion FROM categorias"
        if not incluir_inactivas:
            query += " WHERE activa = 1"
        query += " ORDER BY orden, nombre"
        cur.execute(query)
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_categoria_by_id(categoria_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una categoría por su ID."""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT id, nombre, descripcion, color, orden, activa, fecha_creacion FROM categorias WHERE id = ?",
            (categoria_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def add_categoria(categoria: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva categoría."""
    con = conectar()
    try:
        cur = con.cursor()
        nombre = (categoria.get("nombre") or "").strip()
        if not nombre:
            return {"error": "El nombre es requerido"}
        
        # Verificar duplicados
        cur.execute("SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?)", (nombre,))
        if cur.fetchone():
            return {"error": f"Ya existe una categoría con el nombre '{nombre}'"}
        
        descripcion = categoria.get("descripcion", "")
        color = categoria.get("color", "#6366f1")
        orden = categoria.get("orden", 0)
        
        cur.execute(
            "INSERT INTO categorias (nombre, descripcion, color, orden, activa, fecha_creacion) VALUES (?, ?, ?, ?, 1, ?)",
            (nombre, descripcion, color, orden, _now_uruguay_iso())
        )
        con.commit()
        return {"id": cur.lastrowid, "nombre": nombre, "descripcion": descripcion, "color": color, "orden": orden}
    finally:
        con.close()


def update_categoria(categoria_id: int, categoria: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza una categoría existente."""
    con = conectar()
    try:
        cur = con.cursor()
        nombre = (categoria.get("nombre") or "").strip()
        if not nombre:
            return {"error": "El nombre es requerido"}
        
        # Verificar que existe
        cur.execute("SELECT id FROM categorias WHERE id = ?", (categoria_id,))
        if not cur.fetchone():
            return {"error": "Categoría no encontrada"}
        
        # Verificar duplicados (excluyendo esta)
        cur.execute("SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND id != ?", (nombre, categoria_id))
        if cur.fetchone():
            return {"error": f"Ya existe otra categoría con el nombre '{nombre}'"}
        
        descripcion = categoria.get("descripcion", "")
        color = categoria.get("color", "#6366f1")
        orden = categoria.get("orden", 0)
        activa = 1 if categoria.get("activa", True) else 0
        
        cur.execute(
            "UPDATE categorias SET nombre = ?, descripcion = ?, color = ?, orden = ?, activa = ? WHERE id = ?",
            (nombre, descripcion, color, orden, activa, categoria_id)
        )
        con.commit()
        return {"id": categoria_id, "nombre": nombre, "descripcion": descripcion, "color": color, "orden": orden, "activa": bool(activa)}
    finally:
        con.close()


def delete_categoria(categoria_id: int) -> Dict[str, Any]:
    """Elimina una categoría (o desactiva si tiene productos)."""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Verificar si tiene productos asociados
        cur.execute("SELECT COUNT(*) FROM productos WHERE categoria_id = ?", (categoria_id,))
        count = cur.fetchone()[0]
        
        if count > 0:
            # Solo desactivar, no eliminar
            cur.execute("UPDATE categorias SET activa = 0 WHERE id = ?", (categoria_id,))
            con.commit()
            return {"status": "deactivated", "message": f"Categoría desactivada (tiene {count} productos)"}
        else:
            cur.execute("DELETE FROM categorias WHERE id = ?", (categoria_id,))
            con.commit()
            return {"status": "deleted", "message": "Categoría eliminada"}
    finally:
        con.close()


def get_productos_por_categoria(categoria_id: int) -> List[Dict[str, Any]]:
    """Obtiene productos de una categoría específica."""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT id, nombre, precio, stock, imagen_url FROM productos WHERE categoria_id = ? ORDER BY nombre",
            (categoria_id,)
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def asignar_categoria_producto(producto_id: int, categoria_id: Optional[int]) -> Dict[str, Any]:
    """Asigna o quita una categoría a un producto."""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("UPDATE productos SET categoria_id = ? WHERE id = ?", (categoria_id, producto_id))
        con.commit()
        return {"status": "ok", "producto_id": producto_id, "categoria_id": categoria_id}
    finally:
        con.close()


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
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute(
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
        con.commit()
    finally:
        con.close()


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
    con = conectar()
    try:
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
        cur.execute(count_query, tuple(params))
        total = cur.fetchone()[0]
        
        # Get data
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        cur.execute(query, tuple(params))
        
        logs = []
        for row in cur.fetchall():
            log = dict(row)
            # Parse JSON fields
            if log.get("datos_antes"):
                try:
                    log["datos_antes"] = json.loads(log["datos_antes"])
                except:
                    pass
            if log.get("datos_despues"):
                try:
                    log["datos_despues"] = json.loads(log["datos_despues"])
                except:
                    pass
            logs.append(log)
        
        return {
            "data": logs,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    finally:
        con.close()


def get_audit_summary() -> Dict[str, Any]:
    """Resumen de actividad del audit log."""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Total de acciones hoy
        cur.execute(
            "SELECT COUNT(*) FROM audit_log WHERE DATE(timestamp) = DATE('now')"
        )
        hoy = cur.fetchone()[0]
        
        # Por tabla
        cur.execute(
            "SELECT tabla, COUNT(*) as count FROM audit_log GROUP BY tabla ORDER BY count DESC LIMIT 10"
        )
        por_tabla = [{"tabla": r[0], "count": r[1]} for r in cur.fetchall()]
        
        # Por usuario (últimos 7 días)
        cur.execute(
            """SELECT usuario, COUNT(*) as count FROM audit_log 
               WHERE timestamp >= datetime('now', '-7 days')
               GROUP BY usuario ORDER BY count DESC LIMIT 10"""
        )
        por_usuario = [{"usuario": r[0], "count": r[1]} for r in cur.fetchall()]
        
        # Últimas 10 acciones
        cur.execute(
            "SELECT timestamp, usuario, accion, tabla FROM audit_log ORDER BY timestamp DESC LIMIT 10"
        )
        ultimas = [{"timestamp": r[0], "usuario": r[1], "accion": r[2], "tabla": r[3]} for r in cur.fetchall()]
        
        return {
            "acciones_hoy": hoy,
            "por_tabla": por_tabla,
            "por_usuario": por_usuario,
            "ultimas_acciones": ultimas
        }
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Productos
# -----------------------------------------------------------------------------
def get_productos(search: Optional[str] = None, sort: Optional[str] = None, categoria_id: Optional[int] = None) -> List[Dict[str, Any]]:
    con = conectar()
    try:
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

        cur.execute(base + order, tuple(params))
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_producto_by_id(producto_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un producto por su ID"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT * FROM productos WHERE id = ?", (producto_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def add_producto(producto: Dict[str, Any]) -> Dict[str, Any]:
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")

        fields = ["nombre", "precio"]
        nombre = (producto.get("nombre") or "").strip()
        precio = float(producto.get("precio"))

        # Validar duplicado por nombre (case-insensitive)
        if nombre:
            cur.execute(
                "SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE LIMIT 1",
                (nombre,),
            )
            if cur.fetchone():
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

        cur.execute(
            f"INSERT INTO productos ({', '.join(fields)}) VALUES ({', '.join(['?'] * len(fields))})",
            tuple(values),
        )
        con.commit()
        producto["id"] = cur.lastrowid
        producto["nombre"] = nombre
        producto["precio"] = precio
        return producto
    finally:
        con.close()

# Helpers de existencia
def cliente_existe(nombre: str) -> bool:
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT id FROM clientes WHERE nombre = ? COLLATE NOCASE LIMIT 1", (nombre.strip(),))
        return cur.fetchone() is not None
    finally:
        con.close()

def producto_existe(nombre: str) -> bool:
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE LIMIT 1", (nombre.strip(),))
        return cur.fetchone() is not None
    finally:
        con.close()


def update_producto(producto_id: int, producto: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza fields permitidos de un producto (nombre, precio, imagen_url) si existen."""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")

        fields = []
        values: List[Any] = []

        if "nombre" in producto and producto.get("nombre") is not None and "nombre" in cols:
            nombre = (str(producto.get("nombre")) or "").strip()
            # Validar duplicado con otro id
            cur.execute(
                "SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE AND id != ? LIMIT 1",
                (nombre, producto_id),
            )
            if cur.fetchone():
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
        cur.execute(f"UPDATE productos SET {', '.join(fields)} WHERE id = ?", tuple(values))
        con.commit()

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
        cur.execute(f"SELECT {', '.join(sel)} FROM productos WHERE id = ?", (producto_id,))
        row = cur.fetchone()
        return dict(row) if row else {"status": "not_found"}
    finally:
        con.close()


def delete_producto(producto_id: int) -> Dict[str, Any]:
    """Elimina un producto si no tiene pedidos asociados"""
    con = conectar()
    try:
        cur = con.cursor()
        # Verificar si el producto existe
        cur.execute("SELECT id, nombre FROM productos WHERE id = ?", (producto_id,))
        producto = cur.fetchone()
        if not producto:
            return {"status": "not_found", "message": "Producto no encontrado"}
        
        # Verificar si tiene pedidos asociados
        cur.execute("SELECT COUNT(*) FROM detalles_pedido WHERE producto_id = ?", (producto_id,))
        pedidos_count = cur.fetchone()[0]
        if pedidos_count > 0:
            return {"status": "error", "message": f"No se puede eliminar el producto porque tiene {pedidos_count} pedido(s) asociado(s)"}
        
        # Eliminar de tablas relacionadas (usando nombres correctos de tablas)
        cur.execute("DELETE FROM oferta_productos WHERE producto_id = ?", (producto_id,))
        cur.execute("DELETE FROM precios_lista WHERE producto_id = ?", (producto_id,))
        cur.execute("DELETE FROM detalles_template WHERE producto_id = ?", (producto_id,))
        
        # Eliminar el producto
        cur.execute("DELETE FROM productos WHERE id = ?", (producto_id,))
        con.commit()
        
        return {"status": "ok", "message": f"Producto '{producto['nombre']}' eliminado correctamente"}
    finally:
        con.close()


def export_productos_csv() -> str:
    """Exporta todos los productos a formato CSV (Excel compatible)"""
    con = conectar()
    try:
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
        
        cur.execute(query)
        rows = cur.fetchall()
        
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
    finally:
        con.close()


def update_stock(producto_id: int, cantidad: int, operacion: str = "restar") -> Dict[str, Any]:
    """Actualiza el stock de un producto. operacion: 'sumar' o 'restar'"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")
        if "stock" not in cols:
            return {"error": "Stock no soportado"}
        
        # Obtener stock actual
        cur.execute("SELECT stock FROM productos WHERE id = ?", (producto_id,))
        row = cur.fetchone()
        if not row:
            return {"error": "Producto no encontrado"}
        
        stock_actual = row["stock"] or 0
        
        if operacion == "restar":
            nuevo_stock = max(0, stock_actual - cantidad)
        else:
            nuevo_stock = stock_actual + cantidad
        
        cur.execute("UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))
        con.commit()
        return {"id": producto_id, "stock_anterior": stock_actual, "stock_nuevo": nuevo_stock}
    finally:
        con.close()


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
    
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")
        if "stock" not in cols:
            return {"error": "Stock no soportado en esta versión de la base de datos"}
        
        updated = []
        
        for p in productos:
            producto_id = p.get("id")
            cantidad = p.get("cantidad", 0)
            
            if not producto_id or cantidad <= 0:
                continue
            
            # Obtener stock actual
            cur.execute("SELECT id, nombre, stock FROM productos WHERE id = ?", (producto_id,))
            row = cur.fetchone()
            
            if not row:
                con.rollback()
                return {"error": f"Producto ID {producto_id} no encontrado"}
            
            stock_actual = row["stock"] or 0
            
            if operacion == "restar":
                nuevo_stock = max(0, stock_actual - cantidad)
            else:
                nuevo_stock = stock_actual + cantidad
            
            cur.execute("UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))
            
            updated.append({
                "id": producto_id,
                "nombre": row["nombre"],
                "stock_anterior": stock_actual,
                "stock_nuevo": nuevo_stock,
                "cantidad": cantidad
            })
        
        con.commit()
        return {"ok": True, "updated": updated, "count": len(updated)}
    
    except Exception as e:
        con.rollback()
        return {"error": f"Error en actualización de stock: {str(e)}"}
    finally:
        con.close()


def verificar_stock_pedido(productos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Verifica si hay stock suficiente para los productos del pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "productos")
        if "stock" not in cols:
            return []  # Sin control de stock
        
        errores = []
        for p in productos:
            producto_id = p.get("id")
            cantidad = p.get("cantidad", 1)
            
            cur.execute("SELECT nombre, stock FROM productos WHERE id = ?", (producto_id,))
            row = cur.fetchone()
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
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Pedidos
# -----------------------------------------------------------------------------
def _pedidos_cliente_col(cur: sqlite3.Cursor) -> str:
    cols = _table_columns(cur, "pedidos")
    return "cliente_id" if "cliente_id" in cols else "id_cliente"


def _detalles_pedido_col(cur: sqlite3.Cursor) -> str:
    cols = _table_columns(cur, "detalles_pedido")
    return "pedido_id" if "pedido_id" in cols else "id_pedido"


def _detalles_producto_col(cur: sqlite3.Cursor) -> str:
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
            raise Exception("Pedido inválido: falta cliente_id / cliente.id")

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

        cur.execute(
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
                    raise Exception("Producto inválido en pedido: falta id/producto_id y nombre")
                cur.execute("SELECT id FROM productos WHERE nombre = ? LIMIT 1", (nombre,))
                r = cur.fetchone()
                if not r:
                    raise Exception(f"Producto no existe en DB: {nombre}")
                product_id = r["id"]

            cantidad = float(prod.get("cantidad", 0))
            tipo = prod.get("tipo", "unidad")

            if "tipo" in cols_det:
                cur.execute(
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad, tipo) VALUES (?, ?, ?, ?)",
                    (pid, product_id, cantidad, tipo),
                )
            else:
                cur.execute(
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
        estado: Filtrar por estado (tomado, preparando, listo, entregado, cancelado).
        creado_por: Filtrar por usuario que creó el pedido (para rol 'ventas').
    
    Returns:
        Sin paginación: Lista de pedidos (compatibilidad hacia atrás).
        Con paginación: Dict con {data: [], total: int, page: int, limit: int, pages: int}.
    
    OPTIMIZADO: Usa batch loading para eliminar N+1 queries.
    """
    con = conectar()
    try:
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
            # Handle 'tomado' as default for NULL estado
            if estado == 'tomado':
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
        cur.execute(count_query, params)
        total_count = cur.fetchone()[0]

        # Build main query with pagination
        base_query = f"SELECT {', '.join(sel)} FROM pedidos {where_clause} ORDER BY id DESC"
        
        if page is not None:
            offset = (page - 1) * limit
            base_query += f" LIMIT {limit} OFFSET {offset}"
        
        cur.execute(base_query, params)
        pedidos_rows = cur.fetchall()

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
        
        cur.execute(
            f"""SELECT {sel_cols} 
                FROM detalles_pedido dp 
                JOIN productos pr ON dp.{prod_fk} = pr.id 
                WHERE dp.{pedido_fk} IN ({placeholders})""",
            pedido_ids
        )
        
        # Group productos by pedido_id
        productos_por_pedido: Dict[int, List[Dict]] = {}
        for rr in cur.fetchall():
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
        # Get column names for safe access (sqlite3.Row doesn't have .get())
        col_names = set(sel)
        
        def safe_get(row, col, default=None):
            """Safely get value from sqlite3.Row."""
            if col in col_names:
                val = row[col]
                return val if val is not None else default
            return default
        
        pedidos: List[Dict[str, Any]] = []
        for r in pedidos_rows:
            pid = r["id"]
            pedido = {
                "id": pid,
                "cliente_id": r[cliente_col],
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
                "estado": safe_get(r, "estado", "tomado"),
                "repartidor": safe_get(r, "repartidor"),
                "fecha_entrega": safe_get(r, "fecha_entrega"),
                "productos": productos_por_pedido.get(pid, []),
            }
            pedidos.append(pedido)

        # Return with pagination info or just list
        if page is not None:
            pages = (total_count + limit - 1) // limit  # Ceiling division
            return {
                "data": pedidos,
                "total": total_count,
                "page": page,
                "limit": limit,
                "pages": pages
            }
        
        return pedidos
    finally:
        con.close()


def delete_pedido(pedido_id: int) -> Dict[str, Any]:
    """Elimina un pedido y todos sus registros relacionados (detalles, historial)."""
    con = conectar()
    try:
        cur = con.cursor()
        pedido_fk = _detalles_pedido_col(cur)

        # Eliminar en orden: primero tablas dependientes, luego pedido principal
        cur.execute(f"DELETE FROM detalles_pedido WHERE {pedido_fk} = ?", (pedido_id,))
        
        # Eliminar historial de modificaciones si existe
        cols = _table_columns(cur, "historial_pedidos") if "historial_pedidos" in [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()] else []
        if cols:
            cur.execute("DELETE FROM historial_pedidos WHERE pedido_id = ?", (pedido_id,))
        
        cur.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
        con.commit()
        return {"status": "deleted"}
    finally:
        con.close()


def _pedido_pendiente(cur: sqlite3.Cursor, pedido_id: int) -> bool:
    cols = _table_columns(cur, "pedidos")
    if "pdf_generado" not in cols:
        return True
    cur.execute("SELECT pdf_generado FROM pedidos WHERE id = ?", (pedido_id,))
    r = cur.fetchone()
    if not r:
        return False
    return int(r["pdf_generado"] or 0) == 0


def add_pedido_item(pedido_id: int, producto_id: int, cantidad: float, tipo: str = "unidad") -> Dict[str, Any]:
    """Agrega o actualiza un ítem del pedido pendiente."""
    con = conectar()
    try:
        cur = con.cursor()
        if not _pedido_pendiente(cur, pedido_id):
            return {"error": "PEDIDO_YA_GENERADO", "detail": "No se puede editar un pedido ya generado"}

        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        cols_det = _table_columns(cur, "detalles_pedido")

        # Si ya existe, actualizamos
        cur.execute(
            f"SELECT id FROM detalles_pedido WHERE {pedido_fk} = ? AND {prod_fk} = ? LIMIT 1",
            (pedido_id, producto_id),
        )
        r = cur.fetchone()
        if r:
            # update path
            if "tipo" in cols_det:
                cur.execute(
                    f"UPDATE detalles_pedido SET cantidad = ?, tipo = ? WHERE id = ?",
                    (float(cantidad), tipo, r["id"]),
                )
            else:
                cur.execute(
                    f"UPDATE detalles_pedido SET cantidad = ? WHERE id = ?",
                    (float(cantidad), r["id"]),
                )
        else:
            # insert path
            if "tipo" in cols_det:
                cur.execute(
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad, tipo) VALUES (?, ?, ?, ?)",
                    (pedido_id, producto_id, float(cantidad), tipo),
                )
            else:
                cur.execute(
                    f"INSERT INTO detalles_pedido ({pedido_fk}, {prod_fk}, cantidad) VALUES (?, ?, ?)",
                    (pedido_id, producto_id, float(cantidad)),
                )

        con.commit()
        return {"status": "ok"}
    finally:
        con.close()


def update_pedido_item(pedido_id: int, producto_id: int, cantidad: float, tipo: Optional[str] = None) -> Dict[str, Any]:
    """Actualiza cantidad/tipo de un ítem de pedido pendiente."""
    con = conectar()
    try:
        cur = con.cursor()
        if not _pedido_pendiente(cur, pedido_id):
            return {"error": "PEDIDO_YA_GENERADO", "detail": "No se puede editar un pedido ya generado"}

        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        cols_det = _table_columns(cur, "detalles_pedido")

        cur.execute(
            f"SELECT id FROM detalles_pedido WHERE {pedido_fk} = ? AND {prod_fk} = ? LIMIT 1",
            (pedido_id, producto_id),
        )
        r = cur.fetchone()
        if not r:
            return {"error": "ITEM_NO_EXISTE", "detail": "El ítem no existe en el pedido"}

        fields = ["cantidad = ?"]
        values: List[Any] = [float(cantidad)]
        if tipo is not None and "tipo" in cols_det:
            fields.append("tipo = ?")
            values.append(tipo)
        values.append(r["id"])

        cur.execute(f"UPDATE detalles_pedido SET {', '.join(fields)} WHERE id = ?", tuple(values))
        con.commit()
        return {"status": "ok"}
    finally:
        con.close()


def delete_pedido_item(pedido_id: int, producto_id: int) -> Dict[str, Any]:
    """Elimina un ítem de un pedido pendiente."""
    con = conectar()
    try:
        cur = con.cursor()
        if not _pedido_pendiente(cur, pedido_id):
            return {"error": "PEDIDO_YA_GENERADO", "detail": "No se puede editar un pedido ya generado"}

        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        cur.execute(
            f"DELETE FROM detalles_pedido WHERE {pedido_fk} = ? AND {prod_fk} = ?",
            (pedido_id, producto_id),
        )
        con.commit()
        return {"status": "deleted"}
    finally:
        con.close()


def update_pedido_estado(pedido_id: int, estado: Any, generado_por: str = None) -> Dict[str, Any]:
    """
    Actualiza el estado del pedido (pdf_generado) y opcionalmente registra
    fecha_generacion y usuario que generó el PDF.
    """
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        if "pdf_generado" not in cols:
            raise Exception("La tabla pedidos no tiene columna pdf_generado")

        # Construir query dinámicamente según columnas disponibles
        updates = ["pdf_generado = ?"]
        values = [int(bool(estado))]
        
        # Si se está marcando como generado, agregar timestamp y usuario
        if estado and "fecha_generacion" in cols:
            updates.append("fecha_generacion = ?")
            values.append(_now_uruguay())
        
        if estado and generado_por and "generado_por" in cols:
            updates.append("generado_por = ?")
            values.append(generado_por)
        
        values.append(pedido_id)
        
        cur.execute(f"UPDATE pedidos SET {', '.join(updates)} WHERE id = ?", tuple(values))
        con.commit()
        return {"id": pedido_id, "pdf_generado": bool(estado)}
    finally:
        con.close()


# === ESTADOS DE PEDIDO WORKFLOW ===
# Estados válidos: tomado → preparando → listo → entregado (o cancelado en cualquier punto)
ESTADOS_PEDIDO_VALIDOS = ["tomado", "preparando", "listo", "entregado", "cancelado"]

def update_pedido_workflow(pedido_id: int, nuevo_estado: str, repartidor: str = None, usuario: str = None) -> Dict[str, Any]:
    """
    Actualiza el estado del workflow del pedido.
    Estados: tomado → preparando → listo → entregado (o cancelado)
    """
    if nuevo_estado not in ESTADOS_PEDIDO_VALIDOS:
        raise ValueError(f"Estado inválido: {nuevo_estado}. Válidos: {ESTADOS_PEDIDO_VALIDOS}")
    
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        
        if "estado" not in cols:
            raise Exception("La tabla pedidos no tiene columna estado")
        
        updates = ["estado = ?"]
        values = [nuevo_estado]
        
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
        cur.execute(f"UPDATE pedidos SET {', '.join(updates)} WHERE id = ?", tuple(values))
        
        # Registrar en historial si existe la tabla
        tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        if "historial_pedidos" in tables:
            cur.execute("""
                INSERT INTO historial_pedidos (pedido_id, accion, usuario, fecha, detalles)
                VALUES (?, ?, ?, ?, ?)
            """, (pedido_id, "cambio_estado", usuario or "sistema", _now_uruguay(), f"Estado cambiado a: {nuevo_estado}"))
        
        con.commit()
        return {"id": pedido_id, "estado": nuevo_estado, "repartidor": repartidor}
    finally:
        con.close()


def get_pedidos_por_estado(estado: str = None) -> List[Dict[str, Any]]:
    """
    Obtiene pedidos filtrados por estado.
    Si estado es None, devuelve todos.
    """
    pedidos = get_pedidos()
    if estado is None:
        return pedidos
    return [p for p in pedidos if p.get("estado", "tomado") == estado]


def get_pedidos_por_repartidor(repartidor: str) -> List[Dict[str, Any]]:
    """
    Obtiene pedidos asignados a un repartidor específico.
    Útil para la hoja de ruta.
    """
    pedidos = get_pedidos()
    return [p for p in pedidos if p.get("repartidor") == repartidor]


def update_pedido_cliente(pedido_id: int, cliente_id: int) -> Dict[str, Any]:
    """Actualizar el cliente de un pedido existente"""
    con = conectar()
    try:
        cur = con.cursor()
        cliente_col = _pedidos_cliente_col(cur)
        cur.execute(f"UPDATE pedidos SET {cliente_col} = ? WHERE id = ?", (cliente_id, pedido_id))
        con.commit()
        return {"id": pedido_id, "cliente_id": cliente_id}
    finally:
        con.close()


def export_pedidos_csv(desde: Optional[str] = None, hasta: Optional[str] = None) -> str:
    """Exporta pedidos a formato CSV (Excel compatible) con filtro de fechas opcional"""
    con = conectar()
    try:
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
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        
        d = CSV_DELIMITER
        lines = [f"id{d}cliente_id{d}cliente_nombre{d}fecha{d}pdf_generado{d}productos"]
        
        pedido_fk = _detalles_pedido_col(cur)
        prod_fk = _detalles_producto_col(cur)
        
        for r in rows:
            pid = r["id"]
            cliente_nombre = _sanitize_csv_field(r["cliente_nombre"] or "Sin cliente")
            fecha = r["fecha"] or ""
            generado = "Si" if r["pdf_generado"] else "No"
            
            # Obtener productos del pedido
            cur.execute(f"""
                SELECT pr.nombre, dp.cantidad
                FROM detalles_pedido dp
                JOIN productos pr ON dp.{prod_fk} = pr.id
                WHERE dp.{pedido_fk} = ?
            """, (pid,))
            prods = [f"{rp['nombre']}x{rp['cantidad']}" for rp in cur.fetchall()]
            prods_str = _sanitize_csv_field(", ".join(prods))
            
            lines.append(f'{pid}{d}{r["cliente_id"] or ""}{d}"{cliente_nombre}"{d}"{fecha}"{d}{generado}{d}"{prods_str}"')
        
        return CSV_BOM + "\n".join(lines)
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Usuarios
# -----------------------------------------------------------------------------
def _usuarios_user_col(cur: sqlite3.Cursor) -> str:
    cols = _table_columns(cur, "usuarios")
    return "username" if "username" in cols else "nombre_usuario"


def add_usuario(username: str, password_hash: str, rol: str = "usuario") -> bool:
    con = conectar()
    try:
        cur = con.cursor()
        user_col = _usuarios_user_col(cur)
        cols = _table_columns(cur, "usuarios")

        # Ya existe?
        cur.execute(f"SELECT id FROM usuarios WHERE {user_col} = ? COLLATE NOCASE LIMIT 1", (username,))
        if cur.fetchone():
            return False

        # Activo: si existe columna activo -> primer usuario admin/activo=1, resto activo=0
        activo_val: Optional[int] = None
        if "activo" in cols:
            cur.execute("SELECT COUNT(*) AS c FROM usuarios")
            count = int(cur.fetchone()["c"])
            if count == 0:
                rol = "admin"
                activo_val = 1
            else:
                activo_val = 0

        fields = [user_col, "password_hash", "rol"]
        values: List[Any] = [username, password_hash, rol]

        if "activo" in cols:
            fields.append("activo")
            values.append(activo_val if activo_val is not None else 1)

        if "last_login" in cols:
            fields.append("last_login")
            values.append(None)

        cur.execute(
            f"INSERT INTO usuarios ({', '.join(fields)}) VALUES ({', '.join(['?'] * len(fields))})",
            tuple(values),
        )
        con.commit()
        return True
    finally:
        con.close()


# === TOKEN REVOCATION (Logout) ===

def revoke_token(jti: str, expires_at: str, username: str) -> bool:
    """Add a token to the revocation list (logout)"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            INSERT OR IGNORE INTO revoked_tokens (jti, revoked_at, expires_at, username)
            VALUES (?, ?, ?, ?)
        """, (jti, _now_iso(), expires_at, username))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def is_token_revoked(jti: str) -> bool:
    """Check if a token has been revoked"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1", (jti,))
        return cur.fetchone() is not None
    finally:
        con.close()


def get_active_user_if_token_valid(username: str, jti: str) -> Optional[Dict[str, Any]]:
    """
    Atomically check if user is active AND token is not revoked.
    Returns user dict if valid, None if user inactive or token revoked.
    Eliminates TOCTOU race condition between token check and user check.
    """
    con = conectar()
    try:
        cur = con.cursor()
        user_col = _usuarios_user_col(cur)
        cols = _table_columns(cur, "usuarios")

        sel = ["id", user_col, "password_hash", "rol"]
        if "activo" in cols:
            sel.append("activo")
        if "last_login" in cols:
            sel.append("last_login")

        # Single atomic query: user active AND token not revoked
        cur.execute(
            f"""
            SELECT {', '.join(sel)}
            FROM usuarios
            WHERE {user_col} = ? COLLATE NOCASE
            AND activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM revoked_tokens WHERE jti = ?
            )
            LIMIT 1
            """,
            (username, jti),
        )
        row = cur.fetchone()
        if not row:
            return None

        d = dict(row)
        d["username"] = d.get("username") or d.get("user")
        d["activo"] = bool(d.get("activo", 1))
        return d
    finally:
        con.close()


def cleanup_expired_tokens() -> int:
    """Remove expired tokens from the revocation list (run periodically)"""
    con = conectar()
    try:
        cur = con.cursor()
        # Delete tokens that have expired (no longer need to track them)
        cur.execute("DELETE FROM revoked_tokens WHERE expires_at < ?", (_now_iso(),))
        con.commit()
        return cur.rowcount
    finally:
        con.close()


def get_usuario(username: str) -> Optional[Dict[str, Any]]:
    con = conectar()
    try:
        cur = con.cursor()
        user_col = _usuarios_user_col(cur)
        cols = _table_columns(cur, "usuarios")

        # armamos SELECT según columnas existentes
        sel = ["id", user_col, "password_hash", "rol"]
        if "activo" in cols:
            sel.append("activo")
        if "last_login" in cols:
            sel.append("last_login")

        cur.execute(
            f"""
            SELECT {', '.join(sel)}
            FROM usuarios
            WHERE {user_col} = ? COLLATE NOCASE
            LIMIT 1
            """,
            (username,),
        )
        row = cur.fetchone()
        if not row:
            return None

        d = dict(row)
        # Normalizamos key a "username" para que main.py/auth.py estén felices
        if user_col != "username":
            d["username"] = d.get(user_col)
        if "activo" not in d:
            d["activo"] = 1  # fallback si la columna no existe
        return d
    finally:
        con.close()


def set_usuario_activo(user_id: int, activo: int) -> None:
    con = conectar()
    try:
        cur = con.cursor()
        if not _has_column(cur, "usuarios", "activo"):
            return
        cur.execute("UPDATE usuarios SET activo = ? WHERE id = ?", (int(bool(activo)), user_id))
        con.commit()
    finally:
        con.close()


def get_all_usuarios() -> List[Dict[str, Any]]:
    """Lista todos los usuarios del sistema"""
    con = conectar()
    try:
        cur = con.cursor()
        user_col = _usuarios_user_col(cur)
        cols = _table_columns(cur, "usuarios")
        
        sel = ["id", f"{user_col} as username", "rol"]
        if "activo" in cols:
            sel.append("activo")
        if "last_login" in cols:
            sel.append("last_login")
        
        cur.execute(f"SELECT {', '.join(sel)} FROM usuarios ORDER BY id")
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_pedidos_creators() -> List[str]:
    """Obtiene lista de usuarios únicos que han creado pedidos (para filtro)"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT DISTINCT creado_por 
            FROM pedidos 
            WHERE creado_por IS NOT NULL AND creado_por != ''
            ORDER BY creado_por
        """)
        return [r[0] for r in cur.fetchall()]
    finally:
        con.close()


def update_usuario_rol(user_id: int, rol: str) -> bool:
    """Actualiza el rol de un usuario"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("UPDATE usuarios SET rol = ? WHERE id = ?", (rol, user_id))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def update_usuario_password(username: str, password_hash: str) -> bool:
    """Actualiza la contraseña de un usuario"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("UPDATE usuarios SET password_hash = ? WHERE username = ?", (password_hash, username))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def delete_usuario(user_id: int) -> bool:
    """Elimina un usuario"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def touch_last_login(user_id: int) -> None:
    con = conectar()
    try:
        cur = con.cursor()
        if not _has_column(cur, "usuarios", "last_login"):
            return
        cur.execute("UPDATE usuarios SET last_login = ? WHERE id = ?", (_now_iso(), user_id))
        con.commit()
    finally:
        con.close()


# === Ofertas ===
def get_ofertas_activas():
    """Obtener ofertas activas con sus productos"""
    con = conectar()
    try:
        cur = con.cursor()
        # Verificar si existen las tablas
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ofertas'")
        if not cur.fetchone():
            return []
        
        hoy = _now_iso()[:10]  # YYYY-MM-DD
        cur.execute("""
            SELECT id, titulo, descripcion, desde, hasta, descuento_porcentaje
            FROM ofertas
            WHERE activa = 1 AND desde <= ? AND hasta >= ?
            ORDER BY desde DESC
        """, (hoy, hoy))
        ofertas = []
        for row in cur.fetchall():
            oferta_id, titulo, descripcion, desde, hasta, descuento = row
            cur.execute("SELECT producto_id, cantidad FROM oferta_productos WHERE oferta_id = ?", (oferta_id,))
            productos = [{"producto_id": r[0], "cantidad": r[1] or 1} for r in cur.fetchall()]
            ofertas.append({
                "id": oferta_id,
                "titulo": titulo,
                "descripcion": descripcion,
                "desde": desde,
                "hasta": hasta,
                "descuento_porcentaje": descuento or 10,
                "productos": productos
            })
        return ofertas
    finally:
        con.close()


def get_todas_ofertas():
    """Obtener todas las ofertas (activas e inactivas)"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ofertas'")
        if not cur.fetchone():
            return []
        
        cur.execute("""
            SELECT id, titulo, descripcion, desde, hasta, activa, descuento_porcentaje
            FROM ofertas
            ORDER BY desde DESC
        """)
        ofertas = []
        for row in cur.fetchall():
            oferta_id, titulo, descripcion, desde, hasta, activa, descuento = row
            cur.execute("SELECT producto_id, cantidad FROM oferta_productos WHERE oferta_id = ?", (oferta_id,))
            productos = [{"producto_id": r[0], "cantidad": r[1] or 1} for r in cur.fetchall()]
            ofertas.append({
                "id": oferta_id,
                "titulo": titulo,
                "descripcion": descripcion,
                "desde": desde,
                "hasta": hasta,
                "activa": activa,
                "descuento_porcentaje": descuento or 10,
                "productos": productos
            })
        return ofertas
    finally:
        con.close()

def crear_oferta(titulo: str, descripcion: str, desde: str, hasta: str, productos: list, descuento_porcentaje: float = 10):
    """Crear una nueva oferta con productos y cantidades"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            INSERT INTO ofertas (titulo, descripcion, desde, hasta, activa, descuento_porcentaje)
            VALUES (?, ?, ?, ?, 1, ?)
        """, (titulo, descripcion, desde, hasta, descuento_porcentaje))
        oferta_id = cur.lastrowid
        for prod in productos:
            producto_id = prod.get('producto_id') if isinstance(prod, dict) else prod
            cantidad = prod.get('cantidad', 1) if isinstance(prod, dict) else 1
            cur.execute("INSERT INTO oferta_productos (oferta_id, producto_id, cantidad) VALUES (?, ?, ?)", 
                       (oferta_id, producto_id, cantidad))
        con.commit()
        return {"id": oferta_id, "titulo": titulo}
    finally:
        con.close()

def actualizar_oferta(oferta_id: int, titulo: str, descripcion: str, desde: str, hasta: str, productos: list, descuento_porcentaje: float = 10):
    """Actualizar una oferta existente con productos y cantidades"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            UPDATE ofertas 
            SET titulo = ?, descripcion = ?, desde = ?, hasta = ?, descuento_porcentaje = ?
            WHERE id = ?
        """, (titulo, descripcion, desde, hasta, descuento_porcentaje, oferta_id))
        
        # Eliminar productos viejos y agregar nuevos
        cur.execute("DELETE FROM oferta_productos WHERE oferta_id = ?", (oferta_id,))
        for prod in productos:
            producto_id = prod.get('producto_id') if isinstance(prod, dict) else prod
            cantidad = prod.get('cantidad', 1) if isinstance(prod, dict) else 1
            cur.execute("INSERT INTO oferta_productos (oferta_id, producto_id, cantidad) VALUES (?, ?, ?)", 
                       (oferta_id, producto_id, cantidad))
        con.commit()
        return {"id": oferta_id, "titulo": titulo}
    finally:
        con.close()

def eliminar_oferta(oferta_id: int):
    """Eliminar una oferta"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM oferta_productos WHERE oferta_id = ?", (oferta_id,))
        cur.execute("DELETE FROM ofertas WHERE id = ?", (oferta_id,))
        con.commit()
    finally:
        con.close()

def toggle_oferta(oferta_id: int):
    """Alternar estado activo/inactivo de una oferta. Si se activa una oferta vencida, actualiza las fechas."""
    from datetime import datetime, timedelta
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT activa, desde, hasta FROM ofertas WHERE id = ?", (oferta_id,))
        row = cur.fetchone()
        if not row:
            return {"error": "Oferta no encontrada"}
        
        activa_actual, desde, hasta = row
        nuevo_estado = 0 if activa_actual == 1 else 1
        
        # Si estamos activando la oferta y está vencida, actualizar las fechas
        hoy = datetime.now(URUGUAY_TZ).strftime('%Y-%m-%d')
        nuevas_fechas = {}
        
        if nuevo_estado == 1 and hasta < hoy:
            # La oferta está vencida, calcular nuevas fechas basadas en la duración original
            try:
                fecha_desde = datetime.strptime(desde, '%Y-%m-%d')
                fecha_hasta = datetime.strptime(hasta, '%Y-%m-%d')
                duracion = (fecha_hasta - fecha_desde).days
                if duracion < 1:
                    duracion = 7  # Default 1 semana
                
                nuevo_desde = datetime.now(URUGUAY_TZ).strftime('%Y-%m-%d')
                nuevo_hasta = (datetime.now(URUGUAY_TZ) + timedelta(days=duracion)).strftime('%Y-%m-%d')
                
                cur.execute("UPDATE ofertas SET activa = ?, desde = ?, hasta = ? WHERE id = ?", 
                           (nuevo_estado, nuevo_desde, nuevo_hasta, oferta_id))
                nuevas_fechas = {"desde": nuevo_desde, "hasta": nuevo_hasta, "fechas_actualizadas": True}
            except:
                cur.execute("UPDATE ofertas SET activa = ? WHERE id = ?", (nuevo_estado, oferta_id))
        else:
            cur.execute("UPDATE ofertas SET activa = ? WHERE id = ?", (nuevo_estado, oferta_id))
        
        con.commit()
        return {"id": oferta_id, "activa": nuevo_estado, **nuevas_fechas}
    finally:
        con.close()


def seed_ofertas_demo():
    """Crear ofertas demo si no existen"""
    con = conectar()
    try:
        cur = con.cursor()
        # Crear tablas si no existen
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ofertas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                descripcion TEXT,
                desde TEXT NOT NULL,
                hasta TEXT NOT NULL,
                activa INTEGER DEFAULT 1,
                descuento_porcentaje REAL DEFAULT 10
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS oferta_productos (
                oferta_id INTEGER NOT NULL,
                producto_id INTEGER NOT NULL,
                cantidad REAL DEFAULT 1,
                PRIMARY KEY (oferta_id, producto_id),
                FOREIGN KEY (oferta_id) REFERENCES ofertas(id),
                FOREIGN KEY (producto_id) REFERENCES productos(id)
            )
        """)
        con.commit()
        
        # Verificar si ya hay ofertas
        cur.execute("SELECT COUNT(*) FROM ofertas")
        if cur.fetchone()[0] > 0:
            return  # Ya hay ofertas, no crear demo
        
        # Obtener algunos productos para demo
        cur.execute("SELECT id FROM productos LIMIT 5")
        productos = [r[0] for r in cur.fetchall()]
        if len(productos) < 3:
            return  # No hay suficientes productos
        
        # Crear ofertas demo
        hoy = _now_iso()[:10]
        # Oferta válida por 30 días
        desde_date = hoy
        hasta_date = f"{int(hoy[:4])}-{int(hoy[5:7])+1:02d}-{hoy[8:10]}" if int(hoy[5:7]) < 12 else f"{int(hoy[:4])+1}-01-{hoy[8:10]}"
        
        cur.execute("""
            INSERT INTO ofertas (titulo, descripcion, desde, hasta, activa)
            VALUES (?, ?, ?, ?, 1)
        """, ("🔥 Oferta de la semana", "Descuentos especiales en productos seleccionados", desde_date, hasta_date))
        oferta1_id = cur.lastrowid
        for prod_id in productos[:3]:
            cur.execute("INSERT INTO oferta_productos (oferta_id, producto_id) VALUES (?, ?)", 
                       (oferta1_id, prod_id))
        
        cur.execute("""
            INSERT INTO ofertas (titulo, descripcion, desde, hasta, activa)
            VALUES (?, ?, ?, ?, 1)
        """, ("🎉 Promo del mes", "Llevá más, pagá menos", desde_date, hasta_date))
        oferta2_id = cur.lastrowid
        for prod_id in productos[2:5]:
            cur.execute("INSERT INTO oferta_productos (oferta_id, producto_id) VALUES (?, ?)", 
                       (oferta2_id, prod_id))
        
        con.commit()
        print("Ofertas demo creadas correctamente")
    finally:
        con.close()


def seed_categorias_default():
    """Crear categorías por defecto si no existen"""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Verificar si ya hay categorías
        cur.execute("SELECT COUNT(*) FROM categorias")
        if cur.fetchone()[0] > 0:
            return  # Ya hay categorías
        
        # Categorías por defecto para una carnicería
        categorias = [
            ("🥩 Carnes Vacunas", "Cortes de res, bifes, asado", "#ef4444", 1),
            ("🐷 Cerdo", "Cortes de cerdo, bondiola, costillas", "#f97316", 2),
            ("🐔 Pollo", "Pollo entero, pechuga, muslos", "#eab308", 3),
            ("🌭 Embutidos", "Chorizos, morcillas, salchichas", "#84cc16", 4),
            ("🧀 Lácteos", "Quesos, manteca, crema", "#06b6d4", 5),
            ("🥚 Otros", "Huevos, aceite, condimentos", "#8b5cf6", 6),
            ("❄️ Congelados", "Productos congelados", "#3b82f6", 7),
            ("📦 Mayorista", "Productos por caja/bulto", "#6366f1", 8),
        ]
        
        for nombre, descripcion, color, orden in categorias:
            cur.execute(
                "INSERT INTO categorias (nombre, descripcion, color, orden, activa, fecha_creacion) VALUES (?, ?, ?, ?, 1, ?)",
                (nombre, descripcion, color, orden, _now_uruguay_iso())
            )
        
        con.commit()
        print("Categorías por defecto creadas correctamente")
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Historial de modificaciones
# -----------------------------------------------------------------------------
def add_historial(pedido_id: int, accion: str, usuario: str, detalles: str = None) -> None:
    """Registra una acción en el historial de modificaciones del pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            INSERT INTO historial_pedidos (pedido_id, accion, usuario, fecha, detalles)
            VALUES (?, ?, ?, ?, ?)
        """, (pedido_id, accion, usuario, _now_uruguay(), detalles))
        con.commit()
    finally:
        con.close()


def get_historial_pedido(pedido_id: int) -> List[Dict[str, Any]]:
    """Obtiene el historial de modificaciones de un pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT id, pedido_id, accion, usuario, fecha, detalles
            FROM historial_pedidos
            WHERE pedido_id = ?
            ORDER BY id DESC
        """, (pedido_id,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


# -----------------------------------------------------------------------------
# Estadísticas por usuario
# -----------------------------------------------------------------------------
def get_estadisticas_usuarios() -> Dict[str, Any]:
    """Obtiene estadísticas de actividad por usuario"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        
        resultado = {
            "por_vendedor": [],
            "por_hora": [],
            "por_dia": [],
            "dispositivos": []
        }
        
        # Pedidos creados por vendedor
        if "creado_por" in cols:
            cur.execute("""
                SELECT creado_por as usuario, COUNT(*) as total,
                       SUM(CASE WHEN pdf_generado = 1 THEN 1 ELSE 0 END) as generados,
                       SUM(CASE WHEN pdf_generado = 0 THEN 1 ELSE 0 END) as pendientes
                FROM pedidos
                WHERE creado_por IS NOT NULL
                GROUP BY creado_por
                ORDER BY total DESC
            """)
            resultado["por_vendedor"] = [dict(r) for r in cur.fetchall()]
        
        # Pedidos por hora del día (últimos 7 días)
        if "fecha_creacion" in cols:
            cur.execute("""
                SELECT 
                    CASE 
                        WHEN fecha_creacion LIKE '%/%' THEN substr(fecha_creacion, 12, 2)
                        ELSE '00'
                    END as hora,
                    COUNT(*) as total
                FROM pedidos
                WHERE fecha_creacion IS NOT NULL
                  AND fecha >= date('now', '-7 days')
                GROUP BY hora
                ORDER BY hora
            """)
            resultado["por_hora"] = [dict(r) for r in cur.fetchall()]
        
        # Pedidos por día de la semana (últimos 30 días)
        cur.execute("""
            SELECT 
                CASE strftime('%w', fecha)
                    WHEN '0' THEN 'Domingo'
                    WHEN '1' THEN 'Lunes'
                    WHEN '2' THEN 'Martes'
                    WHEN '3' THEN 'Miércoles'
                    WHEN '4' THEN 'Jueves'
                    WHEN '5' THEN 'Viernes'
                    WHEN '6' THEN 'Sábado'
                END as dia,
                COUNT(*) as total
            FROM pedidos
            WHERE fecha >= date('now', '-30 days')
            GROUP BY strftime('%w', fecha)
            ORDER BY strftime('%w', fecha)
        """)
        resultado["por_dia"] = [dict(r) for r in cur.fetchall()]
        
        # Estadísticas por dispositivo
        if "dispositivo" in cols:
            cur.execute("""
                SELECT 
                    COALESCE(dispositivo, 'desconocido') as dispositivo,
                    COUNT(*) as total
                FROM pedidos
                GROUP BY dispositivo
                ORDER BY total DESC
            """)
            resultado["dispositivos"] = [dict(r) for r in cur.fetchall()]
        
        return resultado
    finally:
        con.close()


def get_pedidos_antiguos(horas: int = 24) -> List[Dict[str, Any]]:
    """Obtiene pedidos pendientes con más de X horas de antigüedad"""
    con = conectar()
    try:
        cur = con.cursor()
        cliente_col = _pedidos_cliente_col(cur)
        
        # Calcular fecha límite
        limite = datetime.now(URUGUAY_TZ) - timedelta(hours=horas)
        limite_iso = limite.isoformat()
        
        cur.execute(f"""
            SELECT p.id, p.{cliente_col} as cliente_id, c.nombre as cliente_nombre,
                   p.fecha, p.fecha_creacion, p.creado_por
            FROM pedidos p
            LEFT JOIN clientes c ON p.{cliente_col} = c.id
            WHERE p.pdf_generado = 0
              AND p.fecha < ?
            ORDER BY p.fecha ASC
        """, (limite_iso,))
        
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def update_pedido_dispositivo(pedido_id: int, dispositivo: str, user_agent: str) -> None:
    """Actualiza información del dispositivo del pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        
        updates = []
        values = []
        
        if "dispositivo" in cols:
            updates.append("dispositivo = ?")
            values.append(dispositivo)
        if "user_agent" in cols:
            updates.append("user_agent = ?")
            values.append(user_agent[:500] if user_agent else None)  # Limitar tamaño
        
        if updates:
            values.append(pedido_id)
            cur.execute(f"UPDATE pedidos SET {', '.join(updates)} WHERE id = ?", tuple(values))
            con.commit()
    finally:
        con.close()


def update_pedido_ultima_edicion(pedido_id: int, usuario: str) -> None:
    """Actualiza información de última edición del pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        
        updates = []
        values = []
        
        if "ultimo_editor" in cols:
            updates.append("ultimo_editor = ?")
            values.append(usuario)
        if "fecha_ultima_edicion" in cols:
            updates.append("fecha_ultima_edicion = ?")
            values.append(_now_uruguay())
        
        if updates:
            values.append(pedido_id)
            cur.execute(f"UPDATE pedidos SET {', '.join(updates)} WHERE id = ?", tuple(values))
            con.commit()
    finally:
        con.close()


def update_pedido_notas(pedido_id: int, notas: str) -> Dict[str, Any]:
    """Actualiza las notas de un pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        
        if "notas" not in cols:
            return {"error": "notas column not found"}
        
        cur.execute("UPDATE pedidos SET notas = ? WHERE id = ?", (notas, pedido_id))
        con.commit()
        return {"status": "ok", "pedido_id": pedido_id, "notas": notas}
    finally:
        con.close()


# -----------------------------------------------------------------------------
# LISTAS DE PRECIOS
# -----------------------------------------------------------------------------
def get_listas_precios() -> List[Dict[str, Any]]:
    """Obtiene todas las listas de precios con conteo de productos"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT lp.*, 
                   (SELECT COUNT(*) FROM precios_lista pl WHERE pl.lista_id = lp.id) as productos_count,
                   (SELECT COUNT(*) FROM clientes c WHERE c.lista_precio_id = lp.id) as clientes_count
            FROM listas_precios lp
            ORDER BY lp.nombre
        """)
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_lista_precio(lista_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una lista de precios con sus precios especiales"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT * FROM listas_precios WHERE id = ?", (lista_id,))
        lista = cur.fetchone()
        if not lista:
            return None
        
        result = dict(lista)
        
        # Obtener precios especiales
        cur.execute("""
            SELECT pl.*, p.nombre as producto_nombre, p.precio as precio_base
            FROM precios_lista pl
            JOIN productos p ON pl.producto_id = p.id
            WHERE pl.lista_id = ?
            ORDER BY p.nombre
        """, (lista_id,))
        result["precios"] = [dict(r) for r in cur.fetchall()]
        
        return result
    finally:
        con.close()


def add_lista_precio(data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva lista de precios"""
    # Validaciones
    nombre = data.get("nombre", "").strip()
    if not nombre:
        raise ValueError("El nombre de la lista es requerido")
    
    multiplicador = data.get("multiplicador", 1.0)
    if multiplicador <= 0:
        raise ValueError("El multiplicador debe ser mayor a 0")
    
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            INSERT INTO listas_precios (nombre, descripcion, multiplicador, activa, fecha_creacion)
            VALUES (?, ?, ?, 1, ?)
        """, (
            nombre,
            data.get("descripcion", ""),
            multiplicador,
            _now_uruguay()
        ))
        con.commit()
        return {"id": cur.lastrowid, **data}
    except sqlite3.IntegrityError:
        return {"error": "LISTA_DUPLICADA", "detail": "Ya existe una lista con ese nombre"}
    finally:
        con.close()


def update_lista_precio(lista_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza una lista de precios"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            UPDATE listas_precios 
            SET nombre = ?, descripcion = ?, multiplicador = ?, activa = ?
            WHERE id = ?
        """, (
            data.get("nombre"),
            data.get("descripcion", ""),
            data.get("multiplicador", 1.0),
            1 if data.get("activa", True) else 0,
            lista_id
        ))
        con.commit()
        return {"id": lista_id, **data}
    finally:
        con.close()


def delete_lista_precio(lista_id: int) -> bool:
    """Elimina una lista de precios"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("UPDATE clientes SET lista_precio_id = NULL WHERE lista_precio_id = ?", (lista_id,))
        cur.execute("DELETE FROM precios_lista WHERE lista_id = ?", (lista_id,))
        cur.execute("DELETE FROM listas_precios WHERE id = ?", (lista_id,))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def get_precios_lista(lista_id: int) -> List[Dict[str, Any]]:
    """Obtiene todos los precios especiales de una lista"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT pl.producto_id, pl.precio_especial, p.nombre, p.precio as precio_base
            FROM precios_lista pl
            JOIN productos p ON pl.producto_id = p.id
            WHERE pl.lista_id = ?
            ORDER BY p.nombre
        """, (lista_id,))
        return [
            {
                "producto_id": row[0],
                "precio_especial": row[1],
                "producto_nombre": row[2],
                "precio_base": row[3]
            }
            for row in cur.fetchall()
        ]
    finally:
        con.close()


def set_precio_especial(lista_id: int, producto_id: int, precio: float) -> Dict[str, Any]:
    """Establece un precio especial para un producto en una lista"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO precios_lista (lista_id, producto_id, precio_especial)
            VALUES (?, ?, ?)
        """, (lista_id, producto_id, precio))
        con.commit()
        return {"lista_id": lista_id, "producto_id": producto_id, "precio_especial": precio}
    finally:
        con.close()


def remove_precio_especial(lista_id: int, producto_id: int) -> bool:
    """Elimina un precio especial"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM precios_lista WHERE lista_id = ? AND producto_id = ?", (lista_id, producto_id))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def asignar_lista_cliente(cliente_id: int, lista_id: Optional[int]) -> bool:
    """Asigna una lista de precios a un cliente"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("UPDATE clientes SET lista_precio_id = ? WHERE id = ?", (lista_id, cliente_id))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def get_precio_cliente(cliente_id: int, producto_id: int) -> float:
    """
    Obtiene el precio de un producto para un cliente específico.
    Orden de prioridad:
    1. Precio especial en lista (si existe)
    2. Precio base * multiplicador de lista (si cliente tiene lista)
    3. Precio base (si cliente no tiene lista)
    """
    con = conectar()
    try:
        cur = con.cursor()
        
        # Obtener precio base del producto
        cur.execute("SELECT precio FROM productos WHERE id = ?", (producto_id,))
        prod = cur.fetchone()
        if not prod:
            return 0.0
        precio_base = float(prod[0])
        
        # Obtener lista de precios asignada al cliente
        cur.execute("SELECT lista_precio_id FROM clientes WHERE id = ?", (cliente_id,))
        cliente = cur.fetchone()
        
        # Si cliente no tiene lista asignada, retornar precio base
        if not cliente or not cliente[0]:
            return precio_base
        
        lista_id = cliente[0]
        
        # Verificar si existe precio especial para este producto en la lista
        cur.execute(
            "SELECT precio_especial FROM precios_lista WHERE lista_id = ? AND producto_id = ?",
            (lista_id, producto_id)
        )
        especial = cur.fetchone()
        
        # Si hay precio especial, usarlo
        if especial and especial[0]:
            return float(especial[0])
        
        # Si no hay precio especial, aplicar multiplicador
        cur.execute("SELECT multiplicador FROM listas_precios WHERE id = ?", (lista_id,))
        lista = cur.fetchone()
        
        if lista and lista[0]:
            multiplicador = float(lista[0])
            return round(precio_base * multiplicador, 2)
        
        # Fallback: retornar precio base
        return precio_base
    finally:
        con.close()


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
def get_templates_pedido(cliente_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Obtiene templates de pedidos"""
    con = conectar()
    try:
        cur = con.cursor()
        query = """
            SELECT pt.*, c.nombre as cliente_nombre,
                   (SELECT COUNT(*) FROM detalles_template dt WHERE dt.template_id = pt.id) as productos_count
            FROM pedidos_template pt LEFT JOIN clientes c ON pt.cliente_id = c.id
        """
        params = []
        if cliente_id:
            query += " WHERE pt.cliente_id = ?"
            params.append(cliente_id)
        query += " ORDER BY pt.nombre"
        cur.execute(query, tuple(params))
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_template_pedido(template_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un template con sus detalles"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT pt.*, c.nombre as cliente_nombre FROM pedidos_template pt
            LEFT JOIN clientes c ON pt.cliente_id = c.id WHERE pt.id = ?
        """, (template_id,))
        template = cur.fetchone()
        if not template:
            return None
        result = dict(template)
        cur.execute("""
            SELECT dt.*, p.nombre as producto_nombre, p.precio
            FROM detalles_template dt JOIN productos p ON dt.producto_id = p.id
            WHERE dt.template_id = ? ORDER BY p.nombre
        """, (template_id,))
        result["productos"] = [dict(r) for r in cur.fetchall()]
        return result
    finally:
        con.close()


def add_template_pedido(data: Dict[str, Any], usuario: str) -> Dict[str, Any]:
    """Crea un nuevo template de pedido"""
    # Validaciones
    productos = data.get("productos", [])
    if not productos:
        raise ValueError("El template debe tener al menos un producto")
    
    for p in productos:
        cantidad = p.get("cantidad", 1)
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
    
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            INSERT INTO pedidos_template (nombre, cliente_id, frecuencia, activo, creado_por, fecha_creacion)
            VALUES (?, ?, ?, 1, ?, ?)
        """, (data.get("nombre"), data.get("cliente_id"), data.get("frecuencia"), usuario, _now_uruguay()))
        template_id = cur.lastrowid
        for p in productos:
            cur.execute("""
                INSERT INTO detalles_template (template_id, producto_id, cantidad, tipo)
                VALUES (?, ?, ?, ?)
            """, (template_id, p.get("producto_id"), p.get("cantidad", 1), p.get("tipo", "unidad")))
        con.commit()
        return {"id": template_id, **data}
    finally:
        con.close()


def update_template_pedido(template_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un template de pedido"""
    # Validaciones
    productos = data.get("productos", [])
    if not productos:
        raise ValueError("El template debe tener al menos un producto")
    
    for p in productos:
        cantidad = p.get("cantidad", 1)
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
    
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            UPDATE pedidos_template SET nombre = ?, cliente_id = ?, frecuencia = ?, activo = ?
            WHERE id = ?
        """, (data.get("nombre"), data.get("cliente_id"), data.get("frecuencia"),
              1 if data.get("activo", True) else 0, template_id))
        if "productos" in data:
            cur.execute("DELETE FROM detalles_template WHERE template_id = ?", (template_id,))
            for p in data.get("productos", []):
                cur.execute("""
                    INSERT INTO detalles_template (template_id, producto_id, cantidad, tipo)
                    VALUES (?, ?, ?, ?)
                """, (template_id, p.get("producto_id"), p.get("cantidad", 1), p.get("tipo", "unidad")))
        con.commit()
        return {"id": template_id, **data}
    finally:
        con.close()


def delete_template_pedido(template_id: int) -> bool:
    """Elimina un template de pedido"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM detalles_template WHERE template_id = ?", (template_id,))
        cur.execute("DELETE FROM pedidos_template WHERE id = ?", (template_id,))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def crear_pedido_desde_template(template_id: int, usuario: str) -> Optional[int]:
    """Crea un pedido real desde un template"""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("SELECT * FROM pedidos_template WHERE id = ?", (template_id,))
        template = cur.fetchone()
        if not template:
            return None
        template = dict(template)
        
        cur.execute("""
            INSERT INTO pedidos (cliente_id, fecha, pdf_generado, fecha_creacion, creado_por)
            VALUES (?, ?, 0, ?, ?)
        """, (template.get("cliente_id"), datetime.now().strftime("%Y-%m-%d"), _now_uruguay(), usuario))
        pedido_id = cur.lastrowid
        
        cur.execute("""
            INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, tipo)
            SELECT ?, producto_id, cantidad, tipo FROM detalles_template WHERE template_id = ?
        """, (pedido_id, template_id))
        
        cur.execute("UPDATE pedidos_template SET ultima_ejecucion = ? WHERE id = ?", (_now_uruguay(), template_id))
        con.commit()
        return pedido_id
    finally:
        con.close()


def get_ultimo_pedido_cliente(cliente_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene el último pedido de un cliente para poder repetirlo"""
    con = conectar()
    try:
        cur = con.cursor()
        cols = _table_columns(cur, "pedidos")
        cliente_col = "cliente_id" if "cliente_id" in cols else "id_cliente"
        
        cur.execute(f"""
            SELECT id, fecha FROM pedidos WHERE {cliente_col} = ?
            ORDER BY fecha DESC, id DESC LIMIT 1
        """, (cliente_id,))
        pedido = cur.fetchone()
        if not pedido:
            return None
        
        cur.execute("""
            SELECT dp.producto_id, dp.cantidad, dp.tipo, p.nombre, p.precio
            FROM detalles_pedido dp JOIN productos p ON dp.producto_id = p.id
            WHERE dp.pedido_id = ?
        """, (pedido[0],))
        
        return {"pedido_id": pedido[0], "fecha": pedido[1], "productos": [dict(r) for r in cur.fetchall()]}
    finally:
        con.close()


# ============================================================================
# Tags (Multi-tag system for products)
# ============================================================================
def get_tags(tipo: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Obtiene todos los tags del sistema.
    - tipo: 'conservacion' | 'tipo' para filtrar
    """
    con = conectar()
    try:
        cur = con.cursor()
        if tipo:
            cur.execute("SELECT * FROM tags WHERE tipo = ? ORDER BY nombre", (tipo,))
        else:
            cur.execute("SELECT * FROM tags ORDER BY tipo, nombre")
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_producto_tags(producto_id: int) -> List[Dict[str, Any]]:
    """Obtiene los tags asignados a un producto."""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT t.* FROM tags t
            JOIN productos_tags pt ON t.id = pt.tag_id
            WHERE pt.producto_id = ?
            ORDER BY t.tipo, t.nombre
        """, (producto_id,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def update_producto_tags(producto_id: int, tag_ids: List[int]) -> Dict[str, Any]:
    """Actualiza los tags de un producto (reemplaza todos)."""
    con = conectar()
    try:
        cur = con.cursor()
        # Verificar que todos los tag_ids existen
        if tag_ids:
            placeholders = ','.join('?' * len(tag_ids))
            cur.execute(f"SELECT COUNT(*) FROM tags WHERE id IN ({placeholders})", tag_ids)
            count = cur.fetchone()[0]
            if count != len(tag_ids):
                return {"error": "Uno o más tags no existen"}
        
        # Eliminar tags existentes
        cur.execute("DELETE FROM productos_tags WHERE producto_id = ?", (producto_id,))
        
        # Insertar nuevos tags
        for tag_id in tag_ids:
            cur.execute(
                "INSERT INTO productos_tags (producto_id, tag_id) VALUES (?, ?)",
                (producto_id, tag_id)
            )
        
        con.commit()
        return {"status": "ok", "tags_count": len(tag_ids)}
    except sqlite3.Error as e:
        return {"error": str(e)}
    finally:
        con.close()


def get_productos_por_tag(tag_id: int) -> List[Dict[str, Any]]:
    """Obtiene productos que tienen un tag específico."""
    con = conectar()
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT p.* FROM productos p
            JOIN productos_tags pt ON p.id = pt.producto_id
            WHERE pt.tag_id = ?
            ORDER BY p.nombre
        """, (tag_id,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


def get_productos_with_tags() -> List[Dict[str, Any]]:
    """Obtiene todos los productos con sus tags incluidos."""
    con = conectar()
    try:
        cur = con.cursor()
        
        # Primero obtener todos los productos
        cur.execute("SELECT * FROM productos ORDER BY nombre")
        productos = [dict(r) for r in cur.fetchall()]
        
        # Luego obtener todos los tags de productos en una sola query
        cur.execute("""
            SELECT pt.producto_id, t.id, t.nombre, t.color, t.icono, t.tipo
            FROM productos_tags pt
            JOIN tags t ON pt.tag_id = t.id
        """)
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
    finally:
        con.close()
