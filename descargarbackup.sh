#!/bin/bash

# Configuración
RENDER_USUARIO="srv-cvo4ljqdbo4c73e1l0r0"
RENDER_HOST="ssh.oregon.render.com"
ARCHIVO_REMOTO="/data/ventas.db"
ARCHIVO_LOCAL="./backups/ventas_$(date +%Y%m%d_%H%M%S).db"

# Crear carpeta de backups si no existe
mkdir -p backups

echo "🔄 Descargando backup desde Render..."
scp ${RENDER_USUARIO}@${RENDER_HOST}:${ARCHIVO_REMOTO} ${ARCHIVO_LOCAL}

if [ $? -eq 0 ]; then
  echo "✅ Backup guardado en: ${ARCHIVO_LOCAL}"
else
  echo "❌ Error al descargar el backup"
fi
