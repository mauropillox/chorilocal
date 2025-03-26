import sqlite3

DB_PATH = "ventas.db"

try:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("ALTER TABLE pedidos ADD COLUMN pdf_generado BOOLEAN DEFAULT FALSE;")
    con.commit()
    con.close()
    print("✅ Migración completada con éxito.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("⚠️ La columna 'pdf_generado' ya existe. No se necesita migración.")
    else:
        print(f"❌ Error al migrar: {e}")
