#!/usr/bin/env bash
# Automated database backup script for cron
# Runs inside the backend container via docker exec
# Usage: Add to crontab: 0 */6 * * * /path/to/backup_cron.sh >> /var/log/chorizaurio_backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
RETENTION_DAYS=30

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ventas_${TS}.db"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
COMPRESSED_PATH="${BACKUP_PATH}.gz"

echo "[$(date)] Starting backup..."

# Use SQLite's online backup API for consistency
docker exec chorizaurio-backend python3 -c "
import sqlite3
import os
import sys

src_path = os.getenv('DB_PATH', '/data/ventas.db')
dst_path = '/backups/${BACKUP_FILE}'

try:
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dst_path)
    src.backup(dst)
    dst.close()
    src.close()
    print(f'Backup created: {dst_path}')
except Exception as e:
    print(f'Backup failed: {e}', file=sys.stderr)
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    # Verify backup exists and has content
    if [ -f "$BACKUP_PATH" ] && [ -s "$BACKUP_PATH" ]; then
        ORIGINAL_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
        echo "[$(date)] ✅ Backup successful: $BACKUP_FILE ($ORIGINAL_SIZE)"
        
        # Compress backup for storage efficiency
        gzip -f "$BACKUP_PATH"
        if [ -f "$COMPRESSED_PATH" ]; then
            COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
            echo "[$(date)] 📦 Compressed: ${BACKUP_FILE}.gz ($COMPRESSED_SIZE)"
        fi
        
        # Cleanup old backups (both compressed and uncompressed)
        DELETED=$(find "$BACKUP_DIR" -name "ventas_*.db*" -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l)
        if [ "$DELETED" -gt 0 ]; then
            echo "[$(date)] 🗑️  Cleaned up $DELETED old backups (>${RETENTION_DAYS} days)"
        fi
        
        # Report remaining backups
        BACKUP_COUNT=$(find "$BACKUP_DIR" -name "ventas_*.db*" -type f | wc -l)
        echo "[$(date)] 📊 Total backups in retention: $BACKUP_COUNT"
    else
        echo "[$(date)] ❌ Backup file not created or empty"
        exit 1
    fi
else
    echo "[$(date)] ❌ Backup command failed"
    exit 1
fi
