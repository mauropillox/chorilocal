"""Upload Router - Handle file uploads"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from typing import Optional
import os
import uuid
import base64

from deps import get_current_user, limiter, RATE_LIMIT_WRITE

router = APIRouter()

# Allowed file extensions and MIME types
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", 
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
}
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
    """Upload an image file and return a base64 data URL.
    
    On Render.com, filesystem is ephemeral so we return the image as a 
    base64 data URL that can be stored directly in the database.
    """
    
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
    
    # Get MIME type
    ext = os.path.splitext(file.filename)[1].lower()
    mime_type = MIME_TYPES.get(ext, "image/jpeg")
    
    # Convert to base64 data URL
    b64_content = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{mime_type};base64,{b64_content}"
    
    return {"url": data_url, "filename": file.filename, "size": len(content)}
