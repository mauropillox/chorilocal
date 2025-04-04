from db import crear_tablas, get_usuario as obtener_usuario_por_username, add_usuario
from auth import pwd_context

def run():
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
