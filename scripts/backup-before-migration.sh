#!/bin/bash
# Script para hacer backup de DB antes de migrar a persistent disk

set -e

echo "🔐 Database Backup Script"
echo "=========================="
echo ""

# Verificar que las variables estén configuradas
if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: BACKEND_URL no está configurada"
    echo "Ejecuta: export BACKEND_URL=https://tu-backend.onrender.com"
    exit 1
fi

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Error: ADMIN_TOKEN no está configurada"
    echo "Ejecuta: export ADMIN_TOKEN=tu_token_jwt_aqui"
    exit 1
fi

echo "📍 Backend URL: $BACKEND_URL"
echo ""

# Crear directorio para backups
mkdir -p backups-migration
cd backups-migration

echo "📦 Paso 1: Creando backup en servidor..."
BACKUP_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BACKEND_URL/api/admin/backup-now")

echo "Response: $BACKUP_RESPONSE"

# Extraer filename del response JSON
BACKUP_FILENAME=$(echo $BACKUP_RESPONSE | grep -o '"filename":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BACKUP_FILENAME" ]; then
    echo "❌ Error: No se pudo crear backup"
    echo "Response completo: $BACKUP_RESPONSE"
    exit 1
fi

echo "✅ Backup creado: $BACKUP_FILENAME"
echo ""

echo "⬇️ Paso 2: Descargando backup..."
curl -L -H "Authorization: Bearer $ADMIN_TOKEN" \
     -o "$BACKUP_FILENAME" \
     "$BACKEND_URL/api/admin/backups/$BACKUP_FILENAME"

# Verificar que el archivo existe y tiene contenido
if [ -f "$BACKUP_FILENAME" ] && [ -s "$BACKUP_FILENAME" ]; then
    FILE_SIZE=$(ls -lh "$BACKUP_FILENAME" | awk '{print $5}')
    echo "✅ Backup descargado exitosamente"
    echo "📊 Tamaño: $FILE_SIZE"
    echo "📁 Ubicación: $(pwd)/$BACKUP_FILENAME"
    echo ""
    echo "🎉 BACKUP COMPLETO - Ahora puedes migrar a persistent disk de forma segura"
else
    echo "❌ Error: Backup falló o está vacío"
    exit 1
fi
