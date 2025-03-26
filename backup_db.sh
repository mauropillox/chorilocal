
#!/bin/bash

# Variables
DB_PATH="/home/ec2-user/chorizaurio/backend/ventas.db"
BACKUP_DIR="/home/ec2-user/chorizaurio/backups"
DATE=$(date +\%Y-\%m-\%d_\%H-\%M-\%S)
BACKUP_FILE="$BACKUP_DIR/ventas_$DATE.db"

# Crear carpeta si no existe
mkdir -p "$BACKUP_DIR"

# Hacer copia
cp "$DB_PATH" "$BACKUP_FILE"

# Opcional: borrar backups de más de 7 días
find "$BACKUP_DIR" -type f -name "*.db" -mtime +7 -exec rm {} \;

echo "✅ Backup creado en $BACKUP_FILE"