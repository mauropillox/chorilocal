"""
WebSocket Router for Real-Time Updates

Provides real-time synchronization for:
- Pedido state changes (estado, repartidor)
- New pedidos
- Product stock updates

Usage:
  Frontend connects to /ws/{token}
  Backend broadcasts events to all connected clients
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, Set, List, Any
import json
import asyncio
from datetime import datetime
from jose import jwt, JWTError

from deps import SECRET_KEY, ALGORITHM
from logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/ws", tags=["websocket"])

# ==================== CONNECTION MANAGER ====================

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        # Map of user_id -> set of WebSocket connections
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # All connections for broadcast
        self.all_connections: Set[WebSocket] = set()
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
            self.all_connections.add(websocket)
        logger.info(f"WebSocket connected: user {user_id}, total connections: {len(self.all_connections)}")
    
    async def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection"""
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            self.all_connections.discard(websocket)
        logger.info(f"WebSocket disconnected: user {user_id}, remaining: {len(self.all_connections)}")
    
    async def send_personal(self, user_id: int, message: dict):
        """Send message to all connections of a specific user"""
        async with self._lock:
            connections = self.active_connections.get(user_id, set()).copy()
        
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to user {user_id}: {e}")
    
    async def broadcast(self, message: dict, exclude_user: int = None):
        """Broadcast message to all connected clients"""
        async with self._lock:
            connections = self.all_connections.copy()
        
        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                disconnected.append(connection)
                logger.warning(f"Broadcast failed, connection will be removed: {e}")
        
        # Clean up disconnected
        if disconnected:
            async with self._lock:
                for conn in disconnected:
                    self.all_connections.discard(conn)
    
    @property
    def connection_count(self) -> int:
        return len(self.all_connections)


# Global connection manager instance
manager = ConnectionManager()

# ==================== EVENT TYPES ====================

class WSEventType:
    """WebSocket event types for real-time updates"""
    PEDIDO_CREATED = "pedido_created"
    PEDIDO_UPDATED = "pedido_updated"
    PEDIDO_ESTADO_CHANGED = "pedido_estado_changed"
    PEDIDO_DELETED = "pedido_deleted"
    PRODUCTO_STOCK_UPDATED = "producto_stock_updated"
    CLIENTE_UPDATED = "cliente_updated"
    SYNC_REQUEST = "sync_request"
    PONG = "pong"


def create_event(event_type: str, data: Any, user_id: int = None) -> dict:
    """Create a standardized WebSocket event"""
    return {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
    }


# ==================== WEBSOCKET ENDPOINT ====================

@router.websocket("/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    WebSocket endpoint for real-time updates.
    
    Connect with: ws://host/ws/{jwt_token}
    
    Messages received:
    - {"type": "ping"} -> responds with {"type": "pong"}
    - {"type": "sync_request", "resource": "pedidos"} -> triggers refetch
    
    Messages sent:
    - {"type": "pedido_estado_changed", "data": {...}, "timestamp": "..."}
    - {"type": "producto_stock_updated", "data": {...}, "timestamp": "..."}
    """
    # Verify token using JWT decode
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload:
            await websocket.close(code=4001, reason="Invalid token")
            return
        # user_id could be username string (sub) - we use it as identifier
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="No user ID in token")
            return
        # Hash username to int for connection tracking
        user_id_hash = hash(user_id) % 1000000
    except JWTError as e:
        logger.warning(f"WebSocket auth failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    # Connect
    await manager.connect(websocket, user_id_hash)
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "Real-time sync active",
            "user_id": user_id,
            "connections": manager.connection_count,
        })
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type", "")
                
                if msg_type == "ping":
                    await websocket.send_json(create_event(WSEventType.PONG, None, user_id))
                
                elif msg_type == "sync_request":
                    # Client is requesting a sync - acknowledge
                    resource = data.get("resource", "all")
                    await websocket.send_json({
                        "type": "sync_acknowledged",
                        "resource": resource,
                    })
                
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from user {user_id}")
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id_hash)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await manager.disconnect(websocket, user_id_hash)


# ==================== BROADCAST HELPERS ====================

async def broadcast_pedido_change(event_type: str, pedido_data: dict, user_id: int = None):
    """Broadcast a pedido change to all connected clients"""
    event = create_event(event_type, pedido_data, user_id)
    await manager.broadcast(event)
    logger.info(f"Broadcast {event_type}: pedido {pedido_data.get('id')}")


async def broadcast_stock_update(producto_id: int, new_stock: float, user_id: int = None):
    """Broadcast a stock update to all connected clients"""
    event = create_event(WSEventType.PRODUCTO_STOCK_UPDATED, {
        "producto_id": producto_id,
        "stock": new_stock,
    }, user_id)
    await manager.broadcast(event)
    logger.info(f"Broadcast stock update: producto {producto_id} -> {new_stock}")


# ==================== STATUS ENDPOINT ====================

@router.get("/status")
async def websocket_status():
    """Get WebSocket connection status"""
    return {
        "active_connections": manager.connection_count,
        "status": "healthy",
    }
