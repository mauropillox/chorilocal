# auth.py
import os
import sqlite3
from datetime import datetime, timedelta
from fastapi import HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuración del token
SECRET_KEY = os.getenv("SECRET_KEY", "clave_de_prueba")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def conectar():
    return sqlite3.connect(os.getenv("DB_PATH", "ventas.db"))

def authenticate_user(username: str, plain_password: str):
    """Devuelve el usuario si las credenciales son válidas, None si no."""
    conn = conectar()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()

    if row:
        stored_hash = row["password_hash"]
        if pwd_context.verify(plain_password, stored_hash):
            return {
                "id": row["id"],
                "username": row["username"],
                "rol": row["rol"],
                "activo": row["activo"]
            }
    return None

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Genera un JWT con 'exp' a partir de data."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        print("❌ decode_token error:", e)
        return None

def get_usuario_por_id(user_id):
    """Recupera un usuario de la base de datos por ID."""
    conn = conectar()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT id, username, rol, activo FROM usuarios WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "rol": row["rol"],
            "activo": row["activo"]
        }
    return None
