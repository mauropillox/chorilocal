# main.py
from fastapi import FastAPI, HTTPException, Depends, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, field_validator
from typing import List, Optional
import os
import db
from auth import authenticate_user, create_access_token, decode_token, get_usuario_por_id
from auth import pwd_context
from dotenv import load_dotenv
import create_admin  # esto va arriba de todo

create_admin.crear_admin_si_no_existe()  # esto se ejecuta al arrancar

load_dotenv()

# Configuración de logging (opcional, para producción/desarrollo)
import logging
DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() == "true"
logging.basicConfig(
    level=logging.DEBUG if DEBUG_MODE else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "ventas.db")
SECRET_KEY = os.getenv("SECRET_KEY", "clave_de_prueba")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
db.crear_tablas()
db.crear_tabla_detalles_pedido()
db.verificar_tablas_y_columnas()

# -- Dependencies
def get_current_user(token: str = Depends(oauth2_scheme)):
    logger.debug("🔐 Recibí token: %s", token)
    payload = decode_token(token)
    logger.debug("🧠 Payload decodificado: %s", payload)

    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user_id = payload.get("sub")
    logger.debug("🔎 Buscando usuario por ID: %s", user_id)

    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido: falta 'sub'")

    user = get_usuario_por_id(user_id)
    logger.debug("👤 Usuario en DB: %s", user)

    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user["activo"]:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    return user

def obtener_usuario_actual_admin(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    if payload.get("rol") != "admin":
        raise HTTPException(status_code=403, detail="No autorizado: se requiere rol admin")
    return payload

# -- Pydantic models
class Cliente(BaseModel):
    id: Optional[int] = None
    nombre: str
    telefono: str = ""
    direccion: str = ""

class Producto(BaseModel):
    id: Optional[int] = None
    nombre: str
    precio: Optional[float] = None

class ProductoConCantidad(BaseModel):
    producto_id: int
    cantidad: float
    tipo: str

    @field_validator("tipo")
    def validar_tipo(cls, v):
        if v not in ["unidad", "caja"]:
            raise ValueError("El tipo debe ser 'unidad' o 'caja'")
        return v

    @field_validator("cantidad")
    def validar_cantidad_valores_validos(cls, v):
        if v % 0.5 != 0:
            raise ValueError("La cantidad debe ser un múltiplo de 0.5")
        return v

    @field_validator("producto_id")
    def validar_producto_id(cls, v):
        if v <= 0:
            raise ValueError("producto_id debe ser un entero positivo")
        return v

class PedidoProductoInput(BaseModel):
    producto_id: int
    cantidad: float
    tipo: str

    @field_validator("tipo")
    def validar_tipo(cls, v):
        if v not in ["unidad", "caja"]:
            raise ValueError("El tipo debe ser 'unidad' o 'caja'")
        return v

    @field_validator("cantidad")
    def validar_cantidad_valores_validos(cls, v):
        if v % 0.5 != 0:
            raise ValueError("La cantidad debe ser un múltiplo de 0.5 (ej. 0.5, 1.0, 1.5, 2.0)")
        return v

class PedidoInput(BaseModel):
    cliente_id: int
    observaciones: Optional[str] = None
    productos: List[PedidoProductoInput]
    fecha: Optional[str] = None
    pdf_generado: Optional[bool] = False

class EstadoPedido(BaseModel):
    pdf_generado: bool

# -- Endpoints
@app.post("/register")
def register(username: str = Form(...), password: str = Form(...), rol: str = Form("usuario")):
    hashed_pw = pwd_context.hash(password)
    if db.add_usuario(username, hashed_pw, rol, activo=1):
        return {"ok": True}
    raise HTTPException(status_code=400, detail="Usuario ya existe")

@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token({
        "sub": str(user["id"]),
        "rol": user["rol"],
        "activo": user["activo"]
    })
    db.update_last_login(username)
    return {"access_token": token, "token_type": "bearer"}

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

@app.get("/productos")
def get_productos(user=Depends(get_current_user)):
    return db.get_productos()

@app.post("/productos")
def add_producto(producto: Producto, user=Depends(get_current_user)):
    return db.add_producto(producto.dict())

@app.get("/pedidos")
def get_pedidos(usuario: dict = Depends(get_current_user)):
    pedidos = db.get_pedidos()
    clientes = db.get_clientes()

    for pedido in pedidos:
        cliente = next((c for c in clientes if c["id"] == pedido["cliente_id"]), None)
        pedido["cliente_nombre"] = cliente["nombre"] if cliente else "Desconocido"

        if "pdf_generado" not in pedido:
            pedido["pdf_generado"] = False

        productos = []
        conn = db.conectar()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.nombre, dp.cantidad, dp.tipo
            FROM detalles_pedido dp
            JOIN productos p ON p.id = dp.producto_id
            WHERE dp.pedido_id = ?
        """, (pedido["id"],))
        for row in cursor.fetchall():
            productos.append({
                "nombre": row[0],
                "cantidad": row[1],
                "tipo": row[2]
            })
        conn.close()
        pedido["productos"] = productos

    return pedidos

@app.post("/pedidos")
def add_pedido(pedido: PedidoInput, user=Depends(get_current_user)):
    logger.debug("📦 Pedido recibido: %s", pedido.dict(exclude_unset=True))
    pedido_dict = pedido.dict(exclude_unset=True)
    if "pdf_generado" not in pedido_dict:
        pedido_dict["pdf_generado"] = False
    return db.add_pedido(pedido_dict)

@app.delete("/pedidos/{pedido_id}")
def delete_pedido(pedido_id: int, user=Depends(get_current_user)):
    return db.delete_pedido(pedido_id)

@app.put("/pedidos/{pedido_id}/estado")
def cambiar_estado_pedido(pedido_id: int, estado: EstadoPedido, user=Depends(get_current_user)):
    resultado = db.cambiar_estado_pedido(pedido_id, estado.pdf_generado)
    if resultado:
        return {"status": "ok", "mensaje": "Estado actualizado correctamente"}
    raise HTTPException(status_code=404, detail="Pedido no encontrado")

@app.get("/usuarios")
def listar_usuarios(usuario=Depends(obtener_usuario_actual_admin)):
    return db.get_usuarios()

@app.put("/usuarios/{username}/activar")
def activar_usuario_admin(username: str, user=Depends(obtener_usuario_actual_admin)):
    db.activar_usuario(username)
    return {"status": "ok", "message": f"Usuario {username} activado"}

@app.put("/usuarios/{username}/suspender")
def suspender_usuario_admin(username: str, user=Depends(obtener_usuario_actual_admin)):
    db.suspender_usuario(username)
    return {"status": "ok", "message": f"Usuario {username} suspendido"}

@app.delete("/usuarios/{username}")
def eliminar_usuario(username: str, user=Depends(obtener_usuario_actual_admin)):
    return db.eliminar_usuario(username)

@app.put("/usuarios/{username}/rol")
def actualizar_rol_usuario(username: str, rol: str = Form(...), user=Depends(obtener_usuario_actual_admin)):
    return db.actualizar_rol(username, rol)

@app.put("/usuarios/{username}/reset_password")
def reset_password(username: str, new_password: str = Form(...), user=Depends(obtener_usuario_actual_admin)):
    hashed_pw = pwd_context.hash(new_password)
    return db.resetear_password(username, hashed_pw)

@app.post("/usuarios")
def crear_usuario_admin(
    username: str = Form(...),
    password: str = Form(...),
    rol: str = Form("usuario"),
    activo: int = Form(0),
    user=Depends(obtener_usuario_actual_admin)
):
    hashed_pw = pwd_context.hash(password)
    if db.add_usuario(username, hashed_pw, rol, activo):
        return {"ok": True}
    raise HTTPException(status_code=400, detail="Usuario ya existe")

from fastapi.responses import FileResponse
from pdf_utils import generar_pdf_pedidos

class PedidosParaPDF(BaseModel):
    pedido_ids: List[int]

@app.post("/pedidos/pdf")
def generar_pdf_para_pedidos(
    datos: PedidosParaPDF,
    user=Depends(get_current_user)
):
    pedidos = db.get_pedidos_por_ids(datos.pedido_ids)

    if not pedidos:
        raise HTTPException(status_code=404, detail="No se encontraron los pedidos")

    # 🧠 Agregar cliente_nombre como en GET /pedidos
    clientes = db.get_clientes()
    for pedido in pedidos:
        cliente = next((c for c in clientes if c["id"] == pedido["cliente_id"]), None)
        pedido["cliente_nombre"] = cliente["nombre"] if cliente else "Desconocido"

        # 🧠 Agregar productos al pedido
        productos = []
        conn = db.conectar()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.nombre, dp.cantidad, dp.tipo
            FROM detalles_pedido dp
            JOIN productos p ON p.id = dp.producto_id
            WHERE dp.pedido_id = ?
        """, (pedido["id"],))
        for row in cursor.fetchall():
            productos.append({
                "nombre": row[0],
                "cantidad": row[1],
                "tipo": row[2]
            })
        conn.close()
        pedido["productos"] = productos

    archivo_pdf = generar_pdf_pedidos(pedidos)

    for pedido_id in datos.pedido_ids:
        db.cambiar_estado_pedido(pedido_id, False)

    return FileResponse(archivo_pdf, filename=archivo_pdf, media_type="application/pdf")
