/**
 * WebSocket Hook for Real-Time Sync
 * 
 * Connects to backend WebSocket and handles real-time updates:
 * - Pedido estado changes
 * - Stock updates
 * - New pedidos
 * 
 * Auto-reconnects on disconnect with exponential backoff.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CACHE_KEYS } from '../utils/queryClient';
import { toastSuccess, toastInfo } from '../toast';
import { obtenerToken } from '../auth';
import { logger } from '../utils/logger';

// WebSocket event types (must match backend)
export const WSEventType = {
    PEDIDO_CREATED: 'pedido_created',
    PEDIDO_UPDATED: 'pedido_updated',
    PEDIDO_ESTADO_CHANGED: 'pedido_estado_changed',
    PEDIDO_DELETED: 'pedido_deleted',
    PRODUCTO_STOCK_UPDATED: 'producto_stock_updated',
    CLIENTE_UPDATED: 'cliente_updated',
    CONNECTED: 'connected',
    PONG: 'pong',
};

// Configuration
const WS_RECONNECT_DELAY_BASE = 1000; // 1 second
const WS_RECONNECT_MAX_DELAY = 30000; // 30 seconds
const WS_PING_INTERVAL = 30000; // 30 seconds

/**
 * Get WebSocket URL from API URL
 */
function getWebSocketUrl() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const token = obtenerToken();
    if (!token) return null;

    // Convert http(s) to ws(s) and handle /api suffix
    let wsUrl = apiUrl.replace(/^http/, 'ws');

    // If API URL already ends with /api, use /ws directly
    // Otherwise add /api/ws
    if (wsUrl.endsWith('/api')) {
        return `${wsUrl}/ws/${token}`;
    }
    return `${wsUrl}/api/ws/${token}`;
}

/**
 * useWebSocket hook - connects and manages WebSocket
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Whether to connect (default: true)
 * @param {boolean} options.showNotifications - Show toast on remote changes (default: true)
 */
export function useWebSocket(options = {}) {
    const { enabled = true, showNotifications = true } = options;

    const queryClient = useQueryClient();
    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const pingIntervalRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionCount, setConnectionCount] = useState(0);

    // Handle incoming WebSocket messages
    const handleMessage = useCallback((event) => {
        try {
            const message = JSON.parse(event.data);
            const { type, data, user_id } = message;

            logger.debug('[WS] Received:', type, data);

            switch (type) {
                case WSEventType.CONNECTED:
                    setConnectionCount(message.connections || 0);
                    logger.info('[WS] Connected, total connections:', message.connections);
                    break;

                case WSEventType.PEDIDO_ESTADO_CHANGED:
                    // Update pedido in cache optimistically
                    queryClient.setQueryData(CACHE_KEYS.pedidos, (old = []) =>
                        old.map(p =>
                            p.id === data.id
                                ? { ...p, estado: data.estado, repartidor: data.repartidor }
                                : p
                        )
                    );
                    // Notify user of remote change
                    if (showNotifications) {
                        toastInfo(`🔄 Pedido #${data.id} actualizado a ${data.estado}`);
                    }
                    break;

                case WSEventType.PEDIDO_CREATED:
                    // Invalidate to refetch full list
                    queryClient.invalidateQueries({ queryKey: CACHE_KEYS.pedidos });
                    if (showNotifications) {
                        toastInfo(`📦 Nuevo pedido #${data.id} creado`);
                    }
                    break;

                case WSEventType.PEDIDO_DELETED:
                    // Remove from cache
                    queryClient.setQueryData(CACHE_KEYS.pedidos, (old = []) =>
                        old.filter(p => p.id !== data.id)
                    );
                    break;

                case WSEventType.PRODUCTO_STOCK_UPDATED:
                    // Update product stock in cache
                    queryClient.setQueryData(CACHE_KEYS.productos, (old = []) =>
                        old.map(p =>
                            p.id === data.producto_id
                                ? { ...p, stock: data.stock }
                                : p
                        )
                    );
                    break;

                case WSEventType.PONG:
                    // Heartbeat response - connection is alive
                    break;

                default:
                    logger.debug('[WS] Unknown message type:', type);
            }
        } catch (e) {
            logger.warn('[WS] Failed to parse message:', e);
        }
    }, [queryClient, showNotifications]);

    // Connect to WebSocket
    const connect = useCallback(() => {
        const wsUrl = getWebSocketUrl();
        if (!wsUrl) {
            logger.debug('[WS] No token, skipping connection');
            return;
        }

        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        logger.info('[WS] Connecting to:', wsUrl.split('/').slice(0, -1).join('/') + '/***');

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                logger.info('[WS] Connected');
                setIsConnected(true);
                reconnectAttemptRef.current = 0;

                // Start ping interval
                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, WS_PING_INTERVAL);
            };

            ws.onmessage = handleMessage;

            ws.onclose = (event) => {
                logger.info('[WS] Disconnected:', event.code, event.reason);
                setIsConnected(false);
                clearInterval(pingIntervalRef.current);

                // Reconnect with exponential backoff
                if (enabled && event.code !== 4001) { // Don't reconnect on auth failure
                    const delay = Math.min(
                        WS_RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptRef.current),
                        WS_RECONNECT_MAX_DELAY
                    );
                    reconnectAttemptRef.current++;
                    logger.info(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);
                    setTimeout(connect, delay);
                }
            };

            ws.onerror = (error) => {
                logger.warn('[WS] Error:', error);
            };

        } catch (e) {
            logger.error('[WS] Failed to connect:', e);
        }
    }, [enabled, handleMessage]);

    // Send message through WebSocket
    const sendMessage = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    // Connect on mount, disconnect on unmount
    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            clearInterval(pingIntervalRef.current);
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounted');
            }
        };
    }, [enabled, connect]);

    // Reconnect when token changes (login/logout)
    useEffect(() => {
        const handleAuth = () => {
            if (enabled) {
                // Small delay to ensure token is available
                setTimeout(connect, 100);
            }
        };

        window.addEventListener('auth-changed', handleAuth);
        return () => window.removeEventListener('auth-changed', handleAuth);
    }, [enabled, connect]);

    return {
        isConnected,
        connectionCount,
        sendMessage,
        reconnect: connect,
    };
}

/**
 * WebSocket Provider component
 * Add this near the root of your app to enable real-time sync globally
 */
export function WebSocketProvider({ children }) {
    useWebSocket({ enabled: true, showNotifications: true });
    return children;
}

export default useWebSocket;
