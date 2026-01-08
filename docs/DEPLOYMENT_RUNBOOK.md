# Deployment Runbook - Chorizaurio

## Quick Reference

### URLs
- **Frontend**: https://www.pedidosfriosur.com
- **Backend API**: https://api.pedidosfriosur.com
- **Render Dashboard**: https://dashboard.render.com

### Key Files Locations (in Render)
| Location | Purpose |
|----------|---------|
| `/data/ventas.db` | Production SQLite database |
| `/data/backups/` | Automated backup storage |
| `/data/uploads/` | User uploaded images |
| `/etc/secrets/ventas.db.gz.b64` | Seed database (read-only, used only if DB missing) |

---

## Environment Variables (Render)

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `your-secure-random-string-here` |
| `ADMIN_PASSWORD` | Initial admin password | `secure-admin-password` |
| `ENVIRONMENT` | Current environment | `production` |
| `CORS_ORIGINS` | Allowed origins (comma-sep) | `https://www.pedidosfriosur.com,https://pedidosfriosur.com` |

### Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `BACKUP_ENABLED` | Enable auto backups | `true` |
| `BACKUP_INTERVAL_HOURS` | Backup frequency | `6` |
| `BACKUP_RETAIN_COUNT` | Backups to keep | `10` |
| `BACKUP_TIME_HOUR` | Hour for PC-aligned backup | `22` |
| `BACKUP_TIMEZONE` | Timezone for aligned backup | `America/Montevideo` |

---

## Backup System

### How Backups Work
1. **Scheduler**: APScheduler runs in-process, creating backups periodically
2. **Location**: Backups stored in `/data/backups/ventas_YYYYMMDD_HHMMSS.db`
3. **Rotation**: Oldest backups auto-deleted when exceeding `BACKUP_RETAIN_COUNT`
4. **PC Pull**: Windows script downloads latest backup via admin API

### Manual Backup via API
```bash
# Create backup now
curl -X POST "https://api.pedidosfriosur.com/api/admin/backup-now" \
  -H "Authorization: Bearer $TOKEN"

# List backups
curl "https://api.pedidosfriosur.com/api/admin/backups" \
  -H "Authorization: Bearer $TOKEN"

# Download specific backup
curl -o ventas_backup.db "https://api.pedidosfriosur.com/api/admin/backups/ventas_20260106_220000.db" \
  -H "Authorization: Bearer $TOKEN"
```

### Windows PC Backup Pull
1. Edit `scripts/backup_pull.ps1` with credentials
2. Schedule via Task Scheduler at 22:00 daily
3. Backups stored in `%USERPROFILE%\Documents\ChorizaurioBackups`

---

## Migration System

### How Migrations Work
1. Each migration has a unique ID (e.g., `001_ensure_activo_default`)
2. On startup, only migrations NOT in `migration_log` table run
3. After successful execution, migration ID recorded with timestamp
4. Migrations never run twice (safe restarts)

### Check Migration Status
```bash
curl "https://api.pedidosfriosur.com/api/admin/migrations" \
  -H "Authorization: Bearer $TOKEN"
```

### Run Pending Migrations Manually
```bash
curl -X POST "https://api.pedidosfriosur.com/api/admin/migrations/run" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Restore Procedures

### Restore from Backup (Render Console)

1. **SSH into Render service** (via Render dashboard Shell tab)

2. **Stop write traffic** (optional, prevents conflicts)

3. **Copy backup over current DB**:
   ```bash
   # List available backups
   ls -la /data/backups/
   
   # Create safety backup of current state
   cp /data/ventas.db /data/ventas.db.before_restore
   
   # Restore from backup
   cp /data/backups/ventas_20260106_220000.db /data/ventas.db
   ```

4. **Restart service** (Render dashboard → Manual Deploy)

### Restore from Local Backup

1. Upload backup to Render persistent disk:
   ```bash
   # On Render shell
   curl -o /data/ventas.db "https://your-temp-url/backup.db"
   ```

2. Or use the admin API (if accessible):
   - Future feature: upload endpoint (not yet implemented)

---

## Troubleshooting

### Database Locked Errors
SQLite is configured with:
- WAL mode (better concurrency)
- busy_timeout=30000ms (waits 30s instead of failing)
- Foreign keys enabled

If still getting locks:
1. Check for long-running queries
2. Reduce concurrent workers in gunicorn
3. Consider read replicas for reports (future)

### Backup Scheduler Not Running
1. Check logs for APScheduler startup
2. Verify `BACKUP_ENABLED=true`
3. Check `GET /api/admin/backup-status` for scheduler state

### Migration Stuck
1. Check `GET /api/admin/migrations` for status
2. Manual SQL to mark as complete:
   ```sql
   INSERT INTO migration_log (migration_id, applied_at) VALUES ('xxx', datetime('now'));
   ```

### User Locked Out
1. Check via API: `GET /api/usuarios` (as admin)
2. Reactivate: `PUT /api/usuarios/{id}` with `{"activo": true}`

---

## Deployment Checklist

### Before Deploying
- [ ] Run tests locally: `pytest backend/tests/`
- [ ] Check for env var changes
- [ ] Review migration list (new migrations?)
- [ ] Ensure backup exists before destructive changes

### During Deployment
- [ ] Monitor Render deploy logs
- [ ] Check for migration execution messages
- [ ] Verify backup scheduler started

### After Deployment
- [ ] Verify login works: https://www.pedidosfriosur.com
- [ ] Check admin endpoints respond
- [ ] Verify recent data intact
- [ ] Test one complete order flow

---

## Emergency Contacts

### Render Support
- Dashboard: https://dashboard.render.com
- Status: https://status.render.com

### Quick Rollback
1. Render dashboard → Deploys tab
2. Find last working deploy
3. Click "Rollback to this deploy"

---

## Monitoring (Future)

Current setup has minimal monitoring. Recommended additions:
1. Uptime monitoring (e.g., UptimeRobot for API health)
2. Error tracking (e.g., Sentry)
3. Backup verification cron
