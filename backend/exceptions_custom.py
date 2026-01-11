"""
Custom exception classes for better error handling and categorization.
Replaces broad Exception catches with specific, meaningful error types.
"""


class ChorizaurioException(Exception):
    """Base exception for all Chorizaurio application errors"""
    def __init__(self, message: str, status_code: int = 500, detail: str = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        super().__init__(self.message)


class AuthenticationException(ChorizaurioException):
    """Raised when authentication fails"""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401)  # HTTP 401 Unauthorized


class AuthorizationException(ChorizaurioException):
    """Raised when user lacks required permissions"""
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, 403)  # HTTP 403 Forbidden


class ValidationException(ChorizaurioException):
    """Raised when input validation fails"""
    def __init__(self, message: str, field: str = None):
        detail = f"Validation error on {field}: {message}" if field else message
        super().__init__(message, 422, detail)


class ResourceNotFoundException(ChorizaurioException):
    """Raised when requested resource is not found"""
    def __init__(self, resource_type: str = "Resource", resource_id: str = None):
        message = f"{resource_type} not found"
        if resource_id:
            message += f" (ID: {resource_id})"
        super().__init__(message, 404)


class ConflictException(ChorizaurioException):
    """Raised when request conflicts with existing resource"""
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, 409)


class DatabaseException(ChorizaurioException):
    """Raised when database operation fails"""
    def __init__(self, message: str = "Database error", operation: str = None):
        detail = f"Database {operation} failed: {message}" if operation else message
        super().__init__(message, 500, detail)


class IntegrityException(ChorizaurioException):
    """Raised when database constraint is violated"""
    def __init__(self, message: str = "Data integrity violation"):
        super().__init__(message, 409)


class ExternalServiceException(ChorizaurioException):
    """Raised when external API/service call fails"""
    def __init__(self, service_name: str, message: str):
        detail = f"{service_name} error: {message}"
        super().__init__(detail, 502, detail)


class TimeoutException(ChorizaurioException):
    """Raised when operation times out"""
    def __init__(self, operation: str = "Operation"):
        message = f"{operation} timed out"
        super().__init__(message, 504)


class InvalidStateException(ChorizaurioException):
    """Raised when operation not allowed in current state"""
    def __init__(self, current_state: str, message: str):
        detail = f"Cannot perform operation in state '{current_state}': {message}"
        super().__init__(detail, 400, detail)


class DuplicateException(ChorizaurioException):
    """Raised when attempting to create duplicate resource"""
    def __init__(self, message: str = "Duplicate resource"):
        super().__init__(message, 409)


class RateLimitException(ChorizaurioException):
    """Raised when rate limit is exceeded"""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, 429)


class FileException(ChorizaurioException):
    """Raised when file operation fails"""
    def __init__(self, message: str, operation: str = None):
        detail = f"File {operation} failed: {message}" if operation else message
        super().__init__(message, 400, detail)


class ConfigurationException(ChorizaurioException):
    """Raised when configuration is invalid"""
    def __init__(self, message: str):
        super().__init__(message, 500)


def to_http_exception(exc: ChorizaurioException):
    """Convert ChorizaurioException to dict for JSON response"""
    return {
        "status_code": exc.status_code,
        "detail": exc.detail,
        "message": exc.message
    }
