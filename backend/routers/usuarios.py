"""Usuarios Router - Spanish endpoints for user management"""
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import List

import db
import models
from deps import get_admin_user, hash_password, validate_password_strength

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


@router.get("", response_model=List[models.User])
async def get_usuarios(current_user: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, rol, activo, last_login FROM usuarios ORDER BY id")
        users = cursor.fetchall()
    return [
        models.User(
            id=u[0], 
            username=u[1], 
            rol=u[2], 
            activo=u[3],
            ultimo_login=u[4] if len(u) > 4 else None
        ) for u in users
    ]


@router.put("/{user_id}/activar", response_model=models.User)
async def activar_usuario(user_id: int, current_user: dict = Depends(get_admin_user)):
    """Activate a user"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM usuarios WHERE id = ?", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        cursor.execute("UPDATE usuarios SET activo = 1 WHERE id = ?", (user_id,))
        cursor.execute("SELECT id, username, rol, activo FROM usuarios WHERE id = ?", (user_id,))
        user = cursor.fetchone()

    return models.User(id=user[0], username=user[1], rol=user[2], activo=user[3])


@router.put("/{user_id}/desactivar", response_model=models.User)
async def desactivar_usuario(user_id: int, current_user: dict = Depends(get_admin_user)):
    """Deactivate a user"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM usuarios WHERE id = ?", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        cursor.execute("UPDATE usuarios SET activo = 0 WHERE id = ?", (user_id,))
        cursor.execute("SELECT id, username, rol, activo FROM usuarios WHERE id = ?", (user_id,))
        user = cursor.fetchone()

    return models.User(id=user[0], username=user[1], rol=user[2], activo=user[3])


@router.put("/{user_id}/rol")
async def cambiar_rol(user_id: int, rol: str = Form(...), current_user: dict = Depends(get_admin_user)):
    """Change user role. Valid roles: admin, oficina, vendedor"""
    if rol not in ["admin", "vendedor", "oficina"]:
        raise HTTPException(status_code=400, detail="Rol no válido. Roles permitidos: admin, oficina, vendedor")

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM usuarios WHERE id = ?", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        cursor.execute("UPDATE usuarios SET rol = ? WHERE id = ?", (rol, user_id))
        cursor.execute("SELECT id, username, rol, activo FROM usuarios WHERE id = ?", (user_id,))
        user = cursor.fetchone()

    return models.User(id=user[0], username=user[1], rol=user[2], activo=user[3])


@router.delete("/{user_id}")
async def eliminar_usuario(user_id: int, current_user: dict = Depends(get_admin_user)):
    """Delete a user"""
    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id, username FROM usuarios WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if user is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Don't allow deleting yourself
        if user[1] == current_user["username"]:
            raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

        cursor.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))

    return {"msg": "Usuario eliminado exitosamente"}


@router.put("/{user_id}/password")
async def reset_password(
    user_id: int, 
    new_password: str = Form(...),
    current_user: dict = Depends(get_admin_user)
):
    """Reset user password (admin only)"""
    is_valid, msg = validate_password_strength(new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    with db.get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM usuarios WHERE id = ?", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        hashed_pwd = hash_password(new_password)
        cursor.execute("UPDATE usuarios SET password_hash = ? WHERE id = ?", (hashed_pwd, user_id))

    return {"msg": "Contraseña actualizada exitosamente"}
