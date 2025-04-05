#!/bin/bash

# Configuración
RENDER_USUARIO="srv-cvo4ljqdbo4c73e1l0r0"
RENDER_HOST="ssh.oregon.render.com"
ARCHIVO_LOCAL="$1"
ARCHIVO_REMOTO="/data/ventas.db"

# Validación
if [ -z "$ARCHIVO_LOCAL" ]; then
  echo "❌ Tenés que especificar el archivo local a subir."
  echo "👉 Ejemplo: ./subir_backup.sh backups/ventas_20240405_1432.db"
  exit 1
fi

if [ ! -f "$ARCHIVO_LOCAL" ]; then
  echo "❌ El archivo '$ARCHIVO_LOCAL' no existe."
  exit 1
fi

echo "🔼 Subiendo '$ARCHIVO_LOCAL' a Render..."
scp "$ARCHIVO_LOCAL" ${RENDER_USUARIO}@${RENDER_HOST}:${ARCHIVO_REMOTO}

if [ $? -eq 0 ]; then
  echo "✅ Backup restaurado exitosamente en Render (/data/ventas.db)"
else
  echo "❌ Error al subir el backup"
fi
