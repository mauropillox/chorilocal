# backend_create_admin.py
from db import crear_tablas, get_usuario as obtener_usuario_por_username, crear_usuario
from auth import obtener_password_hash

def crear_admin_si_no_existe():
    crear_tablas()

    if not obtener_usuario_por_username("admin"):
        crear_usuario(
            username="admin",
            password=obtener_password_hash("admin"),
            rol="admin",
            activo=True
        )
        print("✅ Usuario admin creado")
    else:
        print("ℹ️ Usuario admin ya existe")

if __name__ == "__main__":
    crear_admin_si_no_existe()
