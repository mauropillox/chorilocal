# init_db.py
import sqlite3

DB_PATH = "ventas.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Crear tabla clientes
cursor.execute("""
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    direccion TEXT
)
""")

# Crear tabla productos
cursor.execute("""
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL
)
""")

# Crear tabla pedidos
cursor.execute("""
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    pdf_generado INTEGER DEFAULT 0,
    FOREIGN KEY(id_cliente) REFERENCES clientes(id)
)
""")

# Crear tabla detalles_pedido
cursor.execute("""
CREATE TABLE IF NOT EXISTS detalles_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_pedido INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    FOREIGN KEY(id_pedido) REFERENCES pedidos(id),
    FOREIGN KEY(id_producto) REFERENCES productos(id)
)
""")

conn.commit()
conn.close()
print("Base de datos inicializada correctamente.")
