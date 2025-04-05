# create_admin.py
import os
import sqlite3
from db import crear_tablas, get_usuario as obtener_usuario_por_username, add_usuario
from auth import pwd_context

DB_PATH = os.getenv("DB_PATH", "ventas.db")

def verificar_estructura_usuarios():
    """Verifica si la tabla 'usuarios' existe y tiene la columna 'username'."""
    if not os.path.exists(DB_PATH):
        print("📁 No existe la base de datos. Se creará una nueva.")
        return False

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(usuarios)")
        columnas = [col[1] for col in cursor.fetchall()]
        conn.close()

        if "username" in columnas:
            print("📁 Base de datos ya existe con tabla 'usuarios'. No se recrea.")
            return True
        else:
            print("⚠️ La tabla 'usuarios' existe pero no tiene columna 'username'. Se recreará.")
            return False
    except Exception as e:
        print(f"⚠️ Error verificando estructura de la tabla: {e}. Se recreará.")
        return False

def eliminar_db():
    if os.path.exists(DB_PATH):
        print("⚠️ Eliminando base de datos existente...")
        os.remove(DB_PATH)

def run():
    if not verificar_estructura_usuarios():
        eliminar_db()
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
