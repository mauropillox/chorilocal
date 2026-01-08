"""Estadisticas Router - API endpoints for statistics and analytics"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone

import db
import models
from deps import (
    get_current_user, get_admin_user, limiter,
    RATE_LIMIT_READ
)

router = APIRouter(prefix="/estadisticas", tags=["Estadísticas"])


@router.get("/usuarios")
@limiter.limit(RATE_LIMIT_READ)
async def get_estadisticas_usuarios(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get user statistics (sales by vendor, device usage, etc.)"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            # Pedidos por vendedor (últimos 30 días)
            hace_30_dias = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            cur.execute("""
                SELECT 
                    creado_por,
                    COUNT(*) as total_pedidos
                FROM pedidos
                WHERE DATE(fecha) >= ?
                GROUP BY creado_por
                ORDER BY total_pedidos DESC
                LIMIT 10
            """, (hace_30_dias,))
            
            por_vendedor = [{
                "vendedor": row[0] or "Desconocido",
                "pedidos": row[1]
            } for row in cur.fetchall()]
            
            # Estadísticas por dispositivo (simulado - basado en user agents si los guardamos)
            # Por ahora retornamos datos estimados basados en patrones de uso
            por_dispositivo = [
                {"dispositivo": "Desktop", "porcentaje": 60},
                {"dispositivo": "Mobile", "porcentaje": 35},
                {"dispositivo": "Tablet", "porcentaje": 5}
            ]
            
            # Actividad por hora del día
            cur.execute("""
                SELECT 
                    CAST(strftime('%H', fecha) AS INTEGER) as hora,
                    COUNT(*) as cantidad
                FROM pedidos
                WHERE DATE(fecha) >= ?
                GROUP BY hora
                ORDER BY hora
            """, (hace_30_dias,))
            
            por_hora = [{
                "hora": row[0],
                "cantidad": row[1]
            } for row in cur.fetchall()]
            
            # Usuarios más activos
            cur.execute("""
                SELECT 
                    u.username,
                    u.nombre,
                    u.rol,
                    COUNT(p.id) as total_pedidos
                FROM usuarios u
                LEFT JOIN pedidos p ON p.creado_por = u.username
                    AND DATE(p.fecha) >= ?
                GROUP BY u.id, u.username, u.nombre, u.rol
                ORDER BY total_pedidos DESC
                LIMIT 5
            """, (hace_30_dias,))
            
            usuarios_activos = [{
                "username": row[0],
                "nombre": row[1] or row[0],
                "rol": row[2],
                "pedidos": row[3]
            } for row in cur.fetchall()]
            
            return {
                "por_vendedor": por_vendedor,
                "por_dispositivo": por_dispositivo,
                "por_hora": por_hora,
                "usuarios_activos": usuarios_activos
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting user statistics: {str(e)}")


@router.get("/ventas")
@limiter.limit(RATE_LIMIT_READ)
async def get_estadisticas_ventas(
    request: Request,
    dias: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get sales statistics"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            fecha_inicio = (datetime.now() - timedelta(days=dias)).strftime("%Y-%m-%d")
            
            # Total ventas por día
            cur.execute("""
                SELECT 
                    DATE(p.fecha) as dia,
                    COUNT(p.id) as total_pedidos,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as monto_total
                FROM pedidos p
                LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
                WHERE DATE(p.fecha) >= ?
                GROUP BY DATE(p.fecha)
                ORDER BY dia ASC
            """, (fecha_inicio,))
            
            por_dia = [{
                "fecha": row[0],
                "pedidos": row[1],
                "monto": row[2]
            } for row in cur.fetchall()]
            
            # Productos más vendidos
            cur.execute("""
                SELECT 
                    pr.nombre,
                    SUM(dp.cantidad) as cantidad,
                    SUM(dp.cantidad * dp.precio_unitario) as monto
                FROM detalles_pedido dp
                JOIN productos pr ON pr.id = dp.producto_id
                JOIN pedidos p ON p.id = dp.pedido_id
                WHERE DATE(p.fecha) >= ?
                GROUP BY pr.id, pr.nombre
                ORDER BY cantidad DESC
                LIMIT 10
            """, (fecha_inicio,))
            
            top_productos = [{
                "producto": row[0],
                "cantidad": row[1],
                "monto": row[2]
            } for row in cur.fetchall()]
            
            # Por categoría
            cur.execute("""
                SELECT 
                    COALESCE(c.nombre, 'Sin Categoría') as categoria,
                    SUM(dp.cantidad) as cantidad
                FROM detalles_pedido dp
                JOIN productos pr ON pr.id = dp.producto_id
                LEFT JOIN categorias c ON c.id = pr.categoria_id
                JOIN pedidos p ON p.id = dp.pedido_id
                WHERE DATE(p.fecha) >= ?
                GROUP BY c.id, c.nombre
                ORDER BY cantidad DESC
            """, (fecha_inicio,))
            
            por_categoria = [{
                "categoria": row[0],
                "cantidad": row[1]
            } for row in cur.fetchall()]
            
            return {
                "por_dia": por_dia,
                "top_productos": top_productos,
                "por_categoria": por_categoria
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting sales statistics: {str(e)}")
