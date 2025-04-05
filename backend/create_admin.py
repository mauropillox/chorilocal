# create_admin.py
import os
import sqlite3
from db import crear_tablas, get_usuario as obtener_usuario_por_username, add_usuario
from auth import pwd_context

DB_PATH = os.getenv("DB_PATH", "ventas.db")

def necesita_recrearse_la_db():
    if not os.path.exists(DB_PATH):
        print("📁 No existe la base de datos. Se creará una nueva.")
        return True

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verificar existencia de la tabla 'usuarios'
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
        if not cursor.fetchone():
            print("⚠️ Tabla 'usuarios' no encontrada.")
            return True

        # Verificar que tenga columna 'username'
        cursor.execute("PRAGMA table_info(usuarios)")
        columnas = [row[1] for row in cursor.fetchall()]
        if "username" not in columnas:
            print("⚠️ La tabla 'usuarios' no tiene la columna 'username'.")
            return True

        print("📁 Base de datos ya existe con tabla 'usuarios'. No se recrea.")
        return False
    except Exception as e:
        print(f"⚠️ Error al revisar la DB: {e}")
        return True
    finally:
        conn.close()

def run():
    if necesita_recrearse_la_db():
        print("⚠️ Eliminando DB existente para forzar estructura nueva...")
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        print("📁 Creando nueva base de datos...")
        crear_tablas()

    # Crear admin si no existe
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
