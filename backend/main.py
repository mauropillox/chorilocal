import sqlite3
from datetime import datetime

DB_PATH = "ventas.db"

def conectar():
    return sqlite3.connect(DB_PATH)

# ============ CLIENTES ============

def get_clientes():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, telefono, direccion FROM clientes")
    clientes = [{"id": r[0], "nombre": r[1], "telefono": r[2], "direccion": r[3]} for r in cursor.fetchall()]
    conn.close()
    return clientes

def add_cliente(cliente):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", 
                   (cliente["nombre"], cliente.get("telefono", ""), cliente.get("direccion", "")))
    conn.commit()
    cliente_id = cursor.lastrowid
    conn.close()
    cliente["id"] = cliente_id
    return cliente

# ============ PRODUCTOS ============

def get_productos():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, precio FROM productos")
    productos = [{"id": r[0], "nombre": r[1], "precio": r[2]} for r in cursor.fetchall()]
    conn.close()
    return productos

def add_producto(producto):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO productos (nombre, precio) VALUES (?, ?)", 
                   (producto["nombre"], producto["precio"]))
    conn.commit()
    producto_id = cursor.lastrowid
    conn.close()
    producto["id"] = producto_id
    return producto

# ============ PEDIDOS ============

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

def add_pedido(pedido):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO pedidos (id_cliente, fecha, pdf_generado) VALUES (?, ?, ?)", 
                   (pedido["cliente"]["id"], datetime.now().isoformat(), False))
    pedido_id = cursor.lastrowid

    for producto in pedido["productos"]:
        cursor.execute("INSERT INTO detalles_pedido (id_pedido, id_producto, cantidad) VALUES (?, ?, ?)", 
                       (pedido_id, producto["id"], producto["cantidad"]))

    conn.commit()
    conn.close()
    return {"id": pedido_id, **pedido}

def delete_pedido(pedido_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM detalles_pedido WHERE id_pedido = ?", (pedido_id,))
    cursor.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

def update_pedido_estado(pedido_id, estado):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE pedidos SET pdf_generado = ? WHERE id = ?", (int(estado), pedido_id))
    conn.commit()
    conn.close()
    return {"ok": True}
