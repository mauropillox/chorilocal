# main.py
from fastapi import FastAPI, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, field_validator
from typing import List, Optional
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import logging
import os
import shutil
import db
from auth import authenticate_user, create_access_token, decode_token, get_usuario_por_id, pwd_context
from pdf_utils import generar_pdf_pedidos

load_dotenv()

# Logging config
DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() == "true"
logging.basicConfig(
    level=logging.DEBUG if DEBUG_MODE else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Ensure DB is present in /data
origen = "/app/ventas.db"
destino = os.getenv("DB_PATH", "/data/ventas.db")
if not os.path.exists(destino):
    logger.warning("📁 Copiando ventas.db inicial a disco persistente...")
    shutil.copy(origen, destino)
logger.info(f"📂 Usando base de datos: {destino}")

# App setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init DB
db.crear_tablas()
db.crear_tabla_detalles_pedido()
db.verificar_tablas_y_columnas()

# Dependencias
def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    user_id = payload.get("sub")
    user = get_usuario_por_id(user_id)
    if not user or not user["activo"]:
        raise HTTPException(status_code=403, detail="Usuario inactivo o no encontrado")
    return user

def obtener_usuario_actual_admin(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if payload is None or payload.get("rol") != "admin":
        raise HTTPException(status_code=403, detail="No autorizado: se requiere rol admin")
    return payload

# Modelos
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

class PedidoProductoInput(ProductoConCantidad):
    pass

class PedidoInput(BaseModel):
    cliente_id: int
    observaciones: Optional[str] = None
    productos: List[PedidoProductoInput]
    fecha: Optional[str] = None
    pdf_generado: Optional[bool] = False

class EstadoPedido(BaseModel):
    pdf_generado: bool

class PedidosParaPDF(BaseModel):
    pedido_ids: List[int]

# Endpoints
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
    productos = db.get_productos()
    return sorted(productos, key=lambda x: x['nombre'].lower())

@app.post("/productos")
def add_producto(producto: Producto, user=Depends(get_current_user)):
    return db.add_producto(producto.dict())

@app.put("/productos/{producto_id}")
def update_producto(producto_id: int, producto: Producto, user=Depends(get_current_user)):
    producto_data = producto.dict()
    producto_data["id"] = producto_id
    return db.add_producto(producto_data)

@app.delete("/productos/{producto_id}")
def delete_producto(producto_id: int, user=Depends(get_current_user)):
    return db.delete_producto(producto_id)

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
        productos = [{"nombre": row[0], "cantidad": row[1], "tipo": row[2]} for row in cursor.fetchall()]
        conn.close()
        pedido["productos"] = productos

    return pedidos

@app.post("/pedidos")
def add_pedido(pedido: PedidoInput, user=Depends(get_current_user)):
    pedido_dict = pedido.dict(exclude_unset=True)
    if "pdf_generado" not in pedido_dict:
        pedido_dict["pdf_generado"] = False
    return db.add_pedido(pedido_dict)

@app.delete("/pedidos/{pedido_id}")
def delete_pedido(pedido_id: int, user=Depends(get_current_user)):
    return db.delete_pedido(pedido_id)

@app.put("/pedidos/{pedido_id}/estado")
def cambiar_estado_pedido(pedido_id: int, estado: EstadoPedido, user=Depends(get_current_user)):
    if db.cambiar_estado_pedido(pedido_id, estado.pdf_generado):
        return {"status": "ok", "mensaje": "Estado actualizado correctamente"}
    raise HTTPException(status_code=404, detail="Pedido no encontrado")

@app.get("/pedidos/pendientes")
def get_pedidos_pendientes(user=Depends(get_current_user)):
    return db.get_pedidos_filtrados(
        "(pdf_generado IS NULL OR pdf_generado = 0) AND (pdf_descargado IS NULL OR pdf_descargado = 0)"
    )

@app.get("/pedidos/generados")
def get_pedidos_generados(user=Depends(get_current_user)):
    return db.get_pedidos_filtrados(
        "pdf_generado = 1 AND (pdf_descargado IS NULL OR pdf_descargado = 0)"
    )

@app.post("/pedidos/pdf")
def generar_pdf_para_pedidos(datos: PedidosParaPDF, user=Depends(get_current_user)):
    pedidos = db.get_pedidos_por_ids(datos.pedido_ids)
    if not pedidos:
        raise HTTPException(status_code=404, detail="No se encontraron los pedidos")

    clientes = db.get_clientes()
    for pedido in pedidos:
        cliente = next((c for c in clientes if c["id"] == pedido["cliente_id"]), None)
        pedido["cliente_nombre"] = cliente["nombre"] if cliente else "Desconocido"

        conn = db.conectar()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.nombre, dp.cantidad, dp.tipo
            FROM detalles_pedido dp
            JOIN productos p ON p.id = dp.producto_id
            WHERE dp.pedido_id = ?
        """, (pedido["id"],))
        pedido["productos"] = [{"nombre": row[0], "cantidad": row[1], "tipo": row[2]} for row in cursor.fetchall()]
        conn.close()

    archivo_pdf = generar_pdf_pedidos(pedidos)

    for pedido_id in datos.pedido_ids:
        db.marcar_pedido_como_descargado(pedido_id)

    return FileResponse(archivo_pdf, filename=archivo_pdf, media_type="application/pdf")

@app.get("/usuarios")
def listar_usuarios(usuario=Depends(obtener_usuario_actual_admin)):
    return db.get_usuarios()

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
