from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import sqlite3

DB_PATH = "ventas.db"
app = FastAPI()

# Middleware para CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

def conectar():
    return sqlite3.connect(DB_PATH)

# ======== MODELOS ========
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
    cantidad: int

class Pedido(BaseModel):
    id: Optional[int] = None
    cliente: Cliente
    productos: List[ProductoConCantidad]
    fecha: Optional[str] = None
    pdf_generado: bool = False

# ============ ENDPOINTS CLIENTES ============
@app.get("/clientes")
def get_clientes():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, telefono, direccion FROM clientes")
    clientes = [{"id": r[0], "nombre": r[1], "telefono": r[2], "direccion": r[3]} for r in cursor.fetchall()]
    conn.close()
    return clientes

@app.post("/clientes")
def add_cliente(cliente: Cliente):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", 
                   (cliente.nombre, cliente.telefono, cliente.direccion))
    conn.commit()
    cliente.id = cursor.lastrowid
    conn.close()
    return cliente

# ============ ENDPOINTS PRODUCTOS ============
@app.get("/productos")
def get_productos():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, precio FROM productos")
    productos = [{"id": r[0], "nombre": r[1], "precio": r[2]} for r in cursor.fetchall()]
    conn.close()
    return productos

@app.post("/productos")
def add_producto(producto: Producto):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO productos (nombre, precio) VALUES (?, ?)", 
                   (producto.nombre, producto.precio))
    conn.commit()
    producto.id = cursor.lastrowid
    conn.close()
    return producto

# ============ ENDPOINTS PEDIDOS ============
@app.get("/pedidos")
def get_pedidos():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, p.fecha, p.pdf_generado, c.id, c.nombre, c.telefono, c.direccion
        FROM pedidos p
        JOIN clientes c ON p.id_cliente = c.id
    """)
    pedidos = []
    for row in cursor.fetchall():
        pedido_id, fecha, pdf_generado, cid, nombre, telefono, direccion = row
        cursor.execute("""
            SELECT pr.id, pr.nombre, pr.precio, dp.cantidad
            FROM detalles_pedido dp
            JOIN productos pr ON dp.id_producto = pr.id
            WHERE dp.id_pedido = ?
        """, (pedido_id,))
        productos = [{"id": r[0], "nombre": r[1], "precio": r[2], "cantidad": r[3]} for r in cursor.fetchall()]
        pedidos.append({
            "id": pedido_id,
            "fecha": fecha,
            "pdf_generado": bool(pdf_generado),
            "cliente": {"id": cid, "nombre": nombre, "telefono": telefono, "direccion": direccion},
            "productos": productos
        })
    conn.close()
    return pedidos

@app.post("/pedidos")
def add_pedido(pedido: Pedido):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO pedidos (id_cliente, fecha, pdf_generado) VALUES (?, ?, ?)", 
                   (pedido.cliente.id, datetime.now().isoformat(), False))
    pedido_id = cursor.lastrowid

    for producto in pedido.productos:
        cursor.execute("INSERT INTO detalles_pedido (id_pedido, id_producto, cantidad) VALUES (?, ?, ?)", 
                       (pedido_id, producto.id, producto.cantidad))

    conn.commit()
    conn.close()
    pedido.id = pedido_id
    return pedido

@app.delete("/pedidos/{pedido_id}")
def delete_pedido(pedido_id: int):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM detalles_pedido WHERE id_pedido = ?", (pedido_id,))
    cursor.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.patch("/pedidos/{pedido_id}")
def update_pedido_estado(pedido_id: int):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE pedidos SET pdf_generado = 1 WHERE id = ?", (pedido_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
