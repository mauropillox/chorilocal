"""Ofertas Router"""
from fastapi import APIRouter, Depends, HTTPException, Form, Request
from typing import List, Optional
from pydantic import BaseModel
import json

import db
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)

router = APIRouter()


class OfertaProducto(BaseModel):
    producto_id: int
    cantidad: Optional[int] = 1


class Oferta(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    desde: str
    hasta: str
    activa: Optional[int] = 1
    descuento_porcentaje: Optional[float] = 10.0
    productos: Optional[List[OfertaProducto]] = None


class OfertaCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    desde: str
    hasta: str
    activa: Optional[bool] = True
    descuento_porcentaje: Optional[float] = 10.0
    productos: Optional[List[OfertaProducto]] = None


@router.get("/ofertas", response_model=List[Oferta])
@router.get("/ofertas", response_model=List[Oferta])
async def get_ofertas(current_user: dict = Depends(get_current_user)):
    ofertas = db.get_ofertas(solo_activas=current_user["rol"] != "admin")
    return ofertas


@router.get("/ofertas/{oferta_id}", response_model=Oferta)
async def get_oferta(oferta_id: int, current_user: dict = Depends(get_current_user)):
    oferta = db.get_oferta_by_id(oferta_id)
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    return oferta


@router.post("/ofertas", response_model=Oferta)
@router.post("/ofertas", response_model=Oferta)
async def crear_oferta(
    current_user: dict = Depends(get_admin_user),
    titulo: str = Form(...),
    desde: str = Form(...),
    hasta: str = Form(...),
    descripcion: Optional[str] = Form(None),
    productos: Optional[str] = Form(None),  # JSON string
    descuento_porcentaje: Optional[float] = Form(10.0),
):
    productos_list = []
    if productos:
        try:
            productos_list = json.loads(productos)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in productos field")
    
    oferta_data = {
        "titulo": titulo,
        "descripcion": descripcion,
        "desde": desde,
        "hasta": hasta,
        "activa": True,
        "descuento_porcentaje": descuento_porcentaje,
        "productos": productos_list
    }
    
    try:
        result = db.add_oferta(oferta_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/ofertas/{oferta_id}", response_model=Oferta)
async def actualizar_oferta(oferta_id: int, oferta: OfertaCreate, current_user: dict = Depends(get_admin_user)):
    result = db.update_oferta(oferta_id, oferta.model_dump())
    return result


@router.delete("/ofertas/{oferta_id}", status_code=204)
async def eliminar_oferta(oferta_id: int, current_user: dict = Depends(get_admin_user)):
    result = db.delete_oferta(oferta_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return
