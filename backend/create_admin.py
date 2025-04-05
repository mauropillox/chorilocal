import os
import sqlite3
from db import crear_tablas, get_usuario as obtener_usuario_por_username, add_usuario
from auth import pwd_context

DB_PATH = os.getenv("DB_PATH", "ventas.db")

def db_tiene_tabla_usuarios():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
        existe = cursor.fetchone() is not None
        conn.close()
        return existe
    except Exception as e:
        print(f"⚠️ Error al revisar la tabla 'usuarios': {e}")
        return False

def eliminar_db_si_es_necesario():
    if not os.path.exists(DB_PATH):
        print("📁 No existe la base de datos. Se creará una nueva.")
        return True

    if not db_tiene_tabla_usuarios():
        print("⚠️ La base existe pero no tiene tabla 'usuarios'. Se recreará.")
        try:
            os.remove(DB_PATH)
            return True
        except Exception as e:
            print(f"❌ Error al eliminar la base de datos: {e}")
            return False
    else:
        print("📁 Base de datos ya existe con tabla 'usuarios'. No se recrea.")
        return False

def run():
    debe_crearse = eliminar_db_si_es_necesario()

    if debe_crearse:
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
