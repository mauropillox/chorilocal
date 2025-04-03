import sqlite3

DB_PATH = "ventas.db"

def verificar_tablas():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tablas = cursor.fetchall()
    print("Tablas en la base de datos:", tablas)
    conn.close()

verificar_tablas()
