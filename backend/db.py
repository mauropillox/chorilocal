# db.py
import sqlite3
from datetime import datetime

DB_PATH = "ventas.db"

def conectar():
    return sqlite3.connect(DB_PATH)

def crear_tablas():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT DEFAULT '',
            direccion TEXT DEFAULT ''
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL DEFAULT 0.0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            fecha TEXT,
            observaciones TEXT,
            pdf_generado BOOLEAN DEFAULT 0,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detalles_pedido (
            pedido_id INTEGER,
            producto_id INTEGER,
            cantidad REAL,
            tipo TEXT,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            rol TEXT DEFAULT 'usuario',
            activo INTEGER DEFAULT 1,
            last_login TEXT
        )
    """)
    conn.commit()
    conn.close()

def crear_tabla_detalles_pedido():
    pass

def verificar_tablas_y_columnas():
    pass

def add_cliente(cliente):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)",
                   (cliente['nombre'], cliente['telefono'], cliente['direccion']))
    conn.commit()
    conn.close()
    return {"ok": True}

def get_clientes():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clientes")
    rows = cursor.fetchall()
    conn.close()
    return [dict(zip([c[0] for c in cursor.description], row)) for row in rows]

def update_cliente(cliente_id, cliente):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE clientes
        SET nombre = ?, telefono = ?, direccion = ?
        WHERE id = ?
    """, (cliente['nombre'], cliente['telefono'], cliente['direccion'], cliente_id))
    conn.commit()
    conn.close()
    return {"ok": True}

def delete_cliente(cliente_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

def add_producto(producto):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO productos (nombre, precio) VALUES (?, ?)",
                   (producto['nombre'], producto['precio']))
    conn.commit()
    conn.close()
    return {"ok": True}

def get_productos():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM productos")
    rows = cursor.fetchall()
    conn.close()
    return [dict(zip([c[0] for c in cursor.description], row)) for row in rows]

def add_pedido(pedido):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO pedidos (cliente_id, fecha, observaciones, pdf_generado) VALUES (?, ?, ?, ?)",
                   (pedido['cliente_id'], pedido.get('fecha', datetime.now().isoformat()), pedido.get('observaciones', ''), pedido['pdf_generado']))
    pedido_id = cursor.lastrowid
    for producto in pedido['productos']:
        cursor.execute("INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
                       (pedido_id, producto['producto_id'], producto['cantidad'], producto['tipo']))
    conn.commit()
    conn.close()
    return {"ok": True, "pedido_id": pedido_id}

def get_pedidos():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pedidos")
    rows = cursor.fetchall()
    conn.close()
    return [dict(zip([c[0] for c in cursor.description], row)) for row in rows]

def delete_pedido(pedido_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM detalles_pedido WHERE pedido_id = ?", (pedido_id,))
    cursor.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

def cambiar_estado_pedido(pedido_id, pdf_generado):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE pedidos SET pdf_generado = ? WHERE id = ?", (pdf_generado, pedido_id))
    conn.commit()
    actualizado = cursor.rowcount > 0
    conn.close()
    return actualizado

def add_usuario(username, password_hash, rol, activo):
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO usuarios (username, password_hash, rol, activo) VALUES (?, ?, ?, ?)",
                       (username, password_hash, rol, activo))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_usuario(username):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(zip([c[0] for c in cursor.description], row))
    return None

def get_usuario_por_id(user_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(zip([c[0] for c in cursor.description], row))
    return None

def update_last_login(username):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET last_login = ? WHERE username = ?", (datetime.now().isoformat(), username))
    conn.commit()
    conn.close()

def get_usuarios():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios")
    rows = cursor.fetchall()
    conn.close()
    return [dict(zip([c[0] for c in cursor.description], row)) for row in rows]

def activar_usuario(username):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET activo = 1 WHERE username = ?", (username,))
    conn.commit()
    conn.close()

def suspender_usuario(username):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET activo = 0 WHERE username = ?", (username,))
    conn.commit()
    conn.close()

def eliminar_usuario(username):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM usuarios WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return {"ok": True}

def actualizar_rol(username, rol):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET rol = ? WHERE username = ?", (rol, username))
    conn.commit()
    conn.close()
    return {"ok": True}

def resetear_password(username, new_password):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET password_hash = ? WHERE username = ?", (new_password, username))
    conn.commit()
    conn.close()
    return {"ok": True}

def get_pedidos_por_ids(pedido_ids):
    todos = get_pedidos()
    return [p for p in todos if p["id"] in pedido_ids]
