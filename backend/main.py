from fastapi import FastAPI, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
import os
from passlib.context import CryptContext
import db

DB_PATH = os.getenv("DB_PATH", "ventas.db")
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

db.verificar_tablas_y_columnas()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(password: str, hash: str):
    return pwd_context.verify(password, hash)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"username": payload.get("sub"), "rol": payload.get("rol")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

class Cliente(BaseModel):
    id: Optional[int] = None
    nombre: str
    telefono: str = ""
    direccion: str = ""

class Producto(BaseModel):
    id: Optional[int] = None
    nombre: str
    precio: float

class ProductoConCantidad(Producto):
    cantidad: float
    tipo: str

    @validator('tipo')
    def validar_tipo(cls, v):
        if v not in ['unidad', 'caja']:
            raise ValueError("El tipo debe ser 'unidad' o 'caja'")
        return v

class Pedido(BaseModel):
    id: Optional[int] = None
    cliente: Cliente
    productos: List[ProductoConCantidad]
    fecha: Optional[str] = None
    pdf_generado: bool = False

# ==== AUTENTICACIÓN ====
@app.post("/register")
def register(
    form_data: OAuth2PasswordRequestForm = Depends(),
    rol: str = Form("usuario")  # Campo de rol por defecto como "usuario"
):
    password_hash = hash_password(form_data.password)
    if db.add_usuario(form_data.username, password_hash, rol):
        return {"ok": True}
    raise HTTPException(status_code=400, detail="Usuario ya existe")

@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    user = db.get_usuario(username)
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(data={"sub": username, "rol": user["rol"]})
    return {"access_token": token, "token_type": "bearer"}

# ==== CLIENTES ====
@app.get("/clientes")
def get_clientes(user=Depends(get_current_user)):
    return db.get_clientes()

@app.post("/clientes")
def add_cliente(cliente: Cliente, user=Depends(get_current_user)):
    return db.add_cliente(cliente.dict())

@app.put("/clientes/{cliente_id}")
def update_cliente(cliente_id: int, cliente: Cliente, user=Depends(get_current_user)):
    return db.update_cliente(cliente_id, cliente.dict())

@app.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: int, user=Depends(get_current_user)):
    return db.delete_cliente(cliente_id)

# ==== PRODUCTOS ====
@app.get("/productos")
def get_productos(user=Depends(get_current_user)):
    return db.get_productos()

@app.post("/productos")
def add_producto(producto: Producto, user=Depends(get_current_user)):
    return db.add_producto(producto.dict())

# ==== PEDIDOS ====
@app.get("/pedidos")
def get_pedidos(user=Depends(get_current_user)):
    return db.get_pedidos()

@app.post("/pedidos")
def add_pedido(pedido: Pedido, user=Depends(get_current_user)):
    return db.add_pedido(pedido.dict())

@app.delete("/pedidos/{pedido_id}")
def delete_pedido(pedido_id: int, user=Depends(get_current_user)):
    return db.delete_pedido(pedido_id)

@app.patch("/pedidos/{pedido_id}")
def update_pedido_estado(pedido_id: int, user=Depends(get_current_user)):
    return db.update_pedido_estado(pedido_id, 1)

# ==== COMENTADO: Configuración HTTPS futura ====
# from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
# app.add_middleware(HTTPSRedirectMiddleware)
#
# Para activar SSL, necesitarás:
# - Certificados válidos en /etc/letsencrypt/live/
# - Configurar Uvicorn o Nginx con SSL en la instancia
# - Permitir tráfico HTTPS (puerto 443) en el Security Group
