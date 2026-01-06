"""
Dashboard API endpoints - Semana 1
Provides metrics and statistics for the main dashboard
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any
import sqlite3
from db import conectar


def get_dashboard_metrics() -> Dict[str, Any]:
    """Get main KPI metrics for dashboard"""
    con = conectar()
    cur = con.cursor()
    
    try:
        # Total clientes
        cur.execute("SELECT COUNT(*) FROM clientes")
        total_clientes = cur.fetchone()[0]
        
        # Total productos
        cur.execute("SELECT COUNT(*) FROM productos")
        total_productos = cur.fetchone()[0]
        
        # Pedidos hoy
        hoy = datetime.now().strftime("%Y-%m-%d")
        cur.execute("SELECT COUNT(*) FROM pedidos WHERE DATE(fecha) = ?", (hoy,))
        pedidos_hoy = cur.fetchone()[0]
        
        # Stock bajo (productos con stock < stock_minimo)
        cur.execute("""
            SELECT COUNT(*) 
            FROM productos 
            WHERE stock < stock_minimo AND stock_minimo > 0
        """)
        stock_bajo = cur.fetchone()[0]
        
        # Pedidos últimos 30 días
        hace_30_dias = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        cur.execute("""
            SELECT COUNT(*) 
            FROM pedidos 
            WHERE DATE(fecha) >= ?
        """, (hace_30_dias,))
        pedidos_mes = cur.fetchone()[0]
        
        # Productos más vendidos (últimos 30 días)
        cur.execute("""
            SELECT 
                p.id,
                p.nombre,
                SUM(dp.cantidad) as total_vendido
            FROM detalles_pedido dp
            JOIN productos p ON dp.producto_id = p.id
            JOIN pedidos pd ON dp.pedido_id = pd.id
            WHERE DATE(pd.fecha) >= ?
            GROUP BY p.id, p.nombre
            ORDER BY total_vendido DESC
            LIMIT 5
        """, (hace_30_dias,))
        top_productos = [{"id": row[0], "nombre": row[1], "cantidad": row[2]} for row in cur.fetchall()]
        
        return {
            "total_clientes": total_clientes,
            "total_productos": total_productos,
            "pedidos_hoy": pedidos_hoy,
            "stock_bajo_count": stock_bajo,
            "pedidos_mes": pedidos_mes,
            "top_productos": top_productos
        }
    finally:
        con.close()


def get_pedidos_por_dia(dias: int = 30) -> List[Dict[str, Any]]:
    """Get orders per day for the last N days"""
    con = conectar()
    cur = con.cursor()
    
    try:
        fecha_inicio = (datetime.now() - timedelta(days=dias)).strftime("%Y-%m-%d")
        cur.execute("""
            SELECT 
                DATE(fecha) as dia,
                COUNT(*) as cantidad
            FROM pedidos
            WHERE DATE(fecha) >= ?
            GROUP BY DATE(fecha)
            ORDER BY dia ASC
        """, (fecha_inicio,))
        
        return [{"fecha": row[0], "cantidad": row[1]} for row in cur.fetchall()]
    finally:
        con.close()


def get_alertas() -> List[Dict[str, Any]]:
    """Get system alerts (stock bajo, etc)"""
    con = conectar()
    cur = con.cursor()
    
    try:
        alertas = []
        
        # Productos con stock bajo
        cur.execute("""
            SELECT nombre, stock, stock_minimo
            FROM productos
            WHERE stock < stock_minimo AND stock_minimo > 0
            ORDER BY (stock / NULLIF(stock_minimo, 1)) ASC
            LIMIT 10
        """)
        
        for row in cur.fetchall():
            alertas.append({
                "tipo": "stock_bajo",
                "producto": row[0],
                "stock_actual": row[1],
                "stock_minimo": row[2],
                "mensaje": f"⚠️ {row[0]}: stock {row[1]} (mínimo: {row[2]})"
            })
        
        return alertas
    finally:
        con.close()


def get_productos_sin_stock() -> int:
    """Count products with stock = 0"""
    con = conectar()
    cur = con.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM productos WHERE stock <= 0")
        return cur.fetchone()[0]
    finally:
        con.close()
