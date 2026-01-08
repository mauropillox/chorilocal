"""
Chorizaurio API - Main Application Entry Point
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from datetime import datetime, timezone
import os
import logging
import traceback

import db
import models
from deps import limiter
from routers import pedidos, clientes, productos, auth, categorias, ofertas

# --- Basic Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
API_VERSION = "1.1.0"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# --- Validate Production Configuration ---
if ENVIRONMENT == "production":
    db.validate_production_config()
    logger.info("Starting in PRODUCTION mode with PostgreSQL")

# --- App Initialization ---
app = FastAPI(
    title="Chorizaurio API",
    description="Gestión de pedidos y clientes de carnicería",
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# --- Rate Limiting ---
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={
            "error": f"Rate limit exceeded: {exc.detail}",
            "code": models.ErrorCodes.RATE_LIMITED,
            "details": {"limit": str(exc.detail)},
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with standardized format"""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "value": error.get("input")
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "code": models.ErrorCodes.VALIDATION_ERROR,
            "details": errors,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standardized format"""
    # Map status codes to error codes
    code_map = {
        401: models.ErrorCodes.UNAUTHORIZED,
        403: models.ErrorCodes.FORBIDDEN,
        404: models.ErrorCodes.NOT_FOUND,
        409: models.ErrorCodes.CONFLICT,
        429: models.ErrorCodes.RATE_LIMITED
    }
    
    error_code = code_map.get(exc.status_code, "HTTP_ERROR")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": error_code,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with standardized format"""
    logger.error(f"Unhandled exception: {exc}\n{traceback.format_exc()}")
    
    # In development, include stack trace
    details = None
    if ENVIRONMENT != "production":
        details = {"traceback": traceback.format_exc()}
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "code": models.ErrorCodes.INTERNAL_ERROR,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


# --- Middleware ---
app.add_middleware(GZipMiddleware, minimum_size=1000)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:80,http://localhost:8000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
    return response


# --- Routers ---
# API routes with /api prefix
app.include_router(auth.router, prefix="/api", tags=["Autenticación y Usuarios"])
app.include_router(pedidos.router, prefix="/api", tags=["Pedidos"])
app.include_router(clientes.router, prefix="/api", tags=["Clientes"])
app.include_router(productos.router, prefix="/api", tags=["Productos"])
app.include_router(categorias.router, prefix="/api", tags=["Categorías"])
app.include_router(ofertas.router, prefix="/api", tags=["Ofertas"])

# Backward-compatible routes without /api prefix (for legacy clients/tests)
app.include_router(auth.router, tags=["Autenticación (Legacy)"])
app.include_router(pedidos.router, tags=["Pedidos (Legacy)"])
app.include_router(clientes.router, tags=["Clientes (Legacy)"])
app.include_router(productos.router, tags=["Productos (Legacy)"])
app.include_router(categorias.router, tags=["Categorías (Legacy)"])
app.include_router(ofertas.router, tags=["Ofertas (Legacy)"])


# --- Root Endpoint ---
@app.get("/")
def root():
    return {"message": "Chorizaurio API is running", "version": API_VERSION}


# --- Health Check ---
@app.get("/health")
def health_check():
    try:
        with db.get_db_connection() as conn:
            conn.cursor().execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
    
    db_info = db.get_database_info()
    
    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": db_status,
        "database_type": db_info["type"],
        "environment": ENVIRONMENT,
        "version": API_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }