"""
Chorizaurio API - Main Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from datetime import datetime, timezone
import os
import logging

import db
from deps import limiter
from routers import pedidos, clientes, productos, auth, categorias, ofertas

# --- Basic Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
API_VERSION = "1.0.0"

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
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
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
    
    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": db_status,
        "version": API_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }