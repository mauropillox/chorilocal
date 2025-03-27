from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
import os
from passlib.context import CryptContext
import db  # Ahora importamos las funciones de db.py

# ==== CONFIG ====
DB_PATH = os.getenv("DB_PATH", "ventas.db")
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ==== DB CHECK ====
db.verificar_tablas_y_columnas()

# ==== APP ====
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ==== HELPERS ====
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

# ==== MODELOS ====
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
    tipo: str  # 'unidad' o 'caja'

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
def register(form_data: OAuth2PasswordRequestForm = Depends()):
    password_hash = hash_password(form_data.password)
    if db.add_usuario(form_data.username, password_hash):  # Llamada a la función de db.py
        return {"ok": True}
    raise HTTPException(status_code=400, detail="Usuario ya existe")

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.get_usuario(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(data={"sub": form_data.username, "rol": user["rol"]})
    return {"access_token": token, "token_type": "bearer"}

# ==== CLIENTES ====
@app.get("/clientes")
def get_clientes(user=Depends(get_current_user)):
    return db.get_clientes()  # Usamos la función del db.py

@app.post("/clientes")
def add_cliente(cliente: Cliente, user=Depends(get_current_user)):
    return db.add_cliente(cliente.dict())  # Usamos la función del db.py

@app.put("/clientes/{cliente_id}")
def update_cliente(cliente_id: int, cliente: Cliente, user=Depends(get_current_user)):
    return db.update_cliente(cliente_id, cliente.dict())  # Usamos la función del db.py

@app.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: int, user=Depends(get_current_user)):
    return db.delete_cliente(cliente_id)  # Usamos la función del db.py

# ==== PRODUCTOS ====
@app.get("/productos")
def get_productos(user=Depends(get_current_user)):
    return db.get_productos()  # Usamos la función del db.py

@app.post("/productos")
def add_producto(producto: Producto, user=Depends(get_current_user)):
    return db.add_producto(producto.dict())  # Usamos la función del db.py

# ==== PEDIDOS ====
@app.get("/pedidos")
def get_pedidos(user=Depends(get_current_user)):
    return db.get_pedidos()  # Usamos la función del db.py

@app.post("/pedidos")
def add_pedido(pedido: Pedido, user=Depends(get_current_user)):
    return db.add_pedido(pedido.dict())  # Usamos la función del db.py

@app.delete("/pedidos/{pedido_id}")
def delete_pedido(pedido_id: int, user=Depends(get_current_user)):
    return db.delete_pedido(pedido_id)  # Usamos la función del db.py

@app.patch("/pedidos/{pedido_id}")
def update_pedido_estado(pedido_id: int, user=Depends(get_current_user)):
    return db.update_pedido_estado(pedido_id, True)  # Usamos la función del db.py
