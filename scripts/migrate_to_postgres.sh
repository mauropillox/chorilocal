#!/bin/bash
# Script de migración a PostgreSQL para producción
# Ejecutar una sola vez al migrar de SQLite a PostgreSQL

set -e

echo "🚀 Migración a PostgreSQL - Chorizaurio"
echo "=========================================="

# Verificar variables de entorno
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no está configurada"
    echo "   Ejemplo: export DATABASE_URL='postgresql://user:pass@host:5432/chorizaurio_db'"
    exit 1
fi

# Verificar que la base SQLite existe
SQLITE_PATH="${SQLITE_DB_PATH:-./data/ventas.db}"
if [ ! -f "$SQLITE_PATH" ]; then
    echo "❌ ERROR: Base de datos SQLite no encontrada en $SQLITE_PATH"
    exit 1
fi

echo "📊 Base SQLite: $SQLITE_PATH"
echo "📊 PostgreSQL: $DATABASE_URL"

# Verificar conexión a PostgreSQL
echo ""
echo "🔍 Verificando conexión a PostgreSQL..."
python3 -c "
import psycopg2
import os
conn = psycopg2.connect(os.environ['DATABASE_URL'])
conn.close()
print('✅ Conexión a PostgreSQL OK')
"

# Ejecutar migración
echo ""
echo "📦 Ejecutando migración..."
cd backend && SQLITE_DB_PATH=$SQLITE_PATH python migrate_simple.py

echo ""
echo "✅ Migración completada exitosamente!"
echo ""
echo "🔧 Próximos pasos:"
echo "   1. Configurar USE_POSTGRES=true en las variables de entorno"
echo "   2. Configurar DATABASE_URL en las variables de entorno"  
echo "   3. Reiniciar el servicio backend"
echo "   4. Verificar que la aplicación funciona correctamente"
