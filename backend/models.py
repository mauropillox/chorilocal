from pydantic import BaseModel, field_validator, Field
from typing import List, Optional, Dict, Any
from datetime import date

# === Standardized API Error Models ===

class APIError(BaseModel):
    """Standardized API error response"""
    error: str
    code: str
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

class ValidationErrorDetail(BaseModel):
    """Detail for validation errors"""
    field: str
    message: str
    value: Optional[Any] = None

class APIValidationError(BaseModel):
    """Validation error response with multiple field errors"""
    error: str = "Validation failed"
    code: str = "VALIDATION_ERROR"
    details: List[ValidationErrorDetail]

# Error codes for consistency
class ErrorCodes:
    # Auth errors
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_REVOKED = "TOKEN_REVOKED"
    USER_INACTIVE = "USER_INACTIVE"
    
    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_INPUT = "INVALID_INPUT"
    
    # Resource errors
    NOT_FOUND = "NOT_FOUND"
    ALREADY_EXISTS = "ALREADY_EXISTS"
    CONFLICT = "CONFLICT"
    
    # Server errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    
    # Rate limiting
    RATE_LIMITED = "RATE_LIMITED"


# === User & Auth Models ===

class Token(BaseModel):
    access_token: str
    token_type: str
    rol: str
    username: str

class User(BaseModel):
    id: Optional[int] = None
    username: str
    rol: str
    activo: bool = True
    ultimo_login: Optional[str] = None

class RolUpdate(BaseModel):
    rol: str

# === Entity Models ===

class Cliente(BaseModel):
    id: int
    nombre: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    zona: Optional[str] = None

class ClienteCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)
    direccion: Optional[str] = Field(None, max_length=300)
    zona: Optional[str] = Field(None, max_length=100)

class Producto(BaseModel):
    id: int
    nombre: str
    precio: float
    categoria_id: Optional[int] = None
    imagen_url: Optional[str] = None
    stock: Optional[float] = 0
    stock_minimo: Optional[float] = 10
    stock_tipo: Optional[str] = "unidad"

class ProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    precio: float = Field(..., ge=0)
    categoria_id: Optional[int] = None
    imagen_url: Optional[str] = None
    stock: Optional[float] = Field(0, ge=0)
    stock_minimo: Optional[float] = Field(10, ge=0)
    stock_tipo: Optional[str] = "unidad"


class StockUpdate(BaseModel):
    """Model for stock-only updates"""
    stock: float = Field(..., ge=0)
    stock_tipo: Optional[str] = None

# === Pedido Models ===

class ClienteRef(BaseModel):
    """Client reference in a pedido"""
    id: int
    nombre: Optional[str] = None

class ProductoPedido(BaseModel):
    """Product in a pedido - flexible to accept id or producto_id"""
    id: Optional[int] = None
    producto_id: Optional[int] = None
    nombre: Optional[str] = None
    precio: Optional[float] = None
    cantidad: float
    tipo: Optional[str] = "unidad"

class PedidoItemBase(BaseModel):
    producto_id: int
    cantidad: float

class PedidoItemCreate(PedidoItemBase):
    pass

class PedidoItem(PedidoItemBase):
    id: int
    pedido_id: int
    precio_unitario: float

    class Config:
        from_attributes = True

class Pedido(BaseModel):
    id: int
    cliente_id: Optional[int] = None
    fecha: Optional[str] = None  # Stored as TEXT in DB
    estado: Optional[str] = "pendiente"
    notas: Optional[str] = None
    creado_por: Optional[str] = None
    cliente_nombre: Optional[str] = None  # From JOIN
    pdf_generado: Optional[int] = 0
    cliente: Optional[ClienteRef] = None
    productos: Optional[List[ProductoPedido]] = None

class PedidoCreate(BaseModel):
    """Pedido creation - accepts both formats"""
    cliente_id: Optional[int] = None
    cliente: Optional[ClienteRef] = None
    notas: Optional[str] = None
    items: Optional[List[PedidoItemCreate]] = None
    productos: Optional[List[ProductoPedido]] = None
    pdf_generado: Optional[bool] = False

class PedidoItemDetalle(BaseModel):
    producto_id: int
    producto_nombre: str
    cantidad: float
    precio_unitario: float

class PedidoDetalle(BaseModel):
    id: int
    cliente_id: int
    fecha: str
    estado: Optional[str] = "pendiente"
    notas: Optional[str] = None
    creado_por: Optional[str] = None
    cliente_nombre: Optional[str] = None
    pdf_generado: Optional[int] = 0
    items: List[PedidoItemDetalle]

class EstadoPedidoUpdate(BaseModel):
    estado: str
    repartidor: Optional[str] = None
