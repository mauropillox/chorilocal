#!/bin/bash
set -euo pipefail

# === Download Production DB from Render ===
# Descarga los datos de producción via API y los importa a la DB local

API="https://api.pedidosfriosur.com"
USERNAME="${PROD_USER:-admin}"
PASSWORD="${PROD_PASS:-admin420}"
BACKUP_DIR="backups/prod_data"
LOCAL_DB="data/ventas.db"

ts() { date +"%H:%M:%S"; }
log() { echo "[$(ts)] $*"; }

log "=== DESCARGA DE DATOS DE PRODUCCIÓN ==="

# 1. Obtener token
log "1. Autenticando en producción..."
TOKEN=$(curl -s -X POST "$API/login" -d "username=$USERNAME&password=$PASSWORD" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ]; then
    log "❌ Error: No se pudo autenticar. Verifica credenciales."
    log "   Puedes usar: PROD_USER=xxx PROD_PASS=yyy ./download_prod_db.sh"
    exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
log "   ✅ Token obtenido"

# 2. Crear directorio de backup
mkdir -p "$BACKUP_DIR"

# 3. Descargar datos
log "2. Descargando datos..."

log "   - Clientes..."
curl -s -H "$AUTH" "$API/clientes" > "$BACKUP_DIR/clientes.json"
CLIENTES=$(cat "$BACKUP_DIR/clientes.json" | jq 'if type == "array" then length else .data | length end')
log "     $CLIENTES clientes"

log "   - Productos..."
curl -s -H "$AUTH" "$API/productos" > "$BACKUP_DIR/productos.json"
PRODUCTOS=$(cat "$BACKUP_DIR/productos.json" | jq 'length')
log "     $PRODUCTOS productos"

log "   - Pedidos..."
curl -s -H "$AUTH" "$API/pedidos" > "$BACKUP_DIR/pedidos.json"
PEDIDOS=$(cat "$BACKUP_DIR/pedidos.json" | jq 'length')
log "     $PEDIDOS pedidos"

log "   - Ofertas..."
curl -s -H "$AUTH" "$API/ofertas" > "$BACKUP_DIR/ofertas.json"
OFERTAS=$(cat "$BACKUP_DIR/ofertas.json" | jq 'length')
log "     $OFERTAS ofertas"

log "   - Listas de precios..."
curl -s -H "$AUTH" "$API/listas-precios" > "$BACKUP_DIR/listas_precios.json"
LISTAS=$(cat "$BACKUP_DIR/listas_precios.json" | jq 'length')
log "     $LISTAS listas"

log "   - Templates..."
curl -s -H "$AUTH" "$API/templates" > "$BACKUP_DIR/templates.json"
TEMPLATES=$(cat "$BACKUP_DIR/templates.json" | jq 'length')
log "     $TEMPLATES templates"

log "   - Usuarios..."
curl -s -H "$AUTH" "$API/admin/usuarios" > "$BACKUP_DIR/usuarios.json" 2>/dev/null || echo "[]" > "$BACKUP_DIR/usuarios.json"
USUARIOS=$(cat "$BACKUP_DIR/usuarios.json" | jq 'length')
log "     $USUARIOS usuarios"

# 4. Resumen
log ""
log "=== RESUMEN ==="
log "📊 Datos de producción descargados:"
log "   - Clientes:  $CLIENTES"
log "   - Productos: $PRODUCTOS"
log "   - Pedidos:   $PEDIDOS"
log "   - Ofertas:   $OFERTAS"
log "   - Listas:    $LISTAS"
log "   - Templates: $TEMPLATES"
log "   - Usuarios:  $USUARIOS"
log ""
log "📁 Archivos en: $BACKUP_DIR/"
ls -lh "$BACKUP_DIR/"
log ""
log "✅ Descarga completada!"
log ""
log "Para importar a la DB local, ejecuta:"
log "   ./import_prod_data.sh"
