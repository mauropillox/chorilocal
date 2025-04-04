# create_admin.py

import os
from db import crear_tablas, get_usuario as obtener_usuario_por_username, add_usuario
from auth import pwd_context

DB_PATH = os.getenv("DB_PATH", "ventas.db")

def run():
    # ⚠️ SOLO PARA PRIMER DEPLOY - Borra DB vieja si existe
    if os.path.exists(DB_PATH):
        print("⚠️ Eliminando DB existente para forzar estructura nueva...")
        os.remove(DB_PATH)

    print("📁 Creando nueva base de datos...")
    crear_tablas()

    if not obtener_usuario_por_username("admin"):
        hashed_pw = pwd_context.hash("admin")
        add_usuario("admin", hashed_pw, rol="admin", activo=1)
        print("✅ Usuario admin creado")
    else:
        print("ℹ️ Usuario admin ya existe")

if __name__ == "__main__":
    run()
