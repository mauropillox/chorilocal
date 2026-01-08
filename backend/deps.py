"""
Shared dependencies for the Chorizaurio API.
Contains authentication helpers and common utilities used across routers.
"""
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from slowapi import Limiter
from slowapi.util import get_remote_address
import os
import re
import logging

import db

logger = logging.getLogger(__name__)


def _read_secret(env_var: str, file_env_var: str, default: str) -> str:
    """Read secret from environment or Docker secrets file"""
    # First try direct environment variable
    if os.getenv(env_var):
        return os.getenv(env_var)
    # Then try Docker secrets file
    file_path = os.getenv(file_env_var)
    if file_path and os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return f.read().strip()
        except Exception as e:
            logger.warning(f"Failed to read secret from {file_path}: {e}")
    return default


# --- Configuration ---
SECRET_KEY = _read_secret("SECRET_KEY", "SECRET_KEY_FILE", "a_random_secret_key_for_development")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# --- Rate Limiting Configuration ---
RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "5/minute")
RATE_LIMIT_AUTH = os.getenv("RATE_LIMIT_AUTH", "5/minute")
RATE_LIMIT_READ = os.getenv("RATE_LIMIT_READ", "100/minute")
RATE_LIMIT_WRITE = os.getenv("RATE_LIMIT_WRITE", "30/minute")

# --- Rate Limiting ---
limiter = Limiter(key_func=get_remote_address)

# --- Security ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


# --- Password Helpers ---
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password strength. Returns (is_valid, message)."""
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"
    if len(password) > 72:
        return False, "La contraseña no puede tener más de 72 caracteres"
    if not re.search(r'[A-Za-z]', password):
        return False, "La contraseña debe contener al menos una letra"
    if not re.search(r'\d', password):
        return False, "La contraseña debe contener al menos un número"
    
    common_passwords = [
        '123456', '12345678', '123456789', 'password', 'admin', 'usuario',
        'qwerty', 'password1', 'admin123', '12341234', 'password123',
    ]
    if password.lower() in common_passwords:
        return False, "Contraseña muy común. Elige una más segura"
    return True, ""


# --- Token Helpers ---
def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    jti = str(uuid4())
    to_encode.update({"exp": expire, "jti": jti})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --- Auth Dependencies ---
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Get current authenticated user from JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        rol = payload.get("rol")
        jti = payload.get("jti")
        
        if username is None or rol is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        # Check if token has been revoked
        if jti and db.is_token_revoked(jti):
            raise HTTPException(status_code=401, detail="Sesión cerrada. Inicia sesión nuevamente.")
        
        user_db = db.get_user(username)
        if not user_db or not user_db.get("activo"):
            raise HTTPException(status_code=401, detail="Usuario inactivo")

        return {"username": username, "rol": rol}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    """Require admin role."""
    if user.get("rol") not in ["admin", "administrador"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores.")
    return user


def get_oficina_or_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin or oficina role."""
    if user.get("rol") not in ["admin", "oficina", "administrador"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores u oficina.")
    return user
