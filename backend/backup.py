import shutil
import datetime

# Ruta a la base de datos
DB_ORIGINAL = "/data/ventas.db"
fecha = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
DB_BACKUP = f"/data/backups/ventas_{fecha}.db"

# Crear carpeta si no existe
import os
os.makedirs("/data/backups", exist_ok=True)

# Copiar la base
shutil.copy2(DB_ORIGINAL, DB_BACKUP)
print(f"✅ Backup creado en {DB_BACKUP}")
