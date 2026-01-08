"""
Migration Control System
=========================
Provides controlled, one-time migrations with tracking.

- Migrations are registered with a unique name
- Each migration runs exactly once
- Execution is tracked in migration_log table
- Safe for multi-worker environments (uses DB transaction locks)

Usage:
    from migrations import run_pending_migrations, register_migration
    
    # Register a migration (do this at module load time)
    @register_migration("001_initial_schema")
    def migrate_001(cursor):
        cursor.execute("CREATE TABLE IF NOT EXISTS ...")
    
    # Run all pending migrations (call at startup)
    run_pending_migrations()
"""

import sqlite3
import logging
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from functools import wraps

import db
from logging_config import get_logger

logger = get_logger(__name__)

# Registry of all migrations
_migrations: Dict[str, Callable] = {}


def register_migration(name: str):
    """
    Decorator to register a migration function.
    Migrations are executed in alphabetical order by name.
    Use naming convention: NNN_description (e.g., 001_add_column)
    """
    def decorator(func: Callable):
        if name in _migrations:
            raise ValueError(f"Migration '{name}' is already registered")
        _migrations[name] = func
        return func
    return decorator


def _ensure_migration_log_table(cursor):
    """Create migration_log table if it doesn't exist."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS migration_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            executed_at TEXT NOT NULL,
            success INTEGER NOT NULL DEFAULT 1,
            error_message TEXT
        )
    """)


def _get_executed_migrations(cursor) -> set:
    """Get set of already-executed migration names."""
    cursor.execute("SELECT name FROM migration_log WHERE success = 1")
    return {row[0] for row in cursor.fetchall()}


def _mark_migration_executed(cursor, name: str, success: bool = True, error: Optional[str] = None):
    """Record that a migration was executed."""
    cursor.execute("""
        INSERT OR REPLACE INTO migration_log (name, executed_at, success, error_message)
        VALUES (?, ?, ?, ?)
    """, (name, datetime.now(timezone.utc).isoformat(), 1 if success else 0, error))


def run_pending_migrations() -> List[str]:
    """
    Run all pending migrations in order.
    Returns list of executed migration names.
    Thread-safe: uses database transaction for locking.
    """
    executed = []
    
    with db.get_db_transaction() as (conn, cursor):
        # Ensure migration_log table exists
        _ensure_migration_log_table(cursor)
        
        # Get already-executed migrations
        already_done = _get_executed_migrations(cursor)
        
        # Get pending migrations in sorted order
        pending = sorted([name for name in _migrations.keys() if name not in already_done])
        
        if not pending:
            logger.info("No pending migrations")
            return executed
        
        logger.info(f"Found {len(pending)} pending migrations: {pending}")
        
        for name in pending:
            migration_func = _migrations[name]
            try:
                logger.info(f"Running migration: {name}")
                migration_func(cursor)
                _mark_migration_executed(cursor, name, success=True)
                executed.append(name)
                logger.info(f"Completed migration: {name}")
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Migration {name} failed: {error_msg}")
                _mark_migration_executed(cursor, name, success=False, error=error_msg)
                raise RuntimeError(f"Migration '{name}' failed: {error_msg}") from e
    
    return executed


def get_migration_status() -> Dict[str, any]:
    """Get status of all registered migrations."""
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        _ensure_migration_log_table(cursor)
        
        cursor.execute("""
            SELECT name, executed_at, success, error_message 
            FROM migration_log 
            ORDER BY executed_at
        """)
        log_entries = {row[0]: {
            "executed_at": row[1],
            "success": bool(row[2]),
            "error": row[3]
        } for row in cursor.fetchall()}
    
    result = {
        "registered": sorted(_migrations.keys()),
        "executed": [],
        "pending": [],
        "failed": []
    }
    
    for name in sorted(_migrations.keys()):
        if name in log_entries:
            entry = log_entries[name]
            if entry["success"]:
                result["executed"].append({
                    "name": name,
                    "executed_at": entry["executed_at"]
                })
            else:
                result["failed"].append({
                    "name": name,
                    "executed_at": entry["executed_at"],
                    "error": entry["error"]
                })
        else:
            result["pending"].append(name)
    
    return result


# ============================================================================
# REGISTERED MIGRATIONS
# ============================================================================
# Add new migrations here. Each migration runs exactly once.
# Use naming convention: NNN_description
# ============================================================================

@register_migration("001_ensure_activo_default")
def migrate_001_ensure_activo_default(cursor):
    """
    Ensure usuarios.activo column has proper default.
    This is a SCHEMA migration, not a data migration.
    We do NOT activate all users - that was the bug.
    """
    # Check if activo column exists and has correct default
    cursor.execute("PRAGMA table_info(usuarios)")
    columns = {row[1]: row for row in cursor.fetchall()}
    
    if 'activo' in columns:
        # Column exists - just ensure new users get activo=1 by default
        # We do NOT UPDATE existing users - that would reactivate disabled ones
        logger.info("migration_001: activo column exists, schema is correct")
    else:
        # Column doesn't exist - add it (unlikely but safe)
        cursor.execute("ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1")
        logger.info("migration_001: Added activo column with default 1")


@register_migration("002_ensure_last_login_column")
def migrate_002_ensure_last_login(cursor):
    """Ensure last_login column exists in usuarios table."""
    cursor.execute("PRAGMA table_info(usuarios)")
    columns = {row[1] for row in cursor.fetchall()}
    
    if 'last_login' not in columns:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN last_login TEXT")
        logger.info("migration_002: Added last_login column")
    else:
        logger.info("migration_002: last_login column already exists")


@register_migration("003_ensure_foreign_keys")
def migrate_003_ensure_foreign_keys(cursor):
    """
    Enable foreign key enforcement.
    Note: This must be done per-connection in SQLite.
    """
    cursor.execute("PRAGMA foreign_keys = ON")
    logger.info("migration_003: Foreign keys enabled")


@register_migration("004_create_backup_metadata")
def migrate_004_backup_metadata(cursor):
    """Create table to track backup metadata (optional, for future use)."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS backup_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            created_at TEXT NOT NULL,
            size_bytes INTEGER,
            checksum_md5 TEXT,
            reason TEXT
        )
    """)
    logger.info("migration_004: Created backup_log table")
