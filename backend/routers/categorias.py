"""Categorias Router"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from pydantic import BaseModel, Field

import db
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)

router = APIRouter()


class Categoria(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    color: Optional[str] = "#6366f1"
    orden: Optional[int] = 0
    activa: Optional[int] = 1


class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    color: Optional[str] = "#6366f1"
    orden: Optional[int] = 0


@router.get("/categorias", response_model=List[Categoria])
@router.get("/categorias", response_model=List[Categoria])
async def get_categorias(current_user: dict = Depends(get_current_user)):
    categorias = db.get_categorias(incluir_inactivas=current_user["rol"] == "admin")
    return categorias


@router.get("/categorias/{categoria_id}", response_model=Categoria)
async def get_categoria(categoria_id: int, current_user: dict = Depends(get_current_user)):
    categoria = db.get_categoria_by_id(categoria_id)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return categoria


@router.post("/categorias", response_model=Categoria)
@router.post("/categorias", response_model=Categoria)
async def crear_categoria(categoria: CategoriaCreate, current_user: dict = Depends(get_admin_user)):
    result = db.add_categoria(categoria.model_dump())
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.put("/categorias/{categoria_id}", response_model=Categoria)
async def actualizar_categoria(categoria_id: int, categoria: CategoriaCreate, current_user: dict = Depends(get_admin_user)):
    result = db.update_categoria(categoria_id, categoria.model_dump())
    if "error" in result:
        status_code = 404 if "no encontrada" in result["error"].lower() else 400
        raise HTTPException(status_code=status_code, detail=result["error"])
    return result


@router.delete("/categorias/{categoria_id}", status_code=204)
async def eliminar_categoria(categoria_id: int, current_user: dict = Depends(get_admin_user)):
    result = db.delete_categoria(categoria_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return
