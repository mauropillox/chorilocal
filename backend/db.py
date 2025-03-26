import sqlite3

def conectar():
    return sqlite3.connect("ventas.db")

def get_pedidos():
    con = conectar()
    cur = con.cursor()
    cur.execute("SELECT id, cliente, productos, fecha, pdf_generado FROM pedidos")
    pedidos = [
        {"id": r[0], "cliente": eval(r[1]), "productos": eval(r[2]), "fecha": r[3], "pdf_generado": bool(r[4])}
        for r in cur.fetchall()
    ]
    con.close()
    return pedidos

def add_pedido(pedido):
    con = conectar()
    cur = con.cursor()
    cur.execute("INSERT INTO pedidos (cliente, productos, fecha, pdf_generado) VALUES (?, ?, datetime('now'), ?)",
                (str(pedido["cliente"]), str(pedido["productos"]), False))
    con.commit()
    pid = cur.lastrowid
    con.close()
    return {"id": pid, **pedido}

def delete_pedido(pedido_id):
    con = conectar()
    cur = con.cursor()
    cur.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
    con.commit()
    con.close()
    return {"status": "deleted"}

def update_pedido_estado(pedido_id, estado):
    con = conectar()
    cur = con.cursor()
    cur.execute("UPDATE pedidos SET pdf_generado = ? WHERE id = ?", (int(estado), pedido_id))
    con.commit()
    con.close()
    return {"id": pedido_id, "pdf_generado": estado}
