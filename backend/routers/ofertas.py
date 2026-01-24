"""Ofertas Router - Sistema flexible de ofertas"""
from fastapi import APIRouter, Depends, HTTPException, Form, Request
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import json

import db
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ, RATE_LIMIT_WRITE
)
from exceptions import safe_error_handler
from logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


class TipoOferta(str, Enum):
    """Tipos de ofertas disponibles"""
    PORCENTAJE = "porcentaje"              # Descuento por porcentaje
    PRECIO_CANTIDAD = "precio_cantidad"    # Usuario define cantidad→precio
    NXM = "nxm"                           # 3x2, 2x1, etc
    REGALO = "regalo"                     # Regalo producto al comprar X


class ReglaOferta(BaseModel):
    """Regla de precio por cantidad"""
    cantidad: int = Field(..., description="Cantidad mínima para aplicar este precio", ge=1)
    precio_unitario: float = Field(..., description="Precio unitario a partir de esta cantidad", ge=0)


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
    tipo: Optional[str] = "porcentaje"
    
    # Descuento porcentaje (tipo: porcentaje)
    descuento_porcentaje: Optional[float] = None
    
    # Reglas de precio por cantidad (tipo: precio_cantidad)
    reglas: Optional[List[ReglaOferta]] = None
    
    # NxM (tipo: nxm)
    compra_cantidad: Optional[int] = None
    paga_cantidad: Optional[int] = None
    
    # Regalo (tipo: regalo)
    regalo_producto_id: Optional[int] = None
    regalo_cantidad: Optional[int] = None
    
    productos: Optional[List[OfertaProducto]] = None


class OfertaCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    desde: str
    hasta: str
    activa: Optional[bool] = True
    tipo: TipoOferta = TipoOferta.PORCENTAJE
    
    # Descuento porcentaje
    descuento_porcentaje: Optional[float] = Field(None, ge=0, le=100)
    
    # Precio por cantidad
    reglas: Optional[List[ReglaOferta]] = None
    
    # NxM
    compra_cantidad: Optional[int] = Field(None, ge=2)
    paga_cantidad: Optional[int] = Field(None, ge=1)
    
    # Regalo
    regalo_producto_id: Optional[int] = None
    regalo_cantidad: Optional[int] = Field(1, ge=1)
    
    productos: Optional[List[OfertaProducto]] = None


@router.get("/ofertas", response_model=List[Oferta])
async def get_ofertas(current_user: dict = Depends(get_current_user)):
    """Get ofertas - all authenticated users can view, admins see all including inactive"""
    ofertas = db.get_ofertas(solo_activas=current_user["rol"] != "admin")
    return ofertas


@router.get("/ofertas/activas")
@limiter.limit(RATE_LIMIT_READ)
async def get_ofertas_activas(request: Request):
    """Get only active offers - PUBLIC endpoint for dashboard and frontend"""
    try:
        ofertas = db.get_ofertas(solo_activas=True)
        result = []
        for o in ofertas:
            oferta_dict = {
                "id": o.get("id"),
                "titulo": o.get("titulo"),
                "tipo": o.get("tipo", "porcentaje"),
                "descuento_porcentaje": o.get("descuento_porcentaje"),
                "reglas": o.get("reglas"),
                "compra_cantidad": o.get("compra_cantidad"),
                "paga_cantidad": o.get("paga_cantidad"),
                "regalo_producto_id": o.get("regalo_producto_id"),
                "regalo_cantidad": o.get("regalo_cantidad"),
                "productos_ids": []
            }
            if o.get("productos"):
                for p in o["productos"]:
                    if isinstance(p, dict) and p.get("producto_id"):
                        oferta_dict["productos_ids"].append(p["producto_id"])
                    elif isinstance(p, int):
                        oferta_dict["productos_ids"].append(p)
            result.append(oferta_dict)
        return result
    except Exception as e:
        return []


@router.get("/ofertas/{oferta_id}", response_model=Oferta)
async def get_oferta(oferta_id: int, current_user: dict = Depends(get_current_user)):
    """Get specific offer by ID"""
    oferta = db.get_oferta_by_id(oferta_id)
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    return oferta


@router.post("/ofertas", response_model=Oferta)
async def crear_oferta(
    current_user: dict = Depends(get_admin_user),
    titulo: str = Form(...),
    desde: str = Form(...),
    hasta: str = Form(...),
    tipo: str = Form("porcentaje"),
    descripcion: Optional[str] = Form(None),
    productos: Optional[str] = Form(None),  # JSON string
    descuento_porcentaje: Optional[float] = Form(None),
    reglas: Optional[str] = Form(None),  # JSON string
    compra_cantidad: Optional[int] = Form(None),
    paga_cantidad: Optional[int] = Form(None),
    regalo_producto_id: Optional[int] = Form(None),
    regalo_cantidad: Optional[int] = Form(1),
):
    """Create new offer - Admin only - Form-based for frontend compatibility"""
    # Parse JSON fields
    productos_list = []
    if productos:
        try:
            productos_list = json.loads(productos)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in productos field")
    
    reglas_list = None
    if reglas:
        try:
            reglas_list = json.loads(reglas)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in reglas field")
    
    # Validate offer type requirements
    if tipo == "porcentaje":
        if descuento_porcentaje is None:
            raise HTTPException(status_code=400, detail="descuento_porcentaje requerido para tipo porcentaje")
    
    elif tipo == "precio_cantidad":
        if not reglas_list or len(reglas_list) == 0:
            raise HTTPException(status_code=400, detail="reglas requeridas para tipo precio_cantidad")
    
    elif tipo == "nxm":
        if not compra_cantidad or not paga_cantidad:
            raise HTTPException(status_code=400, detail="compra_cantidad y paga_cantidad requeridos para tipo nxm")
        if paga_cantidad >= compra_cantidad:
            raise HTTPException(status_code=400, detail="paga_cantidad debe ser menor que compra_cantidad")
    
    elif tipo == "regalo":
        if not regalo_producto_id:
            raise HTTPException(status_code=400, detail="regalo_producto_id requerido para tipo regalo")
    
    oferta_data = {
        "titulo": titulo,
        "descripcion": descripcion,
        "desde": desde,
        "hasta": hasta,
        "activa": True,
        "tipo": tipo,
        "descuento_porcentaje": descuento_porcentaje,
        "reglas": reglas_list,
        "compra_cantidad": compra_cantidad,
        "paga_cantidad": paga_cantidad,
        "regalo_producto_id": regalo_producto_id,
        "regalo_cantidad": regalo_cantidad,
        "productos": productos_list
    }
    
    try:
        result = db.add_oferta(oferta_data)
        return result
    except Exception as e:
        logger.error(f"Error creating oferta: {type(e).__name__}: {str(e)}")
        raise safe_error_handler(e, "ofertas", "crear oferta")


@router.put("/ofertas/{oferta_id}", response_model=Oferta)
async def actualizar_oferta(
    oferta_id: int, 
    oferta: OfertaCreate, 
    current_user: dict = Depends(get_admin_user)
):
    """Update offer - Admin only"""
    # Same validations as create
    if oferta.tipo == TipoOferta.PORCENTAJE:
        if oferta.descuento_porcentaje is None:
            raise HTTPException(status_code=400, detail="descuento_porcentaje requerido para tipo porcentaje")
    
    elif oferta.tipo == TipoOferta.PRECIO_CANTIDAD:
        if not oferta.reglas or len(oferta.reglas) == 0:
            raise HTTPException(status_code=400, detail="reglas requeridas para tipo precio_cantidad")
        sorted_reglas = sorted(oferta.reglas, key=lambda x: x.cantidad)
        if sorted_reglas != oferta.reglas:
            oferta.reglas = sorted_reglas
    
    elif oferta.tipo == TipoOferta.NXM:
        if not oferta.compra_cantidad or not oferta.paga_cantidad:
            raise HTTPException(status_code=400, detail="compra_cantidad y paga_cantidad requeridos para tipo nxm")
        if oferta.paga_cantidad >= oferta.compra_cantidad:
            raise HTTPException(status_code=400, detail="paga_cantidad debe ser menor que compra_cantidad")
    
    elif oferta.tipo == TipoOferta.REGALO:
        if not oferta.regalo_producto_id:
            raise HTTPException(status_code=400, detail="regalo_producto_id requerido para tipo regalo")
    
    try:
        result = db.update_oferta(oferta_id, oferta.model_dump())
        return result
    except Exception as e:
        raise safe_error_handler(e, "ofertas", "actualizar oferta")


@router.delete("/ofertas/{oferta_id}", status_code=204)
async def eliminar_oferta(
    oferta_id: int, 
    current_user: dict = Depends(get_admin_user)
):
    """Delete offer - Admin only"""
    result = db.delete_oferta(oferta_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return


@router.post("/ofertas/{oferta_id}/toggle")
async def toggle_oferta(
    oferta_id: int,
    current_user: dict = Depends(get_admin_user)
):
    """Toggle offer active status - Admin only
    
    Activates or deactivates an offer. When activating, if the offer dates
    are in the past, they will be automatically updated to start today.
    """
    try:
        oferta = db.get_oferta_by_id(oferta_id)
        if not oferta:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        
        # Toggle activa status (SQLite returns 0/1 for boolean)
        nueva_activa = not bool(oferta.get('activa', 0))
        oferta['activa'] = nueva_activa
        
        # If activating and dates are in the past, update them
        fechas_actualizadas = False
        
        if nueva_activa:
            from datetime import datetime, timedelta
            hoy = datetime.now().date()
            
            # Handle date parsing (SQLite can return strings or dates)
            desde_str = oferta.get('desde', '')
            hasta_str = oferta.get('hasta', '')
            
            if isinstance(desde_str, str):
                desde = datetime.fromisoformat(desde_str.replace('Z', '+00:00').split('T')[0]).date()
            else:
                desde = desde_str
                
            if isinstance(hasta_str, str):
                hasta = datetime.fromisoformat(hasta_str.replace('Z', '+00:00').split('T')[0]).date()
            else:
                hasta = hasta_str
            
            # If offer ended or hasn't started yet, update dates
            if hasta < hoy or desde > hoy:
                oferta['desde'] = hoy.isoformat()
                oferta['hasta'] = (hoy + timedelta(days=30)).isoformat()
                fechas_actualizadas = True
        
        # Update the offer with all fields
        result = db.update_oferta(oferta_id, oferta)
        
        response = {
            "success": True,
            "activa": nueva_activa,
            "fechas_actualizadas": fechas_actualizadas
        }
        
        if fechas_actualizadas:
            response["desde"] = oferta['desde']
            response["hasta"] = oferta['hasta']
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling oferta {oferta_id}: {type(e).__name__}: {str(e)}")
        raise safe_error_handler(e, "ofertas", "toggle oferta")
# Force redeploy - Sat Jan 24 20:19:11 -03 2026
