# scripts/resetadmin.py
from passlib.hash import bcrypt
import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "ventas.db")
USERNAME = "admin"
NEW_PASSWORD = "admin"

try:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT password_hash, rol, activo FROM usuarios WHERE username = ?", (USERNAME,))
    row = cur.fetchone()

    if row:
        password_hash, rol, activo = row
        # Ya es admin, activo y con contraseña correcta => no hacemos nada
        if bcrypt.verify(NEW_PASSWORD, password_hash) and rol == "admin" and activo == 1:
            print("✅ Usuario admin ya está correctamente configurado. No es necesario reiniciar.")
            conn.close()
            exit(0)
        else:
            print("🔁 Usuario admin existe pero será actualizado.")

            new_hash = bcrypt.hash(NEW_PASSWORD)
            cur.execute("""
                UPDATE usuarios
                SET password_hash = ?, rol = 'admin', activo = 1
                WHERE username = ?
            """, (new_hash, USERNAME))
    else:
        print("➕ Usuario admin no existe. Será creado.")
        new_hash = bcrypt.hash(NEW_PASSWORD)
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, 'admin', 1)
        """, (USERNAME, new_hash))

    conn.commit()
    print("✅ Usuario admin reiniciado con contraseña:", NEW_PASSWORD)

except Exception as e:
    print("❌ Error:", e)
finally:
    conn.close()
