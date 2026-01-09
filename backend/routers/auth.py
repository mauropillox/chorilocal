"""Authentication and User Management Router"""
from fastapi import APIRouter, Depends, HTTPException, Form, Request
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta, timezone
from typing import List
import logging
from jose import jwt

import db
import models
from deps import (
    hash_password, create_access_token, get_current_user, 
    get_admin_user, verify_password, validate_password_strength,
    ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM, limiter,
    RATE_LIMIT_AUTH, RATE_LIMIT_READ, RATE_LIMIT_WRITE
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=models.Token)
@limiter.limit(RATE_LIMIT_AUTH)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.get_user(form_data.username)
    
    # User not found or wrong password
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    # User is inactive
    if not user.get("activo"):
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada. Contacta al administrador.")

    # Record login timestamp
    try:
        db.record_login(form_data.username)
    except Exception as e:
        logger.warning(f"Failed to record login for {form_data.username}: {e}")
        # Don't fail login if recording fails

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "rol": user["rol"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "rol": user["rol"], "username": user["username"]}


@router.post("/register")
@limiter.limit(RATE_LIMIT_AUTH)
async def register(
    request: Request, 
    form_data: OAuth2PasswordRequestForm = Depends(), 
    rol: str = Form("vendedor"),
    current_user: dict = Depends(get_admin_user)  # Only admins can register new users
):
    """Register a new user - ADMIN ONLY for security"""
    is_valid, msg = validate_password_strength(form_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    if rol not in ["admin", "vendedor", "oficina", "usuario"]:
        raise HTTPException(status_code=400, detail="Rol no válido")

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM usuarios WHERE username = ?", (form_data.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")

        hashed_pwd = hash_password(form_data.password)
        cursor.execute(
            "INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)",
            (form_data.username, hashed_pwd, rol)
        )
    return {"msg": "Usuario registrado exitosamente"}


@router.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=List[models.User])
async def get_users(current_user: dict = Depends(get_admin_user)):
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, rol, activo FROM usuarios")
        users = cursor.fetchall()
    return [models.User(id=u[0], username=u[1], rol=u[2], activo=u[3]) for u in users]


@router.put("/users/{user_id}/rol", response_model=models.User)
async def cambiar_rol_usuario(user_id: int, rol_update: models.RolUpdate, current_user: dict = Depends(get_admin_user)):
    nuevo_rol = rol_update.rol
    if nuevo_rol not in ["admin", "vendedor", "oficina"]:
        raise HTTPException(status_code=400, detail="Rol no válido. Roles permitidos: admin, vendedor, oficina.")

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM usuarios WHERE id = ?", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        cursor.execute("UPDATE usuarios SET rol = ? WHERE id = ?", (nuevo_rol, user_id))

        cursor.execute("SELECT id, username, rol, activo FROM usuarios WHERE id = ?", (user_id,))
        user_actualizado = cursor.fetchone()

    return models.User(id=user_actualizado[0], username=user_actualizado[1], rol=user_actualizado[2], activo=user_actualizado[3])


@router.put("/users/{user_id}/toggle_active", response_model=models.User)
async def toggle_active_usuario(user_id: int, current_user: dict = Depends(get_admin_user)):
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT activo FROM usuarios WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if user is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        nuevo_estado = not user[0]
        cursor.execute("UPDATE usuarios SET activo = ? WHERE id = ?", (nuevo_estado, user_id))

        cursor.execute("SELECT id, username, rol, activo FROM usuarios WHERE id = ?", (user_id,))
        user_actualizado = cursor.fetchone()

    return models.User(id=user_actualizado[0], username=user_actualizado[1], rol=user_actualizado[2], activo=user_actualizado[3])


@router.post("/logout")
async def logout(request: Request, current_user: dict = Depends(get_current_user)):
    """Logout endpoint - revokes the current token"""
    # Get the token from the request header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                # Convert exp (timestamp) to datetime
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                db.revoke_token(jti, expires_at, current_user["username"])
        except jwt.ExpiredSignatureError:
            pass  # Token already expired - no need to revoke
        except Exception as e:
            logger.warning(f"Failed to revoke token for {current_user['username']}: {e}")
            # Continue with logout even if revocation fails
    
    return {"msg": "Sesión cerrada exitosamente"}


@router.post("/refresh")
@limiter.limit(RATE_LIMIT_AUTH)
async def refresh_token(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Refresh access token - issues a new token if the current one is still valid.
    This allows clients to extend their session without re-authenticating.
    """
    # Issue a new token with fresh expiration
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_token = create_access_token(
        data={"sub": current_user["username"], "rol": current_user["rol"]}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": new_token, 
        "token_type": "bearer", 
        "rol": current_user["rol"], 
        "username": current_user["username"]
    }
