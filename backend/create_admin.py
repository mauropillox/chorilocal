# create_admin.py
import os
import sqlite3
from db import crear_tablas, get_usuario as obtener_usuario_por_username, add_usuario
from auth import pwd_context

DB_PATH = os.getenv("DB_PATH", "ventas.db")

def eliminar_db_si_es_necesario():
    if not os.path.exists(DB_PATH):
        print("📁 No existe la base de datos. Se creará una nueva.")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
        if cursor.fetchone():
            print("📁 Base de datos ya existe con tabla 'usuarios'. No se recrea.")
            return
        else:
            print("⚠️ La base existe pero no tiene la tabla 'usuarios'. Se recreará.")
    except Exception as e:
        print(f"⚠️ Error al verificar la DB: {e}. Se recreará.")
    finally:
        conn.close()

    print("⚠️ Eliminando DB existente para forzar estructura nueva...")
    os.remove(DB_PATH)

def run():
    eliminar_db_si_es_necesario()
    print("📁 Creando nueva base de datos...")
    crear_tablas()

    if not obtener_usuario_por_username("admin"):
        add_usuario(
            username="admin",
            password_hash=pwd_context.hash("admin"),
            rol="admin",
            activo=1
        )
        print("✅ Usuario admin creado")
    else:
        print("ℹ️ Usuario admin ya existe")

if __name__ == "__main__":
    run()
