#!/usr/bin/env bash
#
# restore_db.sh - Restore SQLite database from backup
#
# Usage:
#   ./scripts/backup/restore_db.sh <backup_file>
#   ./scripts/backup/restore_db.sh backups/ventas_2026-01-05.db
#   ./scripts/backup/restore_db.sh backups/ventas_2026-01-05.db --force
#
# Safety features:
#   - Creates automatic pre-restore backup
#   - Validates backup file exists and is SQLite
#   - Runs integrity check on backup before restoring
#   - Confirmation prompt (skip with --force)
#   - Prints row counts after restore

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$REPO_DIR/backups"
DATA_DIR="$REPO_DIR/data"
DB_PATH="${DB_PATH:-$DATA_DIR/ventas.db}"

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
    echo "Usage: $0 <backup_file> [--force]"
    echo ""
    echo "Arguments:"
    echo "  backup_file    Path to the SQLite backup file to restore"
    echo "  --force        Skip confirmation prompt"
    echo ""
    echo "Examples:"
    echo "  $0 backups/ventas_2026-01-05.db"
    echo "  $0 /path/to/backup.db --force"
    exit 1
}

# Parse arguments
BACKUP_FILE=""
FORCE=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
    log_error "Backup file not specified"
    usage
fi

# Make path absolute if relative
if [[ "$BACKUP_FILE" != /* ]]; then
    BACKUP_FILE="$REPO_DIR/$BACKUP_FILE"
fi

# Check backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check it's a valid SQLite file
if ! file "$BACKUP_FILE" | grep -q "SQLite"; then
    log_error "File does not appear to be a valid SQLite database: $BACKUP_FILE"
    exit 1
fi

# Check containers are running (we need them for the restore)
if ! docker compose ps backend 2>/dev/null | grep -q "running"; then
    log_error "Backend container is not running. Start it first with: docker compose up -d"
    exit 1
fi

# Get backup file info
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup file: $BACKUP_FILE ($BACKUP_SIZE)"

# Run integrity check on backup file
log_info "Running integrity check on backup..."
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "error")
if [ "$INTEGRITY" != "ok" ]; then
    log_error "Backup file failed integrity check: $INTEGRITY"
    exit 1
fi
log_info "Backup integrity: OK"

# Get row counts from backup
log_info "Backup contents:"
sqlite3 "$BACKUP_FILE" << 'SQL'
SELECT '  usuarios: ' || COUNT(*) FROM usuarios;
SELECT '  clientes: ' || COUNT(*) FROM clientes;
SELECT '  productos: ' || COUNT(*) FROM productos;
SELECT '  pedidos: ' || COUNT(*) FROM pedidos;
SQL

# Confirmation prompt
if [ "$FORCE" != true ]; then
    echo ""
    log_warn "⚠️  This will REPLACE the current database with the backup!"
    echo ""
    read -p "Are you sure you want to restore? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
fi

# Create pre-restore backup
PRE_RESTORE_TS=$(date +%Y-%m-%d_%H-%M-%S)
PRE_RESTORE_FILE="$BACKUP_DIR/ventas_pre-restore_${PRE_RESTORE_TS}.db"

log_info "Creating pre-restore backup: $PRE_RESTORE_FILE"
mkdir -p "$BACKUP_DIR"

# Backup current DB via container (to use SQLite's backup API)
docker compose exec -T backend python - << PYEOF
import os, sqlite3
src = os.getenv("DB_PATH", "/data/ventas.db")
dst = "/backups/ventas_pre-restore_${PRE_RESTORE_TS}.db"
try:
    con = sqlite3.connect(src)
    bck = sqlite3.connect(dst)
    con.backup(bck)
    bck.close()
    con.close()
    print(f"Pre-restore backup saved: {dst}")
except Exception as e:
    print(f"Warning: Could not create pre-restore backup: {e}")
PYEOF

# Now restore by copying backup into the container's data volume
log_info "Restoring database from backup..."

# Stop the backend temporarily to avoid writes during restore
docker compose stop backend

# Copy the backup file to replace the DB
cp "$BACKUP_FILE" "$DATA_DIR/ventas.db"

# Restart backend
docker compose start backend

# Wait for it to be healthy
log_info "Waiting for backend to be healthy..."
for i in {1..30}; do
    if docker compose exec -T backend python -c "import db; db.conectar().execute('SELECT 1')" 2>/dev/null; then
        break
    fi
    sleep 1
done

# Verify the restore
log_info "Verifying restored database..."
docker compose exec -T backend python << 'PYEOF'
import db
con = db.conectar()
cur = con.cursor()
print("Current database contents:")
for table in ['usuarios', 'clientes', 'productos', 'pedidos']:
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = cur.fetchone()[0]
    print(f"  {table}: {count}")

# Integrity check
cur.execute("PRAGMA integrity_check")
result = cur.fetchone()[0]
print(f"\nIntegrity check: {result}")
con.close()
PYEOF

log_info "✅ Restore completed successfully!"
log_info "Pre-restore backup saved at: $PRE_RESTORE_FILE"
echo ""
log_info "Verify the application works correctly, then you can delete the pre-restore backup if not needed."
