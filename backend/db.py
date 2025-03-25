#db.py: Maneja base de datos (clientes, artículos, pedidos).

import sqlite3

def obtener_conexion():
    conn = sqlite3.connect('ventas.db')
    return conn

def inicializar_bd():
    conn = obtener_conexion()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clientes(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articulos(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pedidos(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_cliente INTEGER,
            fecha TEXT,
            detalles TEXT,
            FOREIGN KEY(id_cliente) REFERENCES clientes(id)
        )
    ''')

    conn.commit()
    conn.close()

if __name__ == "__main__":
    inicializar_bd()
