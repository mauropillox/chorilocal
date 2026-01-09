"""
Centralized exception handling utilities for FastAPI routers.

This module provides safe error handling that:
- Logs full error details internally (including stack traces)
- Returns generic messages to clients (no internal details exposed)
- Provides specific HTTP status codes for known error types
"""

import traceback
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class SafeHTTPException:
    """
    Factory for creating safe HTTPExceptions that don't leak internal details.
    
    Usage:
        from exceptions import safe_error_handler, SafeHTTPException
        
        try:
            # risky operation
        except Exception as e:
            raise safe_error_handler(e, "pedidos", "crear pedido")
    """
    
    @staticmethod
    def internal_error(operation: str = "operation") -> HTTPException:
        """Generic 500 error - never expose internal details"""
        return HTTPException(
            status_code=500,
            detail=f"Error interno al procesar {operation}. Por favor, intente nuevamente."
        )
    
    @staticmethod
    def not_found(resource: str = "recurso") -> HTTPException:
        return HTTPException(status_code=404, detail=f"{resource} no encontrado")
    
    @staticmethod
    def validation_error(message: str = "Datos inválidos") -> HTTPException:
        return HTTPException(status_code=400, detail=message)
    
    @staticmethod
    def permission_denied(action: str = "esta acción") -> HTTPException:
        return HTTPException(status_code=403, detail=f"No tiene permiso para {action}")
    
    @staticmethod
    def conflict(message: str = "Conflicto con datos existentes") -> HTTPException:
        return HTTPException(status_code=409, detail=message)


def safe_error_handler(
    error: Exception, 
    context: str = "operation", 
    operation: str = "",
    request_id: str = None
) -> HTTPException:
    """
    Safely handle an exception:
    1. Log full details internally (for debugging)
    2. Return a safe HTTPException (no internal details exposed)
    
    Args:
        error: The caught exception
        context: The module/router name (e.g., "pedidos", "clientes")
        operation: The specific operation (e.g., "crear", "actualizar")
        request_id: Optional request ID for correlation
    
    Returns:
        HTTPException with safe, user-friendly message
    
    Usage:
        try:
            result = risky_database_operation()
        except Exception as e:
            raise safe_error_handler(e, "pedidos", "crear pedido")
    """
    # Log the full error internally
    logger.error(
        "internal_error",
        extra={
            "context": context,
            "operation": operation,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc(),
            "request_id": request_id,
        }
    )
    
    # Map known exceptions to appropriate HTTP status codes
    error_type = type(error).__name__
    
    if error_type == "ValidationError":
        return HTTPException(status_code=400, detail="Datos de entrada inválidos")
    
    if error_type in ("FileNotFoundError", "KeyError"):
        return HTTPException(status_code=404, detail="Recurso no encontrado")
    
    if error_type == "PermissionError":
        return HTTPException(status_code=403, detail="Permiso denegado")
    
    if "IntegrityError" in error_type or "UNIQUE constraint" in str(error):
        return HTTPException(status_code=409, detail="El registro ya existe o hay un conflicto")
    
    if "OperationalError" in error_type and "locked" in str(error).lower():
        return HTTPException(
            status_code=503, 
            detail="Base de datos ocupada, intente nuevamente en unos segundos"
        )
    
    # Default: generic internal error
    op_description = f"{operation}" if operation else "la operación"
    return HTTPException(
        status_code=500,
        detail=f"Error interno al procesar {op_description}. Por favor, intente nuevamente."
    )


def log_and_raise_safe(
    error: Exception,
    context: str,
    operation: str,
    fallback_message: str = None
) -> None:
    """
    Convenience function that logs and raises in one call.
    
    Usage:
        except Exception as e:
            log_and_raise_safe(e, "dashboard", "obtener métricas")
    """
    raise safe_error_handler(error, context, operation)
