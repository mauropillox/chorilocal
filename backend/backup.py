import os
import shutil
import datetime
import sys

# Rutas
BASE_DIR = "/data"
DB_ORIGINAL = os.path.join(BASE_DIR, "ventas.db")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")
fecha = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
DB_BACKUP = os.path.join(BACKUP_DIR, f"ventas_{fecha}.db")

# Crear carpeta de backup si no existe
os.makedirs(BACKUP_DIR, exist_ok=True)

# Verificar que exista la base original
if not os.path.exists(DB_ORIGINAL):
    print(f"❌ ERROR: No se encontró la base de datos en {DB_ORIGINAL}", file=sys.stderr)
    sys.exit(1)

# Copiar la base
try:
    shutil.copy2(DB_ORIGINAL, DB_BACKUP)
    print(f"✅ Backup creado en {DB_BACKUP}")
except Exception as e:
    print(f"❌ ERROR al copiar: {e}", file=sys.stderr)
    sys.exit(2)
