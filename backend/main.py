"""
Chorizaurio API - Main Application Entry Point
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from datetime import datetime, timezone
import os
import time
import traceback

import db
import models
from deps import limiter
from routers import pedidos, clientes, productos, auth, categorias, ofertas, migration, dashboard, estadisticas, usuarios, templates, tags, upload
from logging_config import setup_logging, get_logger, set_request_id, get_request_id, Timer

# --- Structured Logging Setup ---
setup_logging()
logger = get_logger(__name__)
API_VERSION = "1.2.0"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# --- Validate Production Configuration ---
if ENVIRONMENT == "production":
    db.validate_production_config()
    # Validate required environment variables
    from deps import validate_production_secrets
    validate_production_secrets()
    if db.USE_POSTGRES:
        logger.info("startup", message="Starting in PRODUCTION mode with PostgreSQL")
    else:
        logger.info("startup", message="Starting in PRODUCTION mode with SQLite")
else:
    logger.info("startup", message="Starting in DEVELOPMENT mode", environment=ENVIRONMENT)

# --- App Initialization ---
app = FastAPI(
    title="Chorizaurio API",
    description="Gestión de pedidos y clientes de carnicería",
    version=API_VERSION,
    # Disable docs in production for security
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if ENVIRONMENT != "production" else None
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
    request_id = get_request_id()
    logger.error(
        "unhandled_exception",
        error=str(exc),
        exception_type=type(exc).__name__,
        path=request.url.path,
        request_id=request_id
    )
    
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
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


# --- Middleware ---
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS configuration - production domains + localhost for development
DEFAULT_CORS = "https://www.pedidosfriosur.com,https://pedidosfriosur.com,http://localhost,http://localhost:80,http://localhost:8000,http://localhost:5173"
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],  # Allow frontend to read request ID
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Add request ID and log all requests with timing"""
    # Get or generate request ID
    request_id = request.headers.get("X-Request-ID") or set_request_id()
    set_request_id(request_id)
    
    # Start timing
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000
    
    # Log request (skip health checks for noise reduction)
    if request.url.path not in ["/health", "/favicon.ico"]:
        log_level = "warning" if duration_ms > 500 else "info"
        getattr(logger, log_level)(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            request_id=request_id
        )
    
    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id
    
    return response


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    if ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff" 
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Remove server header for security (use del instead of pop)
        if "server" in response.headers:
            del response.headers["server"]
    return response


# --- Routers ---
# API routes with /api prefix
app.include_router(auth.router, prefix="/api", tags=["Autenticación y Usuarios"])
app.include_router(pedidos.router, prefix="/api", tags=["Pedidos"])
app.include_router(clientes.router, prefix="/api", tags=["Clientes"])
app.include_router(productos.router, prefix="/api", tags=["Productos"])
app.include_router(categorias.router, prefix="/api", tags=["Categorías"])
app.include_router(ofertas.router, prefix="/api", tags=["Ofertas"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(estadisticas.router, prefix="/api", tags=["Estadísticas"])
app.include_router(usuarios.router, prefix="/api", tags=["Usuarios"])
app.include_router(templates.router, prefix="/api", tags=["Templates"])
app.include_router(tags.router, prefix="/api", tags=["Tags"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(migration.router, prefix="/api/admin", tags=["Migration"])

# --- Static File Serving for Uploads ---
# Mount /media/uploads to serve uploaded images
if ENVIRONMENT == "production":
    UPLOAD_DIR = "/data/uploads"
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")

# Create upload directory if it doesn't exist
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception as e:
    logger.warning("upload_dir_creation", message=f"Could not create upload directory: {e}")

# Only mount if directory exists
if os.path.exists(UPLOAD_DIR):
    app.mount("/media/uploads", StaticFiles(directory=UPLOAD_DIR), name="media")
else:
    logger.warning("upload_dir_missing", message=f"Upload directory not found: {UPLOAD_DIR}")

# Backward-compatible routes without /api prefix (for legacy clients/tests)
app.include_router(auth.router, tags=["Autenticación (Legacy)"])
app.include_router(pedidos.router, tags=["Pedidos (Legacy)"])
app.include_router(clientes.router, tags=["Clientes (Legacy)"])
app.include_router(productos.router, tags=["Productos (Legacy)"])
app.include_router(categorias.router, tags=["Categorías (Legacy)"])
app.include_router(ofertas.router, tags=["Ofertas (Legacy)"])
app.include_router(dashboard.router, tags=["Dashboard (Legacy)"])
app.include_router(estadisticas.router, tags=["Estadísticas (Legacy)"])
app.include_router(usuarios.router, tags=["Usuarios (Legacy)"])
app.include_router(templates.router, tags=["Templates (Legacy)"])
app.include_router(tags.router, tags=["Tags (Legacy)"])
app.include_router(upload.router, tags=["Upload (Legacy)"])


# --- Startup Event ---
@app.on_event("startup")
async def startup_event():
    """Run migrations and initialization on startup"""
    logger.info("startup_migration", message="Running startup migrations...")
    try:
        # Run one-time migration to fix localhost URLs
        from migraciones.fix_localhost_urls import migrate_localhost_urls
        migrate_localhost_urls()
        logger.info("startup_migration", message="Startup migrations completed")
    except Exception as e:
        logger.error("startup_migration_failed", error=str(e), exception_type=type(e).__name__)


# --- Root Endpoint ---
@app.get("/")
def root():
    return {"message": "Chorizaurio API is running", "version": API_VERSION}


# --- Health Check ---
@app.get("/health")
def health_check():
    request_id = get_request_id()
    try:
        with Timer("health_db_check", logger, threshold_ms=50):
            with db.get_db_connection() as conn:
                conn.cursor().execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
        logger.error("health_check_failed", error=str(e), request_id=request_id)
    
    db_info = db.get_database_info()
    
    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": db_status,
        "database_type": db_info["type"],
        "environment": ENVIRONMENT,
        "version": API_VERSION,
        "request_id": request_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }