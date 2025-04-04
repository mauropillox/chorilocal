# backend/create_admin.py
import sqlite3
import bcrypt
import os

DB_PATH = os.getenv("DB_PATH", "ventas.db")

def crear_admin_si_no_existe():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM usuarios WHERE username = ?", ("admin",))
    if cursor.fetchone():
        print("Usuario admin ya existe.")
        return

    hashed_password = bcrypt.hashpw("admin".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    cursor.execute("""
        INSERT INTO usuarios (username, hashed_password, rol, activo, last_login)
        VALUES (?, ?, ?, ?, datetime('now'))
    """, ("admin", hashed_password, "admin", 1))

    conn.commit()
    conn.close()
    print("Usuario admin creado.")

if __name__ == "__main__":
    crear_admin_si_no_existe()
