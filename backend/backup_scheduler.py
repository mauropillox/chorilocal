"""
In-App Backup Scheduler for SQLite Database
============================================
Provides:
- Periodic automatic backups (configurable interval)
- Backup rotation (keep last N)
- Inter-process lock to prevent concurrent backups
- Aligned backup time for external PC pull

Usage:
    from backup_scheduler import start_backup_scheduler, create_backup_now
    
    # Start scheduler (call once at app startup)
    start_backup_scheduler()
    
    # Manual backup
    backup_path = create_backup_now()
"""

import os
import sqlite3
import logging
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
import hashlib

logger = logging.getLogger(__name__)

# Configuration from environment
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/data/backups"))
BACKUP_INTERVAL_HOURS = int(os.getenv("BACKUP_INTERVAL_HOURS", "6"))
BACKUP_RETENTION_COUNT = int(os.getenv("BACKUP_RETENTION_COUNT", "10"))
BACKUP_ALIGNED_HOUR_UTC = int(os.getenv("BACKUP_ALIGNED_HOUR_UTC", "1"))  # 01:00 UTC = ~22:00 Montevideo
DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")

# Lock file for multi-worker coordination
LOCK_FILE = Path(os.getenv("BACKUP_LOCK_FILE", "/tmp/chorizaurio_backup.lock"))

_scheduler_thread: Optional[threading.Thread] = None
_scheduler_stop_event = threading.Event()
_backup_lock = threading.Lock()


def _try_acquire_file_lock(timeout: float = 10.0) -> Optional[Any]:
    """
    Try to acquire file lock for backup operations.
    Returns file handle if successful, None if failed.
    """
    try:
        import fcntl
        LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
        lock_file = open(LOCK_FILE, 'w')
        
        start_time = time.time()
        while True:
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                return lock_file
            except BlockingIOError:
                if time.time() - start_time > timeout:
                    lock_file.close()
                    return None
                time.sleep(0.5)
    except Exception as e:
        logger.warning(f"Could not acquire file lock: {e}")
        return None


def _release_file_lock(lock_file: Any):
    """Release file lock."""
    if lock_file:
        try:
            import fcntl
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            lock_file.close()
        except Exception:
            pass


def create_backup_now(reason: str = "manual") -> Optional[Dict[str, Any]]:
    """
    Create a backup of the SQLite database using SQLite's online backup API.
    Returns backup info dict or None on failure.
    """
    # Use thread lock as primary synchronization
    if not _backup_lock.acquire(blocking=True, timeout=30.0):
        logger.warning("Backup skipped: could not acquire thread lock")
        return None
    
    # Also try file lock for multi-process coordination
    file_lock = _try_acquire_file_lock(timeout=5.0)
    
    try:
        return _do_backup(reason)
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        return None
    finally:
        _release_file_lock(file_lock)
        _backup_lock.release()


def _do_backup(reason: str) -> Dict[str, Any]:
    """Internal backup logic - must be called with lock held."""
    
    # Ensure backup directory exists
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    
    # Check source database exists
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found: {DB_PATH}")
    
    # Generate backup filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"ventas_{timestamp}.db"
    backup_path = BACKUP_DIR / backup_filename
    
    # Use SQLite's online backup API for consistency
    src_conn = sqlite3.connect(DB_PATH, timeout=30.0)
    dst_conn = sqlite3.connect(str(backup_path))
    
    try:
        src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()
        
        # Verify backup
        verify_conn = sqlite3.connect(str(backup_path))
        cursor = verify_conn.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]
        verify_conn.close()
        
        if integrity != "ok":
            backup_path.unlink(missing_ok=True)
            raise RuntimeError(f"Backup integrity check failed: {integrity}")
        
        # Get backup info
        backup_size = backup_path.stat().st_size
        
        # Calculate checksum
        checksum = _calculate_checksum(backup_path)
        
        backup_info = {
            "filename": backup_filename,
            "path": str(backup_path),
            "size": backup_size,
            "size_human": _format_size(backup_size),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "reason": reason,
            "checksum_md5": checksum,
            "integrity": "ok"
        }
        
        logger.info(f"Backup created: {backup_filename} ({_format_size(backup_size)})")
        
        # Rotate old backups
        _rotate_backups()
        
        return backup_info
        
    except Exception as e:
        # Cleanup failed backup
        if backup_path.exists():
            backup_path.unlink(missing_ok=True)
        raise


def _calculate_checksum(path: Path) -> str:
    """Calculate MD5 checksum of file."""
    hash_md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def _format_size(size_bytes: int) -> str:
    """Format bytes as human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _rotate_backups():
    """Remove old backups, keeping only the last N."""
    try:
        backups = list_backups()
        if len(backups) > BACKUP_RETENTION_COUNT:
            # Sort by created_at descending (newest first)
            backups_sorted = sorted(backups, key=lambda x: x["created_at"], reverse=True)
            
            # Remove oldest backups beyond retention count
            for old_backup in backups_sorted[BACKUP_RETENTION_COUNT:]:
                try:
                    Path(old_backup["path"]).unlink()
                    logger.info(f"Rotated old backup: {old_backup['filename']}")
                except Exception as e:
                    logger.warning(f"Failed to rotate backup {old_backup['filename']}: {e}")
    except Exception as e:
        logger.warning(f"Backup rotation error: {e}")


def list_backups() -> List[Dict[str, Any]]:
    """List all available backups."""
    backups = []
    
    if not BACKUP_DIR.exists():
        return backups
    
    for backup_file in BACKUP_DIR.glob("ventas_*.db"):
        try:
            stat = backup_file.stat()
            backups.append({
                "filename": backup_file.name,
                "path": str(backup_file),
                "size": stat.st_size,
                "size_human": _format_size(stat.st_size),
                "created_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat() + "Z",
            })
        except Exception as e:
            logger.warning(f"Error listing backup {backup_file.name}: {e}")
    
    # Sort by created_at descending (newest first)
    return sorted(backups, key=lambda x: x["created_at"], reverse=True)


def get_backup_path(filename: str) -> Optional[Path]:
    """
    Get full path to a backup file, with path traversal protection.
    Returns None if file doesn't exist or path is invalid.
    """
    # Sanitize filename - only allow expected pattern
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        return None
    
    if not filename.startswith("ventas_") or not filename.endswith(".db"):
        return None
    
    backup_path = BACKUP_DIR / filename
    
    # Ensure resolved path is within backup directory
    try:
        resolved = backup_path.resolve()
        backup_dir_resolved = BACKUP_DIR.resolve()
        if not str(resolved).startswith(str(backup_dir_resolved)):
            return None
    except Exception:
        return None
    
    if not backup_path.exists():
        return None
    
    return backup_path


def _scheduler_loop():
    """Background scheduler loop."""
    logger.info(f"Backup scheduler started: interval={BACKUP_INTERVAL_HOURS}h, retention={BACKUP_RETENTION_COUNT}, aligned_hour_utc={BACKUP_ALIGNED_HOUR_UTC}")
    
    last_backup_time = None
    last_aligned_date = None
    
    while not _scheduler_stop_event.is_set():
        try:
            now = datetime.utcnow()
            
            # Check if we should do an aligned backup (once per day at specified hour)
            if now.hour == BACKUP_ALIGNED_HOUR_UTC:
                today = now.date()
                if last_aligned_date != today:
                    logger.info(f"Triggering aligned backup at {BACKUP_ALIGNED_HOUR_UTC}:00 UTC")
                    result = create_backup_now(reason="aligned_schedule")
                    if result:
                        last_aligned_date = today
                        last_backup_time = now
            
            # Check if we should do a periodic backup
            if last_backup_time is None or (now - last_backup_time) >= timedelta(hours=BACKUP_INTERVAL_HOURS):
                # Skip if we just did an aligned backup
                if last_backup_time is None or (now - last_backup_time) >= timedelta(minutes=30):
                    logger.info(f"Triggering periodic backup (every {BACKUP_INTERVAL_HOURS}h)")
                    result = create_backup_now(reason="periodic")
                    if result:
                        last_backup_time = now
            
        except Exception as e:
            logger.error(f"Backup scheduler error: {e}")
        
        # Sleep for 5 minutes between checks
        _scheduler_stop_event.wait(300)
    
    logger.info("Backup scheduler stopped")


def start_backup_scheduler():
    """Start the background backup scheduler thread."""
    global _scheduler_thread
    
    if _scheduler_thread is not None and _scheduler_thread.is_alive():
        logger.warning("Backup scheduler already running")
        return
    
    _scheduler_stop_event.clear()
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True, name="BackupScheduler")
    _scheduler_thread.start()
    
    # Create initial backup on startup only if no recent backup exists
    # This avoids multiple workers each creating startup backups
    try:
        existing = list_backups()
        if existing:
            # Check if most recent backup is less than 5 minutes old
            from datetime import datetime
            latest_time = datetime.fromisoformat(existing[0]["created_at"].replace("Z", "+00:00"))
            age_seconds = (datetime.now(latest_time.tzinfo) - latest_time).total_seconds()
            if age_seconds < 300:  # 5 minutes
                logger.info(f"Skipping startup backup - recent backup exists ({age_seconds:.0f}s ago)")
                return
        create_backup_now(reason="startup")
    except Exception as e:
        logger.warning(f"Startup backup failed: {e}")


def stop_backup_scheduler():
    """Stop the background backup scheduler."""
    global _scheduler_thread
    
    if _scheduler_thread is None:
        return
    
    _scheduler_stop_event.set()
    _scheduler_thread.join(timeout=10)
    _scheduler_thread = None
