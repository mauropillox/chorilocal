from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from typing import List
import json
from datetime import datetime
# from pdf_utils import generar_pdf_pedido  # If PDF generation is needed, keep this line uncommented

app = FastAPI()

# CORS to allow requests from React (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # o mejor: ["http://tudominio.com"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- MODELS ----------

class ClienteIn(BaseModel):
    nombre: str
    telefono: str = ""
    direccion: str  # New field for the client's address

class ClienteOut(ClienteIn):
    id: int
    direccion: str = None  # Make direccion optional


class ProductoIn(BaseModel):
    nombre: str
    precio: float

class ProductoOut(ProductoIn):
    id: int

# Update the PedidoOut model to include the quantity of each product
class ProductoPedido(BaseModel):
    id: int
    nombre: str
    precio: float
    cantidad: int  # Add quantity

class PedidoIn(BaseModel):
    cliente: ClienteIn
    productos: List[ProductoPedido]  # Now each product has a quantity

class PedidoOut(PedidoIn):
    id: int
    fecha: str


# ---------- DATABASE ----------

DB_FILE = "ventas.db"  # Make sure this path is correct, if not adjust

def obtener_conexion():
    conn = sqlite3.connect(DB_FILE)
    return conn

def inicializar_bd():
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS clientes(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        telefono TEXT,
        direccion TEXT
    )''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS articulos(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        precio REAL NOT NULL
    )''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS pedidos(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_cliente INTEGER,
        fecha TEXT,
        detalles TEXT,
        FOREIGN KEY(id_cliente) REFERENCES clientes(id)
    )''')
    conn.commit()
    conn.close()

inicializar_bd()

# ---------- ENDPOINTS ----------

@app.get("/")
def read_root():
    return {"message": "Welcome to the backend!"}

@app.get("/test")
def read_test():
    return {"message": "Test route works!"}

@app.get("/clientes", response_model=List[ClienteOut])
def listar_clientes():
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, telefono, direccion FROM clientes")
    clientes = [ClienteOut(id=row[0], nombre=row[1], telefono=row[2], direccion=row[3]) for row in cursor.fetchall()]
    conn.close()
    return clientes

@app.post("/clientes", response_model=ClienteOut)
def crear_cliente(cliente: ClienteIn):
    conn = obtener_conexion()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM clientes WHERE nombre = ? AND telefono = ?", (cliente.nombre, cliente.telefono))
    existing_cliente = cursor.fetchone()
    
    if existing_cliente:
        raise HTTPException(status_code=400, detail="El cliente ya existe.")
    
    cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", (cliente.nombre, cliente.telefono, cliente.direccion))
    cliente_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return ClienteOut(id=cliente_id, nombre=cliente.nombre, telefono=cliente.telefono, direccion=cliente.direccion)

@app.get("/productos", response_model=List[ProductoOut])
def listar_productos():
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, precio FROM articulos")
    productos = [ProductoOut(id=row[0], nombre=row[1], precio=row[2]) for row in cursor.fetchall()]
    conn.close()
    return productos

@app.post("/productos", response_model=ProductoOut)
def crear_producto(producto: ProductoIn):
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO articulos (nombre, precio) VALUES (?, ?)", (producto.nombre, producto.precio))
    producto_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return ProductoOut(id=producto_id, nombre=producto.nombre, precio=producto.precio)

@app.get("/pedidos", response_model=List[PedidoOut])
def listar_pedidos():
    try:
        conn = obtener_conexion()
        cursor = conn.cursor()
        cursor.execute('''SELECT p.id, p.fecha, c.id, c.nombre, c.telefono, p.detalles
                          FROM pedidos p
                          JOIN clientes c ON p.id_cliente = c.id''')
        pedidos = []
        for row in cursor.fetchall():
            cliente = ClienteOut(
                id=row[2], 
                nombre=row[3], 
                telefono=row[4], 
                direccion=row[5] if row[5] else "No disponible"  # Provide default if direccion is None
            )
            detalles = json.loads(row[5])
            productos = [
                ProductoPedido(id=p['id'], nombre=p['nombre'], precio=p['precio'], cantidad=p.get('cantidad', 1))
                for p in detalles
            ]
            fecha, hora = row[1].split(' ')  # Separating date and time
            pedidos.append(PedidoOut(id=row[0], cliente=cliente, productos=productos, fecha=fecha))
        conn.close()
        return pedidos
    except Exception as e:
        print(f"Error: {str(e)}")  # Log the error for debugging
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/pedidos")
def crear_pedido(pedido: PedidoIn):
    # Validate that all products have a valid quantity
    for producto in pedido.productos:
        if producto.cantidad < 1:
            raise HTTPException(status_code=400, detail="La cantidad de cada producto debe ser al menos 1.")
    
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Insert a new customer if it doesn't exist
    cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", 
                   (pedido.cliente.nombre, pedido.cliente.telefono, pedido.cliente.direccion))
    cliente_id = cursor.lastrowid

    from datetime import datetime
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    detalles = json.dumps([{"id": p.id, "nombre": p.nombre, "precio": p.precio, "cantidad": p.cantidad} for p in pedido.productos])
    
    cursor.execute("INSERT INTO pedidos (id_cliente, fecha, detalles) VALUES (?, ?, ?)", 
                   (cliente_id, fecha, detalles))
    conn.commit()
    conn.close()

    return {"mensaje": "Pedido guardado"}
