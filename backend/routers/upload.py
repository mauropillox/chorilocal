"""Upload Router - Handle file uploads with automatic optimization"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from typing import Optional
import os
import base64
from io import BytesIO
import logging

from PIL import Image
from deps import get_current_user, limiter, RATE_LIMIT_WRITE

logger = logging.getLogger(__name__)
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

# Image optimization settings
MAX_IMAGE_DIMENSION = 800  # Max width or height in pixels
JPEG_QUALITY = 85  # JPEG compression quality (1-100)


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def optimize_image(content: bytes, original_ext: str) -> tuple[bytes, str]:
    """Optimize image: resize if too large and compress.
    
    Returns:
        tuple: (optimized_bytes, mime_type)
    """
    try:
        img = Image.open(BytesIO(content))
        original_size = len(content)
        
        # Handle animated GIFs - don't process, return as-is
        if original_ext in ('.gif',) and getattr(img, 'is_animated', False):
            return content, "image/gif"
        
        # Convert RGBA to RGB for JPEG (remove transparency)
        if img.mode in ('RGBA', 'P') and original_ext in ('.jpg', '.jpeg'):
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[3] if len(img.split()) == 4 else None)
            img = background
        elif img.mode == 'P':
            img = img.convert('RGB')
        
        # Resize if larger than max dimension
        width, height = img.size
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            # Calculate new size maintaining aspect ratio
            if width > height:
                new_width = MAX_IMAGE_DIMENSION
                new_height = int(height * (MAX_IMAGE_DIMENSION / width))
            else:
                new_height = MAX_IMAGE_DIMENSION
                new_width = int(width * (MAX_IMAGE_DIMENSION / height))
            
            img = img.resize((new_width, new_height), Image.LANCZOS)
            logger.info(f"Image resized: {width}x{height} -> {new_width}x{new_height}")
        
        # Save optimized image
        output = BytesIO()
        
        # Use JPEG for most images (better compression)
        if original_ext in ('.png',) and img.mode == 'RGBA':
            # Keep PNG for images with transparency
            img.save(output, format='PNG', optimize=True)
            mime_type = "image/png"
        else:
            # Convert to JPEG for better compression
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img.save(output, format='JPEG', quality=JPEG_QUALITY, optimize=True)
            mime_type = "image/jpeg"
        
        optimized_content = output.getvalue()
        new_size = len(optimized_content)
        
        # Only use optimized if it's actually smaller
        if new_size < original_size:
            logger.info(f"Image optimized: {original_size:,} -> {new_size:,} bytes ({100 - (new_size/original_size*100):.1f}% reduction)")
            return optimized_content, mime_type
        else:
            logger.info(f"Original image kept (optimized was larger)")
            return content, MIME_TYPES.get(original_ext, "image/jpeg")
            
    except Exception as e:
        logger.warning(f"Image optimization failed, using original: {e}")
        return content, MIME_TYPES.get(original_ext, "image/jpeg")


@router.post("/upload")
@limiter.limit(RATE_LIMIT_WRITE)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image file and return a base64 data URL.
    
    Images are automatically optimized:
    - Resized to max 800x800 pixels (maintaining aspect ratio)
    - Compressed with JPEG quality 85%
    - Typical reduction: 70-90% smaller file size
    
    On Render.com, filesystem is ephemeral so we return the image as a 
    base64 data URL that can be stored directly in the database.
    """
    
    # Validate file type by extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se proporcionó un nombre de archivo")
    
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo de archivo no permitido. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Validate MIME type (defense in depth - don't trust extension alone)
    allowed_mime_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type and file.content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de contenido no permitido: {file.content_type}"
        )
    
    # Read file content to check size
    content = await file.read()
    original_size = len(content)
    
    if original_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo es demasiado grande. Máximo: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Get original extension
    ext = os.path.splitext(file.filename)[1].lower()
    
    # Optimize image (resize + compress)
    optimized_content, mime_type = optimize_image(content, ext)
    
    # Convert to base64 data URL
    b64_content = base64.b64encode(optimized_content).decode('utf-8')
    data_url = f"data:{mime_type};base64,{b64_content}"
    
    return {
        "url": data_url, 
        "filename": file.filename, 
        "size": len(optimized_content),
        "original_size": original_size,
        "optimized": len(optimized_content) < original_size
    }
