"""
Request tracking middleware - adds request_id and timing to all requests
Integrates with Sentry for better error tracking
"""

import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """Track all requests with unique ID and timing"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Calculate response time
            process_time_ms = (time.time() - start_time) * 1000
            
            # Add headers for debugging
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time_ms:.2f}ms"
            
            # Log slow requests (> 1 second), except login (bcrypt is intentionally slow)
            if process_time_ms > 1000 and request.url.path != "/api/login":
                logger.warning(
                    f"SLOW REQUEST [{request_id}] {request.method} {request.url.path} "
                    f"took {process_time_ms:.2f}ms"
                )
            
            return response
            
        except Exception as e:
            # Add request ID to exception for Sentry
            logger.error(
                f"ERROR [{request_id}] {request.method} {request.url.path}: {str(e)}"
            )
            raise


def get_request_id(request: Request) -> str:
    """Get request ID from request state"""
    return getattr(request.state, "request_id", "unknown")
