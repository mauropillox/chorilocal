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
from exceptions_custom import ChorizaurioException, to_http_exception
from routers import pedidos, clientes, productos, auth, categorias, ofertas, migration, dashboard, estadisticas, usuarios, templates, tags, upload, admin, repartidores, hoja_ruta, reportes, listas_precios  # , websocket - Disabled: Render free tier doesn't support WebSocket
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
        logger.info("Starting in PRODUCTION mode with PostgreSQL")
    else:
        logger.info("Starting in PRODUCTION mode with SQLite")
else:
    logger.info(f"Starting in DEVELOPMENT mode - Environment: {ENVIRONMENT}")

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


@app.exception_handler(ChorizaurioException)
async def chorizaurio_exception_handler(request: Request, exc: ChorizaurioException):
    """Handle custom Chorizaurio exceptions with standardized format"""
    request_id = get_request_id()
    logger.warning(
        "chorizaurio_exception",
        error=exc.message,
        exception_type=type(exc).__name__,
        path=request.url.path,
        request_id=request_id
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": type(exc).__name__,
            "request_id": request_id,
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
from middleware import RequestTrackingMiddleware
app.add_middleware(RequestTrackingMiddleware)
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
app.include_router(repartidores.router, prefix="/api", tags=["Repartidores"])
app.include_router(hoja_ruta.router, prefix="/api", tags=["Hoja de Ruta"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(reportes.router, prefix="/api", tags=["Reportes"])
app.include_router(listas_precios.router, prefix="/api", tags=["Listas de Precios"])
app.include_router(migration.router, prefix="/api/admin", tags=["Migration"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])
# app.include_router(websocket.router, prefix="/api", tags=["WebSocket"])  # Disabled: Render free tier doesn't support WebSocket

# --- Static File Serving for Uploads ---
# NOTE: In production on Render, we use base64 data URLs stored in the database
# instead of filesystem storage (Render's filesystem is ephemeral).
# This static mount is only used for local development.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
if ENVIRONMENT != "production":
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        if os.path.exists(UPLOAD_DIR):
            app.mount("/media/uploads", StaticFiles(directory=UPLOAD_DIR), name="media")
    except Exception as e:
        logger.warning(f"Could not create upload directory: {e}")

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
    """
    Safe startup initialization:
    - Run controlled, one-time migrations (tracked in migration_log)
    - Enable SQLite hardening (WAL mode, foreign keys)
    - Start backup scheduler (in production)
    
    IMPORTANT: We do NOT run data-mutating queries here that affect users.
    All such changes must go through the controlled migration system.
    """
    logger.info("Starting application initialization...")
    
    try:
        # Step 1: SQLite hardening (connection-level settings)
        if not db.USE_POSTGRES:
            with db.get_db_connection() as conn:
                cursor = conn.cursor()
                # Enable WAL mode for better concurrency
                cursor.execute("PRAGMA journal_mode=WAL")
                journal = cursor.fetchone()[0]
                # Increase busy timeout to reduce "database locked" errors
                cursor.execute("PRAGMA busy_timeout=30000")  # 30 seconds
                # Enable foreign key enforcement
                cursor.execute("PRAGMA foreign_keys=ON")
                logger.info(f"SQLite hardening: journal_mode={journal}, busy_timeout=30000ms, foreign_keys=ON")
        
        # Step 2: Run controlled migrations (one-time, tracked)
        from migrations import run_pending_migrations
        executed = run_pending_migrations()
        if executed:
            logger.info(f"Migrations executed: {len(executed)} - {executed}")
        else:
            logger.info("No pending migrations")
        
        # Step 3: Verify database indexes (SQLite only, lightweight check)
        if not db.USE_POSTGRES:
            with db.get_db_connection() as conn:
                cursor = conn.cursor()
                # Only check if indexes exist, don't recreate on every startup
                cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
                index_count = cursor.fetchone()[0]
                
                # Only create indexes if missing (first-time setup)
                if index_count < 6:
                    expected_indexes = {
                        'idx_pedidos_cliente': 'CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id)',
                        'idx_pedidos_estado': 'CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)',
                        'idx_pedidos_fecha': 'CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha)',
                        'idx_productos_categoria': 'CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)',
                        'idx_pedido_productos_pedido': 'CREATE INDEX IF NOT EXISTS idx_pedido_productos_pedido ON pedido_productos(pedido_id)',
                        'idx_pedido_productos_producto': 'CREATE INDEX IF NOT EXISTS idx_pedido_productos_producto ON pedido_productos(producto_id)',
                    }
                    
                    created = []
                    for idx_name, create_sql in expected_indexes.items():
                        try:
                            cursor.execute(create_sql)
                            created.append(idx_name)
                        except Exception as e:
                            logger.warning(f"Index creation failed for {idx_name}: {str(e)}")
                    
                    if created:
                        conn.commit()
                        logger.info(f"Indexes created: {created}")
                else:
                    logger.info(f"Indexes verified: {index_count} existing")
        
        # Step 4: Start backup scheduler (DISABLED to save resources)
        # Backups can be done manually or via external cron job
        # if ENVIRONMENT == "production":
        #     from backup_scheduler import start_backup_scheduler
        #     start_backup_scheduler()
        #     logger.info("Backup scheduler started")
        logger.info("Backup scheduler: DISABLED (use manual backups or external cron)")
        
        logger.info("Application initialization completed successfully")
        
    except Exception as e:
        logger.error(f"Startup failed: {type(e).__name__} - {str(e)}")
        # In production, we may want to fail fast
        if ENVIRONMENT == "production":
            raise


# --- Root Endpoint ---
@app.get("/")
def root():
    return {"message": "Chorizaurio API is running", "version": API_VERSION}


# --- Health Check ---
@app.get("/health")
@app.get("/api/health")  # Frontend uses /api/health
def health_check():
    request_id = get_request_id()
    try:
        with Timer("health_db_check", logger, threshold_ms=50):
            with db.get_db_connection() as conn:
                conn.cursor().execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
        logger.error(f"Health check failed [req_id={request_id}]: {str(e)}")
    
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