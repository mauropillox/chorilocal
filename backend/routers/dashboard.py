"""Dashboard Router - API endpoints for dashboard metrics and statistics"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone

import db
import models
from deps import (
    get_current_user, limiter,
    RATE_LIMIT_READ
)
from exceptions import safe_error_handler

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics")
@limiter.limit(RATE_LIMIT_READ)
async def get_dashboard_metrics(request: Request, current_user: dict = Depends(get_current_user)):
    """Get main KPI metrics for dashboard"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            # Total clientes
            cur.execute("SELECT COUNT(*) FROM clientes")
            total_clientes = cur.fetchone()[0]
            
            # Total productos
            cur.execute("SELECT COUNT(*) FROM productos")
            total_productos = cur.fetchone()[0]
            
            # Pedidos hoy (only from 2026-02-01 onwards)
            hoy = datetime.now().strftime("%Y-%m-%d")
            cur.execute("SELECT COUNT(*) FROM pedidos WHERE DATE(fecha) = ? AND fecha >= '2026-02-01'", (hoy,))
            pedidos_hoy = cur.fetchone()[0]
            
            # Stock bajo (productos con stock < stock_minimo)
            cur.execute("""
                SELECT COUNT(*) 
                FROM productos 
                WHERE stock < stock_minimo AND stock_minimo > 0
            """)
            stock_bajo = cur.fetchone()[0]
            
            # Pedidos pendientes (only from 2026-02-01 onwards)
            cur.execute("""
                SELECT COUNT(*) 
                FROM pedidos 
                WHERE estado IN ('Pendiente', 'En Preparación', 'Listo')
                AND fecha >= '2026-02-01'
            """)
            pedidos_pendientes = cur.fetchone()[0]
            
            # Pedidos últimos 30 días (only from 2026-02-01 onwards)
            hace_30_dias = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            cur.execute("""
                SELECT COUNT(*) 
                FROM pedidos 
                WHERE DATE(fecha) >= ?
                AND fecha >= '2026-02-01'
            """, (hace_30_dias,))
            pedidos_mes = cur.fetchone()[0]
            
            # Productos más vendidos (últimos 30 días, only from 2026-02-01 onwards)
            cur.execute("""
                SELECT 
                    p.id,
                    p.nombre,
                    COALESCE(SUM(dp.cantidad), 0) as total_vendido
                FROM productos p
                LEFT JOIN detalles_pedido dp ON dp.producto_id = p.id
                LEFT JOIN pedidos pd ON dp.pedido_id = pd.id 
                    AND DATE(pd.fecha) >= ?
                    AND pd.fecha >= '2026-02-01'
                GROUP BY p.id, p.nombre
                HAVING total_vendido > 0
                ORDER BY total_vendido DESC
                LIMIT 5
            """, (hace_30_dias,))
            top_productos = [{"id": row[0], "nombre": row[1], "cantidad": row[2]} for row in cur.fetchall()]
            
            return {
                "total_clientes": total_clientes,
                "total_productos": total_productos,
                "pedidos_hoy": pedidos_hoy,
                "stock_bajo_count": stock_bajo,
                "pedidos_pendientes": pedidos_pendientes,
                "pedidos_mes": pedidos_mes,
                "top_productos": top_productos
            }
    except Exception as e:
        raise safe_error_handler(e, "dashboard", "obtener métricas")


@router.get("/pedidos_por_dia")
@limiter.limit(RATE_LIMIT_READ)
async def get_pedidos_por_dia(
    request: Request,
    dias: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get orders per day for the last N days"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            
            fecha_inicio = (datetime.now() - timedelta(days=dias)).strftime("%Y-%m-%d")
            cur.execute("""
                SELECT 
                    DATE(fecha) as dia,
                    COUNT(*) as cantidad
                FROM pedidos
                WHERE DATE(fecha) >= ?
                AND fecha >= '2026-02-01'
                GROUP BY DATE(fecha)
                ORDER BY dia ASC
            """, (fecha_inicio,))
            
            return [{"fecha": row[0], "cantidad": row[1]} for row in cur.fetchall()]
    except Exception as e:
        raise safe_error_handler(e, "dashboard", "obtener pedidos por día")


@router.get("/alertas")
@limiter.limit(RATE_LIMIT_READ)
async def get_alertas(request: Request, current_user: dict = Depends(get_current_user)):
    """Get system alerts (stock bajo, etc)"""
    try:
        with db.get_db_connection() as conn:
            cur = conn.cursor()
            alertas = []
            
            # Productos con stock bajo
            cur.execute("""
                SELECT id, nombre, stock, stock_minimo
                FROM productos
                WHERE stock < stock_minimo AND stock_minimo > 0
                ORDER BY (CAST(stock AS FLOAT) / NULLIF(stock_minimo, 0)) ASC
                LIMIT 10
            """)
            
            for row in cur.fetchall():
                alertas.append({
                    "tipo": "stock_bajo",
                    "producto_id": row[0],
                    "producto": row[1],
                    "stock_actual": row[2],
                    "stock_minimo": row[3],
                    "mensaje": f"⚠️ {row[1]}: stock {row[2]} (mínimo: {row[3]})"
                })
            
            return alertas
    except Exception as e:
        raise safe_error_handler(e, "dashboard", "obtener alertas")
