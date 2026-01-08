#!/bin/bash
set -euo pipefail

# === CHORIZAURIO DEPLOYMENT SCRIPT ===
# Backup, build, deploy, and verify
# 
# Uso:
#   ./deploy.sh                    # Deploy normal (con git pull)
#   SKIP_PULL=1 ./deploy.sh        # Deploy sin git pull
#   AUTO_COMMIT=1 ./deploy.sh      # Deploy con auto-commit (NO recomendado)

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$REPO_DIR/backups"
LOG_FILE="$REPO_DIR/logs/deploy_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "$REPO_DIR/logs"

ts() { date +"%H:%M:%S"; }
log() { echo "[$(ts)] $*" | tee -a "$LOG_FILE"; }

log "=== CHORIZAURIO DEPLOYMENT ==="
cd "$REPO_DIR"


# 0. Check for uncommitted changes (warn but don't auto-commit by default)
log "0. Checking git status..."
if ! git diff --quiet || ! git diff --cached --quiet; then
    if [[ "${AUTO_COMMIT:-}" == "1" ]]; then
        log "   ⚠️ AUTO_COMMIT enabled - committing changes..."
        git add .
        # Ensure sensitive files are NOT staged
        git reset --quiet -- .env frontend/.env data/ backups/ logs/ *.log 2>/dev/null || true
        git commit -m "Auto-commit by deploy.sh on $(date +%Y-%m-%d_%H-%M-%S)" || log "   Nothing to commit"
        git push || { log "   ❌ git push failed"; exit 1; }
    else
        log "   ⚠️ Uncommitted changes detected!"
        log "   💡 Commit your changes manually before deploying, or use AUTO_COMMIT=1"
        git status --short
    fi
else
    log "   ✓ Working directory clean"
fi

# Ensure we're on main for deployment
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log "   ⚠️ Not on main branch (currently on $CURRENT_BRANCH)"
    log "   💡 Consider merging to main before production deploy"
fi

# 1. Git pull (opcional)
if [[ "${SKIP_PULL:-}" != "1" ]]; then
    log "1. Pulling latest changes from GitHub..."
    git pull || log "   ⚠️ git pull failed (continuing anyway)"
else
    log "1. Skipping git pull (SKIP_PULL=1)"
fi

# 2. Validar archivos de configuración
log "2. Validating configuration files..."
if [ ! -f .env ]; then
    log "   ❌ Missing .env file"
    exit 1
fi
if [ ! -f frontend/.env ]; then
    log "   ❌ Missing frontend/.env file"
    exit 1
fi
log "   ✓ Configuration files OK"

# 3. Backup database
log "3. Backing up database..."
mkdir -p "$BACKUP_DIR"
if docker compose ps backend --format json 2>/dev/null | grep -q running; then
    docker compose exec -T backend cp /data/ventas.db /tmp/ventas.db.bak 2>/dev/null || true
    docker cp chorizaurio-backend:/tmp/ventas.db.bak "$BACKUP_DIR/ventas.db.$(date +%Y%m%d_%H%M%S).bak" 2>/dev/null && \
        log "   ✓ Database backed up" || log "   ⚠️ DB backup skipped"
else
    if [ -f data/ventas.db ]; then
        cp data/ventas.db "$BACKUP_DIR/ventas.db.$(date +%Y%m%d_%H%M%S).bak"
        log "   ✓ Local database backed up"
    else
        log "   ⚠️ No database to backup"
    fi
fi

# 4. Stop existing containers
log "4. Stopping existing containers..."
docker compose down || true

# 5. Build and deploy
log "5. Building and starting containers..."
docker compose build 2>&1 | tee -a "$LOG_FILE"
docker compose up -d

# 6. Wait for services
log "6. Waiting for services to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        log "   ✓ Services ready"
        break
    fi
    if [ $i -eq 30 ]; then
        log "   ❌ Services failed to start"
        docker compose logs --tail=50
        exit 1
    fi
    sleep 1
done

# 7. Health check
log "7. Running health check..."
HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null || echo '{"status":"error"}')
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    log "   ✓ Health check passed: $HEALTH"
else
    log "   ❌ Health check failed: $HEALTH"
    exit 1
fi

# 8. Summary
log "=== DEPLOYMENT COMPLETE ==="
log "📋 Logs: $LOG_FILE"
log "💾 Backups: $BACKUP_DIR"
log "🌐 Frontend: http://localhost"
log "🔧 Backend API: http://localhost:8000"
log "📚 API Docs: http://localhost:8000/docs"
log ""
log "✅ Deploy successful!"
