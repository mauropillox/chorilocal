# backend_create_admin.py
from db import get_db, crear_tablas, obtener_usuario_por_username, crear_usuario
from auth import obtener_password_hash

def run():
    crear_tablas()
    db = next(get_db())

    if not obtener_usuario_por_username(db, "admin"):
        crear_usuario(
            db,
            username="admin",
            password=obtener_password_hash("admin"),
            rol="admin",
            activo=True
        )
        print("✅ Usuario admin creado")
    else:
        print("ℹ️ Usuario admin ya existe")

if __name__ == "__main__":
    run()
