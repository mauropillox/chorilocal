"""Upload Router - Handle file uploads"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from typing import Optional
import os
import uuid
import shutil

from deps import get_current_user, limiter, RATE_LIMIT_WRITE

router = APIRouter()

# Upload directory - use same base directory as DB_PATH for persistence on Render
# On Render, DB_PATH=/etc/secrets/ventas.db, so uploads go to /etc/secrets/uploads/
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")

if ENVIRONMENT == "production":
    # Use the same base directory as the database for persistent storage
    db_dir = os.path.dirname(DB_PATH)
    UPLOAD_DIR = os.path.join(db_dir, "uploads")
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads")

# Try to ensure upload directory exists - but don't fail if we can't create it at import time
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    pass  # Will fail at upload time with proper error message

# Allowed file extensions
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/upload")
@limiter.limit(RATE_LIMIT_WRITE)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image file and return the URL"""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se proporcionó un nombre de archivo")
    
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo de archivo no permitido. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content to check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo es demasiado grande. Máximo: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivo: {str(e)}")
    
    # Return URL path (will be served by /media/uploads/)
    url = f"/media/uploads/{unique_filename}"
    
    return {"url": url, "filename": unique_filename}
