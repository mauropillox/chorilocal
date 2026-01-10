"""Reportes Router - API endpoints for advanced reports"""
from fastapi import APIRouter, Depends, Query, Request
from typing import Optional
from datetime import datetime, timedelta

import db
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ
)
from exceptions import safe_error_handler

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/ventas")
@limiter.limit(RATE_LIMIT_READ)
async def get_reporte_ventas(
    request: Request,
    desde: str = Query(default=None),
    hasta: str = Query(default=None),
    current_user: dict = Depends(get_admin_user)
):
    """Get sales report for date range"""
    try:
        if not desde:
            desde = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not hasta:
            hasta = datetime.now().strftime("%Y-%m-%d")
            
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            # Totales del período
            cur.execute("""
                SELECT 
                    COUNT(DISTINCT p.id) as total_pedidos,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total_ventas
                FROM pedidos p
                LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                WHERE DATE(p.fecha) BETWEEN ? AND ?
            """, (desde, hasta))
            row = cur.fetchone()
            totales = {
                "pedidos": row[0] or 0,
                "ventas": row[1] or 0
            }
            
            # Top 10 productos más vendidos
            cur.execute("""
                SELECT 
                    pr.id,
                    pr.nombre,
                    SUM(dp.cantidad) as cantidad_vendida,
                    SUM(dp.cantidad * dp.precio_unitario) as total_vendido
                FROM detalles_pedido dp
                JOIN productos pr ON pr.id = dp.producto_id
                JOIN pedidos p ON p.id = dp.pedido_id
                WHERE DATE(p.fecha) BETWEEN ? AND ?
                GROUP BY pr.id, pr.nombre
                ORDER BY cantidad_vendida DESC
                LIMIT 10
            """, (desde, hasta))
            top_productos = [{
                "id": row[0],
                "nombre": row[1],
                "cantidad_vendida": row[2],
                "total_vendido": row[3]
            } for row in cur.fetchall()]
            
            # Top 10 clientes
            cur.execute("""
                SELECT 
                    c.id,
                    c.nombre,
                    COUNT(DISTINCT p.id) as total_pedidos,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total_compras
                FROM clientes c
                JOIN pedidos p ON p.cliente_id = c.id
                LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                WHERE DATE(p.fecha) BETWEEN ? AND ?
                GROUP BY c.id, c.nombre
                ORDER BY total_compras DESC
                LIMIT 10
            """, (desde, hasta))
            top_clientes = [{
                "id": row[0],
                "nombre": row[1],
                "total_pedidos": row[2],
                "total_compras": row[3]
            } for row in cur.fetchall()]
            
            return {
                "desde": desde,
                "hasta": hasta,
                "totales": totales,
                "top_productos": top_productos,
                "top_clientes": top_clientes
            }
    except Exception as e:
        raise safe_error_handler(e, "reportes", "generar reporte de ventas")


@router.get("/inventario")
@limiter.limit(RATE_LIMIT_READ)
async def get_reporte_inventario(
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Get inventory report"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            # Resumen general
            cur.execute("""
                SELECT 
                    COUNT(*) as total_productos,
                    COALESCE(SUM(stock), 0) as stock_total,
                    COALESCE(SUM(stock * precio), 0) as valor_inventario,
                    COUNT(CASE WHEN stock < stock_minimo AND stock_minimo > 0 THEN 1 END) as productos_bajo_stock
                FROM productos
            """)
            row = cur.fetchone()
            resumen = {
                "total_productos": row[0],
                "stock_total": row[1],
                "valor_inventario": row[2],
                "productos_bajo_stock": row[3]
            }
            
            # Productos con stock bajo
            cur.execute("""
                SELECT 
                    id, nombre, stock, stock_minimo, 
                    COALESCE(stock_tipo, 'unidad') as stock_tipo,
                    precio,
                    (stock_minimo - stock) as faltante
                FROM productos
                WHERE stock < stock_minimo AND stock_minimo > 0
                ORDER BY faltante DESC
            """)
            bajo_stock = [{
                "id": row[0],
                "nombre": row[1],
                "stock": row[2],
                "stock_minimo": row[3],
                "stock_tipo": row[4],
                "precio": row[5],
                "faltante": row[6]
            } for row in cur.fetchall()]
            
            # Productos sin movimiento (30 días)
            hace_30_dias = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            cur.execute("""
                SELECT 
                    p.id, p.nombre, p.stock, p.precio,
                    MAX(DATE(pe.fecha)) as ultima_venta
                FROM productos p
                LEFT JOIN detalles_pedido dp ON dp.producto_id = p.id
                LEFT JOIN pedidos pe ON pe.id = dp.pedido_id AND DATE(pe.fecha) >= ?
                WHERE p.stock > 0
                GROUP BY p.id, p.nombre, p.stock, p.precio
                HAVING ultima_venta IS NULL OR ultima_venta < ?
                ORDER BY p.stock DESC
                LIMIT 20
            """, (hace_30_dias, hace_30_dias))
            sin_movimiento = [{
                "id": row[0],
                "nombre": row[1],
                "stock": row[2],
                "precio": row[3],
                "ultima_venta": row[4]
            } for row in cur.fetchall()]
            
            # Lista de todos los productos para exportación
            cur.execute("""
                SELECT id, nombre, stock, stock_minimo, precio
                FROM productos
                ORDER BY nombre
            """)
            productos = [{
                "id": row[0],
                "nombre": row[1],
                "stock": row[2],
                "stock_minimo": row[3],
                "precio": row[4]
            } for row in cur.fetchall()]
            
            return {
                "resumen": resumen,
                "bajo_stock": bajo_stock,
                "sin_movimiento": sin_movimiento,
                "productos": productos
            }
    except Exception as e:
        raise safe_error_handler(e, "reportes", "generar reporte de inventario")


@router.get("/clientes")
@limiter.limit(RATE_LIMIT_READ)
async def get_reporte_clientes(
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Get clients report"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            # Resumen
            cur.execute("SELECT COUNT(*) FROM clientes")
            total_clientes = cur.fetchone()[0]
            
            hace_30_dias = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            cur.execute("""
                SELECT COUNT(DISTINCT cliente_id) 
                FROM pedidos 
                WHERE DATE(fecha) >= ?
            """, (hace_30_dias,))
            clientes_activos = cur.fetchone()[0]
            
            # Todos los clientes con estadísticas
            cur.execute("""
                SELECT 
                    c.id, c.nombre, c.telefono, c.direccion,
                    COUNT(p.id) as total_pedidos,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total_gastado,
                    MAX(DATE(p.fecha)) as ultimo_pedido
                FROM clientes c
                LEFT JOIN pedidos p ON p.cliente_id = c.id
                LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                GROUP BY c.id, c.nombre, c.telefono, c.direccion
                ORDER BY total_gastado DESC
            """)
            clientes = [{
                "id": row[0],
                "nombre": row[1],
                "telefono": row[2],
                "direccion": row[3],
                "total_pedidos": row[4],
                "total_gastado": row[5],
                "ultimo_pedido": row[6]
            } for row in cur.fetchall()]
            
            # Top 10 clientes frecuentes
            top_frecuentes = sorted(clientes, key=lambda x: x["total_pedidos"], reverse=True)[:10]
            
            # Clientes inactivos (sin pedidos en 60 días)
            hace_60_dias = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
            inactivos = [c for c in clientes if c["ultimo_pedido"] and c["ultimo_pedido"] < hace_60_dias]
            
            return {
                "resumen": {
                    "total_clientes": total_clientes,
                    "clientes_activos": clientes_activos,
                    "clientes_inactivos": len(inactivos)
                },
                "clientes": clientes,
                "top_frecuentes": top_frecuentes,
                "inactivos": inactivos[:20]
            }
    except Exception as e:
        raise safe_error_handler(e, "reportes", "generar reporte de clientes")


@router.get("/productos")
@limiter.limit(RATE_LIMIT_READ)
async def get_reporte_productos(
    request: Request,
    desde: str = Query(default=None),
    hasta: str = Query(default=None),
    current_user: dict = Depends(get_admin_user)
):
    """Get products performance report"""
    try:
        if not desde:
            desde = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not hasta:
            hasta = datetime.now().strftime("%Y-%m-%d")
            
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            # Productos más vendidos con detalles
            cur.execute("""
                SELECT 
                    pr.id, pr.nombre, pr.precio, pr.stock,
                    COALESCE(c.nombre, 'Sin Categoría') as categoria,
                    COALESCE(SUM(dp.cantidad), 0) as cantidad_vendida,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total_vendido,
                    COUNT(DISTINCT p.id) as num_pedidos
                FROM productos pr
                LEFT JOIN categorias c ON c.id = pr.categoria_id
                LEFT JOIN detalles_pedido dp ON dp.producto_id = pr.id
                LEFT JOIN pedidos p ON p.id = dp.pedido_id AND DATE(p.fecha) BETWEEN ? AND ?
                GROUP BY pr.id, pr.nombre, pr.precio, pr.stock, c.nombre
                ORDER BY cantidad_vendida DESC
            """, (desde, hasta))
            
            productos = [{
                "id": row[0],
                "nombre": row[1],
                "precio": row[2],
                "stock": row[3],
                "categoria": row[4],
                "cantidad_vendida": row[5],
                "total_vendido": row[6],
                "num_pedidos": row[7]
            } for row in cur.fetchall()]
            
            # Ranking (top 10)
            ranking = [p for p in productos if p["cantidad_vendida"] > 0][:10]
            
            # Menos vendidos (con stock pero sin ventas)
            menos_vendidos = [p for p in productos if p["cantidad_vendida"] == 0 and p["stock"] > 0][:10]
            
            # Por categoría
            cur.execute("""
                SELECT 
                    COALESCE(c.nombre, 'Sin Categoría') as categoria,
                    COUNT(DISTINCT pr.id) as num_productos,
                    COALESCE(SUM(dp.cantidad), 0) as cantidad_vendida,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total_vendido
                FROM productos pr
                LEFT JOIN categorias c ON c.id = pr.categoria_id
                LEFT JOIN detalles_pedido dp ON dp.producto_id = pr.id
                LEFT JOIN pedidos p ON p.id = dp.pedido_id AND DATE(p.fecha) BETWEEN ? AND ?
                GROUP BY c.id, c.nombre
                ORDER BY total_vendido DESC
            """, (desde, hasta))
            
            por_categoria = [{
                "categoria": row[0],
                "num_productos": row[1],
                "cantidad_vendida": row[2],
                "total_vendido": row[3]
            } for row in cur.fetchall()]
            
            return {
                "desde": desde,
                "hasta": hasta,
                "productos": productos,
                "ranking": ranking,
                "menos_vendidos": menos_vendidos,
                "por_categoria": por_categoria
            }
    except Exception as e:
        raise safe_error_handler(e, "reportes", "generar reporte de productos")


@router.get("/rendimiento")
@limiter.limit(RATE_LIMIT_READ)
async def get_reporte_rendimiento(
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Get performance/efficiency report"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            hoy = datetime.now().strftime("%Y-%m-%d")
            hace_7_dias = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            hace_30_dias = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
            # Pedidos por estado
            cur.execute("""
                SELECT estado, COUNT(*) as cantidad
                FROM pedidos
                WHERE DATE(fecha) >= ?
                GROUP BY estado
            """, (hace_30_dias,))
            por_estado = {row[0]: row[1] for row in cur.fetchall()}
            
            # Pedidos por día de la semana
            cur.execute("""
                SELECT 
                    CASE CAST(strftime('%w', fecha) AS INTEGER)
                        WHEN 0 THEN 'Domingo'
                        WHEN 1 THEN 'Lunes'
                        WHEN 2 THEN 'Martes'
                        WHEN 3 THEN 'Miércoles'
                        WHEN 4 THEN 'Jueves'
                        WHEN 5 THEN 'Viernes'
                        WHEN 6 THEN 'Sábado'
                    END as dia,
                    COUNT(*) as cantidad
                FROM pedidos
                WHERE DATE(fecha) >= ?
                GROUP BY strftime('%w', fecha)
                ORDER BY CAST(strftime('%w', fecha) AS INTEGER)
            """, (hace_30_dias,))
            por_dia_semana = [{
                "dia": row[0],
                "cantidad": row[1]
            } for row in cur.fetchall()]
            
            # Pedidos por hora (últimos 7 días)
            cur.execute("""
                SELECT 
                    CAST(strftime('%H', fecha) AS INTEGER) as hora,
                    COUNT(*) as cantidad
                FROM pedidos
                WHERE DATE(fecha) >= ?
                GROUP BY strftime('%H', fecha)
                ORDER BY hora
            """, (hace_7_dias,))
            por_hora = [{
                "hora": f"{row[0]:02d}:00",
                "cantidad": row[1]
            } for row in cur.fetchall()]
            
            # Promedio de items por pedido
            cur.execute("""
                SELECT AVG(items) FROM (
                    SELECT p.id, COUNT(dp.id) as items
                    FROM pedidos p
                    LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                    WHERE DATE(p.fecha) >= ?
                    GROUP BY p.id
                )
            """, (hace_30_dias,))
            avg_items = cur.fetchone()[0] or 0
            
            # Ticket promedio
            cur.execute("""
                SELECT AVG(total) FROM (
                    SELECT p.id, COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total
                    FROM pedidos p
                    LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                    WHERE DATE(p.fecha) >= ?
                    GROUP BY p.id
                )
            """, (hace_30_dias,))
            ticket_promedio = cur.fetchone()[0] or 0
            
            # Rendimiento por vendedor
            cur.execute("""
                SELECT 
                    creado_por,
                    COUNT(*) as pedidos,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as total_vendido
                FROM pedidos p
                LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                WHERE DATE(p.fecha) >= ?
                GROUP BY creado_por
                ORDER BY total_vendido DESC
            """, (hace_30_dias,))
            por_vendedor = [{
                "vendedor": row[0] or "Desconocido",
                "pedidos": row[1],
                "total_vendido": row[2]
            } for row in cur.fetchall()]
            
            return {
                "resumen": {
                    "promedio_items_pedido": round(avg_items, 1),
                    "ticket_promedio": round(ticket_promedio, 2)
                },
                "por_estado": por_estado,
                "por_dia_semana": por_dia_semana,
                "por_hora": por_hora,
                "por_vendedor": por_vendedor
            }
    except Exception as e:
        raise safe_error_handler(e, "reportes", "generar reporte de rendimiento")


@router.get("/comparativo")
@limiter.limit(RATE_LIMIT_READ)
async def get_reporte_comparativo(
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Get comparative report (this period vs last period)"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            hoy = datetime.now()
            # Período actual: últimos 30 días
            fin_actual = hoy.strftime("%Y-%m-%d")
            inicio_actual = (hoy - timedelta(days=30)).strftime("%Y-%m-%d")
            # Período anterior: 30 días antes del actual
            fin_anterior = (hoy - timedelta(days=31)).strftime("%Y-%m-%d")
            inicio_anterior = (hoy - timedelta(days=60)).strftime("%Y-%m-%d")
            
            def get_periodo_stats(inicio, fin):
                cur.execute("""
                    SELECT 
                        COUNT(DISTINCT p.id) as pedidos,
                        COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as ventas,
                        COUNT(DISTINCT p.cliente_id) as clientes
                    FROM pedidos p
                    LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                    WHERE DATE(p.fecha) BETWEEN ? AND ?
                """, (inicio, fin))
                row = cur.fetchone()
                return {
                    "pedidos": row[0] or 0,
                    "ventas": row[1] or 0,
                    "clientes": row[2] or 0
                }
            
            actual = get_periodo_stats(inicio_actual, fin_actual)
            anterior = get_periodo_stats(inicio_anterior, fin_anterior)
            
            def calc_variacion(actual, anterior):
                if anterior == 0:
                    return 100 if actual > 0 else 0
                return round(((actual - anterior) / anterior) * 100, 1)
            
            variaciones = {
                "pedidos": calc_variacion(actual["pedidos"], anterior["pedidos"]),
                "ventas": calc_variacion(actual["ventas"], anterior["ventas"]),
                "clientes": calc_variacion(actual["clientes"], anterior["clientes"])
            }
            
            # Ventas diarias para gráfico
            cur.execute("""
                SELECT 
                    DATE(p.fecha) as dia,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as ventas
                FROM pedidos p
                LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                WHERE DATE(p.fecha) BETWEEN ? AND ?
                GROUP BY DATE(p.fecha)
                ORDER BY dia
            """, (inicio_actual, fin_actual))
            ventas_diarias = [{
                "fecha": row[0],
                "ventas": row[1]
            } for row in cur.fetchall()]
            
            return {
                "periodo_actual": {
                    "desde": inicio_actual,
                    "hasta": fin_actual,
                    **actual
                },
                "periodo_anterior": {
                    "desde": inicio_anterior,
                    "hasta": fin_anterior,
                    **anterior
                },
                "variaciones": variaciones,
                "ventas_diarias": ventas_diarias
            }
    except Exception as e:
        raise safe_error_handler(e, "reportes", "generar reporte comparativo")
