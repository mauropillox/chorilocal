import os
import sqlite3

DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")

def verificar_tablas():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1;")
    tablas = [r[0] for r in cursor.fetchall()]
    print("DB_PATH:", DB_PATH)
    print("Tablas:", tablas)
    conn.close()


def migrar_imagen_producto():
    """Agrega columna imagen_url a productos si no existe (ALTER TABLE)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(productos);")
    cols = [r[1] for r in cursor.fetchall()]
    if 'imagen_url' in cols:
        print('Columna imagen_url ya existe en productos, nada para hacer.')
    else:
        print('Agregando columna imagen_url a productos...')
        cursor.execute("ALTER TABLE productos ADD COLUMN imagen_url TEXT;")
        conn.commit()
        print('Columna agregada.')
    conn.close()

if __name__ == "__main__":
    verificar_tablas()
    migrar_imagen_producto()
