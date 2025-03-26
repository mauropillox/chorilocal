from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db import (
    get_pedidos, add_pedido, delete_pedido, update_pedido_estado,
    get_clientes, add_cliente,
    get_productos, add_producto
)

app = FastAPI()

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================
# PEDIDOS
# ===========================
@app.get("/pedidos")
def listar_pedidos():
    return get_pedidos()

@app.post("/pedidos")
def crear_pedido(pedido: dict):
    return add_pedido(pedido)

@app.delete("/pedidos/{pedido_id}")
def eliminar_pedido(pedido_id: int):
    return delete_pedido(pedido_id)

@app.patch("/pedidos/{pedido_id}")
def marcar_como_generado(pedido_id: int):
    return update_pedido_estado(pedido_id, True)


# ===========================
# CLIENTES
# ===========================
@app.get("/clientes")
def listar_clientes():
    return get_clientes()

@app.post("/clientes")
def crear_cliente(cliente: dict):
    return add_cliente(cliente)


# ===========================
# PRODUCTOS
# ===========================
@app.get("/productos")
def listar_productos():
    return get_productos()

@app.post("/productos")
def crear_producto(producto: dict):
    return add_producto(producto)
