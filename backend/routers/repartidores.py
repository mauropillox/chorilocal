"""Repartidores Router - CRUD for delivery drivers management"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3

import db
from deps import get_current_user, get_admin_user, limiter, RATE_LIMIT_READ, RATE_LIMIT_WRITE

router = APIRouter()


class RepartidorCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    telefono: Optional[str] = Field(None, max_length=20)
    color: Optional[str] = Field(None, max_length=20)  # Hex color for UI


class RepartidorUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    telefono: Optional[str] = Field(None, max_length=20)
    color: Optional[str] = Field(None, max_length=20)
    activo: Optional[int] = Field(None, ge=0, le=1)


class Repartidor(BaseModel):
    id: int
    nombre: str
    telefono: Optional[str] = None
    color: Optional[str] = None
    activo: int = 1


@router.get("/repartidores", response_model=List[Repartidor])
@limiter.limit(RATE_LIMIT_READ)
async def get_repartidores(
    request: Request,
    current_user: dict = Depends(get_current_user),
    incluir_inactivos: bool = False
):
    """Get all repartidores (delivery drivers)"""
    repartidores = db.get_repartidores(solo_activos=not incluir_inactivos)
    return repartidores


@router.get("/repartidores/{repartidor_id}", response_model=Repartidor)
@limiter.limit(RATE_LIMIT_READ)
async def get_repartidor(
    request: Request,
    repartidor_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific repartidor by ID"""
    repartidor = db.get_repartidor_by_id(repartidor_id)
    if not repartidor:
        raise HTTPException(status_code=404, detail="Repartidor no encontrado")
    return repartidor


@router.post("/repartidores", response_model=Repartidor, status_code=201)
@limiter.limit(RATE_LIMIT_WRITE)
async def create_repartidor(
    request: Request,
    repartidor: RepartidorCreate,
    current_user: dict = Depends(get_current_user)  # Any authenticated user can create
):
    """Create a new repartidor"""
    try:
        result = db.add_repartidor(
            nombre=repartidor.nombre,
            telefono=repartidor.telefono,
            color=repartidor.color
        )
        return result
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Ya existe un repartidor con ese nombre")
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Ya existe un repartidor con ese nombre")
        raise HTTPException(status_code=500, detail="Error al crear repartidor")


@router.put("/repartidores/{repartidor_id}", response_model=Repartidor)
@limiter.limit(RATE_LIMIT_WRITE)
async def update_repartidor(
    request: Request,
    repartidor_id: int,
    repartidor: RepartidorUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing repartidor"""
    try:
        result = db.update_repartidor(
            repartidor_id=repartidor_id,
            nombre=repartidor.nombre,
            telefono=repartidor.telefono,
            color=repartidor.color,
            activo=repartidor.activo
        )
        # Atomic check - None means not found
        if result is None:
            raise HTTPException(status_code=404, detail="Repartidor no encontrado")
        return result
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Ya existe un repartidor con ese nombre")
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Ya existe un repartidor con ese nombre")
        raise HTTPException(status_code=500, detail="Error al actualizar repartidor")


@router.delete("/repartidores/{repartidor_id}")
@limiter.limit(RATE_LIMIT_WRITE)
async def delete_repartidor(
    request: Request,
    repartidor_id: int,
    current_user: dict = Depends(get_admin_user)  # Only admins can delete
):
    """Delete (deactivate) a repartidor"""
    result = db.delete_repartidor(repartidor_id)
    # Atomic check - None means not found
    if result is None:
        raise HTTPException(status_code=404, detail="Repartidor no encontrado")
    return {"msg": "Repartidor desactivado exitosamente"}
