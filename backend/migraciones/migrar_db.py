import sqlite3

DB_PATH = "ventas.db"

def agregar_columna_si_no_existe(cursor, tabla, columna, tipo_def):
    cursor.execute(f"PRAGMA table_info({tabla})")
    columnas = [col[1] for col in cursor.fetchall()]
    if columna not in columnas:
        print(f"➕ Agregando columna '{columna}' a la tabla '{tabla}'...")
        cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo_def};")
    else:
        print(f"✔️ La columna '{columna}' ya existe en '{tabla}'.")

try:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    agregar_columna_si_no_existe(cur, "pedidos", "pdf_generado", "BOOLEAN DEFAULT FALSE")
    agregar_columna_si_no_existe(cur, "detalles_pedido", "tipo", "TEXT DEFAULT 'unidad'")

    con.commit()
    con.close()
    print("✅ Migración completada con éxito.")
except sqlite3.OperationalError as e:
    print(f"❌ Error al migrar: {e}")
