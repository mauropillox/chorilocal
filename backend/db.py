import sqlite3
import os

# === Configuración ===
DB_PATH = os.getenv("DB_PATH", "ventas.db")

def conectar():
    return sqlite3.connect(DB_PATH)

# === CREAR TABLAS ===
def crear_tabla_detalles_pedido():
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS detalles_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_pedido INTEGER,
            id_producto INTEGER,
            cantidad REAL,
            tipo TEXT DEFAULT 'unidad',
            FOREIGN KEY(id_pedido) REFERENCES pedidos(id),
            FOREIGN KEY(id_producto) REFERENCES productos(id)
        );
        """)
        con.commit()
        print("Tabla 'detalles_pedido' creada correctamente.")
    except Exception as e:
        print(f"❌ Error creando la tabla detalles_pedido: {e}")
    finally:
        con.close()

def crear_tablas():
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT,
            direccion TEXT
        );
        """)
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_cliente INTEGER,
            fecha TEXT,
            pdf_generado INTEGER DEFAULT 0,
            FOREIGN KEY(id_cliente) REFERENCES clientes(id)
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_usuario TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL
        );
        """)

        con.commit()
        print("Tablas creadas correctamente.")
    except Exception as e:
        print(f"❌ Error creando las tablas: {e}")
    finally:
        con.close()

# === FUNCIONES PARA CLIENTES ===
def add_cliente(cliente):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)",
                    (cliente["nombre"], cliente["telefono"], cliente["direccion"]))
        con.commit()
        cliente["id"] = cur.lastrowid
    except Exception as e:
        print(f"❌ Error agregando cliente: {e}")
    finally:
        con.close()
    return cliente

def update_cliente(cliente_id, cliente):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("""
            UPDATE clientes SET nombre = ?, telefono = ?, direccion = ?
            WHERE id = ?
        """, (cliente["nombre"], cliente["telefono"], cliente["direccion"], cliente_id))
        con.commit()
    except Exception as e:
        print(f"❌ Error actualizando cliente: {e}")
    finally:
        con.close()
    return {"status": "updated"}

def delete_cliente(cliente_id):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
        con.commit()
    except Exception as e:
        print(f"❌ Error eliminando cliente: {e}")
    finally:
        con.close()
    return {"status": "deleted"}

# === FUNCIONES PARA PRODUCTOS ===
def add_producto(producto):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("INSERT INTO productos (nombre, precio) VALUES (?, ?)",
                    (producto["nombre"], producto["precio"]))
        con.commit()
        producto["id"] = cur.lastrowid
    except Exception as e:
        print(f"❌ Error agregando producto: {e}")
    finally:
        con.close()
    return producto

# === FUNCIONES PARA PEDIDOS ===
def add_pedido(pedido):
    con = conectar()
    cur = con.cursor()
    try:
        # Insertar el pedido principal
        cur.execute("INSERT INTO pedidos (id_cliente, fecha, pdf_generado) VALUES (?, datetime('now'), ?)",
                    (pedido["cliente_id"], False))
        pid = cur.lastrowid

        # Insertar los detalles del pedido (productos y tipo)
        for prod in pedido["productos"]:
            cur.execute("INSERT INTO detalles_pedido (id_pedido, id_producto, cantidad, tipo) VALUES (?, ?, ?, ?)",
                        (pid, prod["id"], prod["cantidad"], prod["tipo"]))

        con.commit()
    except Exception as e:
        print(f"❌ Error agregando pedido: {e}")
    finally:
        con.close()
    return {"id": pid, **pedido}

def delete_pedido(pedido_id):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("DELETE FROM detalles_pedido WHERE id_pedido = ?", (pedido_id,))
        cur.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
        con.commit()
    except Exception as e:
        print(f"❌ Error eliminando pedido: {e}")
    finally:
        con.close()
    return {"status": "deleted"}

def update_pedido_estado(pedido_id, estado):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("UPDATE pedidos SET pdf_generado = ? WHERE id = ?", (int(estado), pedido_id))
        con.commit()
    except Exception as e:
        print(f"❌ Error actualizando estado del pedido: {e}")
    finally:
        con.close()
    return {"id": pedido_id, "pdf_generado": estado}

def get_pedidos():
    con = conectar()
    cur = con.cursor()
    pedidos = []
    try:
        # Obtener los pedidos principales
        cur.execute("SELECT id, id_cliente, fecha, pdf_generado FROM pedidos")
        for r in cur.fetchall():
            pid, id_cliente, fecha, pdf_generado = r

            # Obtener los productos asociados con cada pedido
            cur.execute("""
            SELECT pr.id, pr.nombre, pr.precio, dp.cantidad, dp.tipo
            FROM detalles_pedido dp
            JOIN productos pr ON dp.id_producto = pr.id
            WHERE dp.id_pedido = ?
            """, (pid,))

            productos = [{"id": pr[0], "nombre": pr[1], "precio": pr[2], "cantidad": pr[3], "tipo": pr[4]} for pr in cur.fetchall()]

            pedidos.append({
                "id": pid,
                "cliente_id": id_cliente,
                "fecha": fecha,
                "pdf_generado": bool(pdf_generado),
                "productos": productos
            })
    except Exception as e:
        print(f"❌ Error obteniendo pedidos: {e}")
    finally:
        con.close()
    return pedidos

# === FUNCIONES DE USUARIO ===
def add_usuario(username, password_hash):
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("INSERT INTO usuarios (nombre_usuario, password_hash, rol) VALUES (?, ?, ?)", 
                    (username, password_hash, 'usuario'))
        con.commit()
        return True
    except sqlite3.IntegrityError:
        print(f"❌ Error: El usuario {username} ya existe.")
        return False
    except Exception as e:
        print(f"❌ Error agregando usuario: {e}")
    finally:
        con.close()

def get_usuario(username):
    con = conectar()
    cur = con.cursor()
    cur.execute("SELECT id, nombre_usuario, password_hash, rol FROM usuarios WHERE nombre_usuario = ?", (username,))
    row = cur.fetchone()
    con.close()
    if row:
        return {"id": row[0], "nombre_usuario": row[1], "password_hash": row[2], "rol": row[3]}
    return None

def verificar_tablas_y_columnas():
    con = conectar()
    cur = con.cursor()
    try:
        tablas_requeridas = {
            "clientes": ["id", "nombre", "telefono", "direccion"],
            "productos": ["id", "nombre", "precio"],
            "pedidos": ["id", "id_cliente", "fecha", "pdf_generado"],
            "detalles_pedido": ["id", "id_pedido", "id_producto", "cantidad", "tipo"],
            "usuarios": ["id", "nombre_usuario", "password_hash", "rol"]
        }
        for tabla, columnas in tablas_requeridas.items():
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabla,))
            if not cur.fetchone():
                raise Exception(f"Tabla '{tabla}' no existe.")
            cur.execute(f"PRAGMA table_info({tabla})")
            existentes = [r[1] for r in cur.fetchall()]
            for col in columnas:
                if col not in existentes:
                    raise Exception(f"Columna '{col}' no existe en la tabla '{tabla}'.")
        print("Tablas y columnas verificadas correctamente.")
    except Exception as e:
        print(f"❌ Error en verificación de base de datos: {e}")
    finally:
        con.close()

def add_usuario(username, password_hash, rol="usuario"):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Revisar si ya existe el usuario
    c.execute("SELECT * FROM usuarios WHERE username = ?", (username,))
    if c.fetchone():
        conn.close()
        return False

    # Verificamos si es el primer usuario del sistema
    c.execute("SELECT COUNT(*) FROM usuarios")
    count = c.fetchone()[0]

    if count == 0:
        rol = "admin"
        activo = 1
    else:
        activo = 0  # Requiere activación manual

    c.execute("INSERT INTO usuarios (username, password_hash, rol, activo) VALUES (?, ?, ?, ?)",
              (username, password_hash, rol, activo))
    conn.commit()
    conn.close()
    return True
