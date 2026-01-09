"""
Structured Logging Configuration for Chorizaurio API

Provides:
- JSON-formatted logs for production (easy parsing by log aggregators)
- Human-readable logs for development
- Request ID tracking across the request lifecycle
- Performance timing for slow operations
- Sentry integration for error and performance monitoring
"""
import os
import sys
import logging
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

# Try to import structlog, fall back to standard logging if not available
try:
    import structlog
    STRUCTLOG_AVAILABLE = True
except ImportError:
    STRUCTLOG_AVAILABLE = False

# Try to import Sentry
try:
    import sentry_sdk
    from sentry_sdk.integrations.logging import LoggingIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False

# Context variable for request ID tracking
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


def _read_secret(env_var: str, file_env_var: str, default: str) -> str:
    """Read secret from environment or Docker secrets file"""
    # First try direct environment variable
    value = os.getenv(env_var)
    if value:
        return value
    # Then try Docker secrets file
    file_path = os.getenv(file_env_var)
    if file_path and os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return f.read().strip()
        except Exception:
            pass
    return default


ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = os.getenv("LOG_FORMAT", "json" if ENVIRONMENT == "production" else "console")
SENTRY_DSN = _read_secret("SENTRY_DSN", "SENTRY_DSN_FILE", "")


def get_request_id() -> Optional[str]:
    """Get current request ID from context"""
    return request_id_var.get()


def set_request_id(request_id: Optional[str] = None) -> str:
    """Set request ID in context, generate if not provided"""
    if request_id is None:
        request_id = str(uuid.uuid4())[:8]
    request_id_var.set(request_id)
    return request_id


def add_request_id(logger, method_name, event_dict):
    """Structlog processor to add request ID to all log entries"""
    request_id = get_request_id()
    if request_id:
        event_dict['request_id'] = request_id
    return event_dict


def add_timestamp(logger, method_name, event_dict):
    """Add ISO timestamp to log entries"""
    event_dict['timestamp'] = datetime.now(timezone.utc).isoformat()
    return event_dict


def setup_logging():
    """Configure structured logging for the application"""
    
    if not STRUCTLOG_AVAILABLE:
        # Fall back to standard logging
        logging.basicConfig(
            level=getattr(logging, LOG_LEVEL),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)
    
    # Shared processors for both renderers
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.PositionalArgumentsFormatter(),
        add_timestamp,
        add_request_id,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]
    
    if LOG_FORMAT == "json":
        # Production: JSON output for log aggregation
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ]
    else:
        # Development: Human-readable console output
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging to use structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, LOG_LEVEL),
    )
    
    # Initialize Sentry if configured (only with valid DSN)
    if SENTRY_AVAILABLE and SENTRY_DSN and SENTRY_DSN.strip() and ENVIRONMENT == "production":
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            # Performance Monitoring - sample 10% of requests
            traces_sample_rate=0.1,
            # Profiling - sample 10% of transactions
            profiles_sample_rate=0.1,
            # Send error events for logging level WARNING and above
            integrations=[
                LoggingIntegration(
                    level=logging.INFO,        # Capture info and above as breadcrumbs
                    event_level=logging.WARNING  # Send warnings and errors as events
                )
            ],
            # Set tracing options
            _experiments={
                "profiles_sample_rate": 0.1,
            },
        )
        logging.getLogger(__name__).info("Sentry performance monitoring enabled (10% sample rate)")
    
    return structlog.get_logger()


def get_logger(name: str = None):
    """Get a logger instance"""
    if STRUCTLOG_AVAILABLE:
        return structlog.get_logger(name)
    return logging.getLogger(name)


# Performance timing helper
class Timer:
    """Context manager for timing operations"""
    
    def __init__(self, operation: str, logger=None, threshold_ms: float = 100):
        self.operation = operation
        self.logger = logger or get_logger()
        self.threshold_ms = threshold_ms
        self.start_time = None
        self.duration_ms = None
    
    def __enter__(self):
        self.start_time = datetime.now(timezone.utc)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        end_time = datetime.now(timezone.utc)
        self.duration_ms = (end_time - self.start_time).total_seconds() * 1000
        
        if self.duration_ms > self.threshold_ms:
            self.logger.warning(
                "slow_operation",
                operation=self.operation,
                duration_ms=round(self.duration_ms, 2),
                threshold_ms=self.threshold_ms
            )
        else:
            self.logger.debug(
                "operation_completed",
                operation=self.operation,
                duration_ms=round(self.duration_ms, 2)
            )
        
        return False  # Don't suppress exceptions


# Initialize logging on module import
logger = setup_logging()
