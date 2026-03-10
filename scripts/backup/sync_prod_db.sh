#!/bin/bash
set -euo pipefail

# === Sync Production Database ===
# Descarga los datos de producción y los importa a la DB local
# Uso: ./sync_prod_db.sh

API="https://api.pedidosfriosur.com"
USERNAME="${PROD_USER:-admin}"
PASSWORD="${PROD_PASS:?ERROR: PROD_PASS environment variable is required. Usage: PROD_PASS=xxx ./sync_prod_db.sh}"
BACKUP_DIR="backups/prod_data"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ts() { date +"%H:%M:%S"; }
log() { echo "[$(ts)] $*"; }

log "=============================================="
log "🔄 SYNC PRODUCCIÓN → LOCAL"
log "=============================================="

# 1. Autenticar
log ""
log "1️⃣  Autenticando en producción..."
TOKEN=$(curl -s -X POST "$API/login" -d "username=$USERNAME&password=$PASSWORD" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ]; then
    log "❌ Error: No se pudo autenticar."
    log "   Credenciales: $USERNAME / ****"
    log "   Puedes usar: PROD_USER=xxx PROD_PASS=yyy ./sync_prod_db.sh"
    exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
log "   ✅ Autenticado como $USERNAME"

# 2. Descargar datos
log ""
log "2️⃣  Descargando datos de producción..."
mkdir -p "$BACKUP_DIR"

log "   📥 Clientes..."
curl -s -H "$AUTH" "$API/clientes" > "$BACKUP_DIR/clientes.json"
CLIENTES=$(cat "$BACKUP_DIR/clientes.json" | jq 'if type == "array" then length else .data | length end')

log "   📥 Productos..."
curl -s -H "$AUTH" "$API/productos" > "$BACKUP_DIR/productos.json"
PRODUCTOS=$(cat "$BACKUP_DIR/productos.json" | jq 'length')

log "   📥 Pedidos..."
curl -s -H "$AUTH" "$API/pedidos" > "$BACKUP_DIR/pedidos.json"
PEDIDOS=$(cat "$BACKUP_DIR/pedidos.json" | jq 'length')

log "   ✅ Descargados: $CLIENTES clientes, $PRODUCTOS productos, $PEDIDOS pedidos"

# 3. Copiar al container
log ""
log "3️⃣  Copiando datos al container..."
docker exec chorizaurio-backend mkdir -p /app/backups/prod_data
docker cp "$BACKUP_DIR/clientes.json" chorizaurio-backend:/app/backups/prod_data/
docker cp "$BACKUP_DIR/productos.json" chorizaurio-backend:/app/backups/prod_data/
docker cp "$BACKUP_DIR/pedidos.json" chorizaurio-backend:/app/backups/prod_data/
log "   ✅ Datos copiados"

# 4. Importar a la DB
log ""
log "4️⃣  Importando a la base de datos local..."
docker-compose exec -T backend python - <<'PYTHON'
import json
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")
BACKUP_DIR = "/app/backups/prod_data"

def load_json(filename):
    with open(f"{BACKUP_DIR}/{filename}") as f:
        return json.load(f)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Clientes
clientes = load_json("clientes.json")
c.execute("DELETE FROM clientes")
for cli in clientes:
    c.execute("INSERT OR REPLACE INTO clientes (id, nombre, telefono, direccion) VALUES (?, ?, ?, ?)",
        (cli.get('id'), cli.get('nombre', ''), cli.get('telefono', ''), cli.get('direccion', '')))
conn.commit()
print(f"   ✅ {len(clientes)} clientes importados")

# Productos
productos = load_json("productos.json")
c.execute("DELETE FROM productos")
for prod in productos:
    c.execute("INSERT OR REPLACE INTO productos (id, nombre, precio, stock, stock_tipo, stock_minimo, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (prod.get('id'), prod.get('nombre', ''), prod.get('precio', 0), prod.get('stock', 0), 
         prod.get('stock_tipo', 'unidad'), prod.get('stock_minimo', 10), prod.get('imagen_url', '')))
conn.commit()
print(f"   ✅ {len(productos)} productos importados")

# Pedidos
pedidos = load_json("pedidos.json")
c.execute("DELETE FROM detalles_pedido")
c.execute("DELETE FROM pedidos")
detalles = 0
for ped in pedidos:
    c.execute("""INSERT INTO pedidos 
        (id, cliente_id, fecha, pdf_generado, notas, creado_por, dispositivo, 
         fecha_creacion, fecha_generacion, generado_por, ultimo_editor, fecha_ultima_edicion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (ped.get('id'), ped.get('cliente_id'), ped.get('fecha', ''),
         ped.get('pdf_generado', 0), ped.get('notas', ''), ped.get('creado_por', ''),
         ped.get('dispositivo', ''), ped.get('fecha_creacion', ''), ped.get('fecha_generacion', ''),
         ped.get('generado_por', ''), ped.get('ultimo_editor', ''), ped.get('fecha_ultima_edicion', '')))
    for item in ped.get('productos', []):
        c.execute("INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, tipo) VALUES (?, ?, ?, ?)",
            (ped.get('id'), item.get('id') or item.get('producto_id'), item.get('cantidad', 1),
             item.get('tipo', 'unidad')))
        detalles += 1
conn.commit()
print(f"   ✅ {len(pedidos)} pedidos, {detalles} detalles importados")

conn.close()
PYTHON

# 5. Verificar
log ""
log "5️⃣  Verificación final..."
curl -s "http://localhost:8000/health" | jq -r '"   Backend: " + .status'

log ""
log "=============================================="
log "✅ SYNC COMPLETADO"
log "=============================================="
log ""
log "📊 Datos importados desde producción:"
log "   • Clientes:  $CLIENTES"
log "   • Productos: $PRODUCTOS"  
log "   • Pedidos:   $PEDIDOS"
log ""
log "🌐 Accede a la app: http://localhost"
log ""
