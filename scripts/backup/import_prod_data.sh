#!/bin/bash
set -euo pipefail

# === Importar datos de producción a DB local ===
# Usa los datos descargados por download_prod_db.sh

BACKUP_DIR="backups/prod_data"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ts() { date +"%H:%M:%S"; }
log() { echo "[$(ts)] $*"; }

log "=== IMPORTACIÓN DE DATOS DE PRODUCCIÓN ==="

# Verificar que existen los datos
if [ ! -f "$BACKUP_DIR/clientes.json" ]; then
    log "❌ No se encontraron datos de producción."
    log "   Primero ejecuta: ./download_prod_db.sh"
    exit 1
fi

# Backup de la DB local actual
log "1. Haciendo backup de la DB local..."
mkdir -p backups
if docker-compose exec -T backend test -f /data/ventas.db 2>/dev/null; then
    docker-compose exec -T backend cp /data/ventas.db /data/ventas.db.bak
    log "   ✅ Backup creado: /data/ventas.db.bak"
else
    log "   ⚠️ No hay DB local existente"
fi

# Importar datos usando Python
log "2. Importando datos a la DB local..."
docker-compose exec -T backend python - <<PYTHON
import json
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")
BACKUP_DIR = "/app/backups/prod_data"

def load_json(filename):
    path = f"{BACKUP_DIR}/{filename}"
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
            # Handle paginated response
            if isinstance(data, dict) and 'data' in data:
                return data['data']
            return data
    return []

print("Conectando a la DB...")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Limpiar tablas (excepto usuarios para no perder acceso)
print("Limpiando tablas...")
c.execute("DELETE FROM pedidos_productos")
c.execute("DELETE FROM pedidos")
c.execute("DELETE FROM productos")
c.execute("DELETE FROM clientes")
c.execute("DELETE FROM ofertas_productos")
c.execute("DELETE FROM ofertas")
c.execute("DELETE FROM listas_precios_items")
c.execute("DELETE FROM listas_precios")
c.execute("DELETE FROM templates_productos")
c.execute("DELETE FROM templates")

# Importar clientes
print("Importando clientes...")
clientes = load_json("clientes.json")
for cli in clientes:
    c.execute("""
        INSERT OR REPLACE INTO clientes (id, nombre, telefono, direccion, barrio, notas, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        cli.get('id'),
        cli.get('nombre', ''),
        cli.get('telefono', ''),
        cli.get('direccion', ''),
        cli.get('barrio', ''),
        cli.get('notas', ''),
        cli.get('created_at', ''),
        cli.get('updated_at', '')
    ))
print(f"   {len(clientes)} clientes importados")

# Importar productos
print("Importando productos...")
productos = load_json("productos.json")
for prod in productos:
    c.execute("""
        INSERT OR REPLACE INTO productos (id, nombre, precio, stock, stock_tipo, stock_minimo, imagen_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        prod.get('id'),
        prod.get('nombre', ''),
        prod.get('precio', 0),
        prod.get('stock', 0),
        prod.get('stock_tipo', 'unidad'),
        prod.get('stock_minimo', 10),
        prod.get('imagen_url', ''),
        prod.get('created_at', ''),
        prod.get('updated_at', '')
    ))
print(f"   {len(productos)} productos importados")

# Importar pedidos
print("Importando pedidos...")
pedidos = load_json("pedidos.json")
for ped in pedidos:
    c.execute("""
        INSERT OR REPLACE INTO pedidos (id, cliente_id, fecha, total, pdf_generado, notas, creado_por, dispositivo, fecha_creacion, fecha_generacion, generado_por, ultimo_editor, fecha_ultima_edicion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ped.get('id'),
        ped.get('cliente_id'),
        ped.get('fecha', ''),
        ped.get('total', 0),
        ped.get('pdf_generado', 0),
        ped.get('notas', ''),
        ped.get('creado_por', ''),
        ped.get('dispositivo', ''),
        ped.get('fecha_creacion', ''),
        ped.get('fecha_generacion', ''),
        ped.get('generado_por', ''),
        ped.get('ultimo_editor', ''),
        ped.get('fecha_ultima_edicion', '')
    ))
    # Importar productos del pedido
    for item in ped.get('productos', []):
        c.execute("""
            INSERT OR REPLACE INTO pedidos_productos (pedido_id, producto_id, cantidad, tipo, precio)
            VALUES (?, ?, ?, ?, ?)
        """, (
            ped.get('id'),
            item.get('id') or item.get('producto_id'),
            item.get('cantidad', 1),
            item.get('tipo', 'unidad'),
            item.get('precio', 0)
        ))
print(f"   {len(pedidos)} pedidos importados")

# Importar ofertas
print("Importando ofertas...")
ofertas = load_json("ofertas.json")
for of in ofertas:
    c.execute("""
        INSERT OR REPLACE INTO ofertas (id, nombre, descripcion, descuento_porcentaje, fecha_inicio, fecha_fin, activa, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        of.get('id'),
        of.get('nombre', ''),
        of.get('descripcion', ''),
        of.get('descuento_porcentaje', 0),
        of.get('fecha_inicio', ''),
        of.get('fecha_fin', ''),
        of.get('activa', 1),
        of.get('created_at', '')
    ))
    for pid in of.get('productos_ids', []):
        c.execute("INSERT OR IGNORE INTO ofertas_productos (oferta_id, producto_id) VALUES (?, ?)", (of.get('id'), pid))
print(f"   {len(ofertas)} ofertas importadas")

conn.commit()
conn.close()
print("✅ Importación completada!")
PYTHON

log ""
log "=== IMPORTACIÓN COMPLETADA ==="
log "Los datos de producción han sido importados a la DB local."
log ""
log "Reinicia los containers para aplicar cambios:"
log "   docker-compose restart backend"
