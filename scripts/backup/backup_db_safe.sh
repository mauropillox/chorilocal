#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups

TS=$(date +%Y-%m-%d_%H-%M-%S)
OUT="backups/ventas_${TS}.db"

# Backupea desde adentro del container usando sqlite3.backup()
# El backup se guarda en /backups/ que está mapeado al host
docker compose exec -T backend python - <<PY
import os, sqlite3
src = os.getenv("DB_PATH", "/data/ventas.db")
dst = "/backups/ventas_${TS}.db"
con = sqlite3.connect(src)
bck = sqlite3.connect(dst)
con.backup(bck)
bck.close(); con.close()
print(f"Backup guardado: {dst}")
PY

# opcional: borrar backups viejos (7 días)
find backups -type f -name "*.db" -mtime +7 -delete

echo "✅ Backup OK: $OUT"
