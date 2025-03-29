#!/bin/bash
set -e

# Colores ANSI
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
RED='\033[1;31m'
NC='\033[0m' # sin color

echo -e "${CYAN}<dd01>${NC} Clonando repositorio por primera vez..."
if [ ! -d "chorizaurio" ]; then
    git clone https://github.com/mauropillox/chorizaurio.git
fi

cd chorizaurio

echo -e "${CYAN}<ddf9>${NC} Haciendo pull desde GitHub..."
git pull

echo -e "${CYAN}<dd28>${NC} Deteniendo contenedores anteriores..."
docker compose down || true

# ✅ Verificar existencia de .env
if [ ! -f ../.env ]; then
  echo -e "${YELLOW}⚠️ Falta archivo .env para el backend.${NC}"
  exit 1
fi

# ✅ Base de datos
echo -e "${CYAN}<db01>${NC} Verificando base de datos..."
if [ ! -f ventas.db ]; then
    echo -e "${YELLOW}⚠️ ventas.db no encontrada. Ejecutando init_db.py...${NC}"
    docker run --rm -v "$PWD":/app -w /app --env-file ../.env python:3.9 python init_db.py
else
    docker run --rm -v "$PWD":/app -w /app --env-file ../.env python:3.9 python - <<EOF
import sqlite3, sys
db = sqlite3.connect("ventas.db")
c = db.cursor()
def check_table_column(table, column):
    c.execute(f"PRAGMA table_info({table})")
    return column in [r[1] for r in c.fetchall()]
try:
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pedidos'")
    if not c.fetchone():
        raise Exception("Tabla pedidos no existe.")
    if not check_table_column("pedidos", "pdf_generado"):
        raise Exception("Columna pdf_generado no existe.")
    if not check_table_column("detalles_pedido", "tipo"):
        raise Exception("Columna tipo no existe.")
    if not check_table_column("usuarios", "password_hash"):
        raise Exception("Tabla usuarios incompleta.")
except Exception as e:
    print(f"⚠️ {e} Ejecutando init_db.py para corregir...")
    sys.exit(42)
EOF

    if [ $? -eq 42 ]; then
        docker run --rm -v "$PWD":/app -w /app --env-file ../.env python:3.9 python init_db.py
    else
        echo -e "${GREEN}✅ Base de datos OK. Ejecutando migración...${NC}"
        docker run --rm -v "$PWD":/app -w /app --env-file ../.env python:3.9 python migrar_db.py
    fi
fi

# ✅ Verificar certificados SSL directamente montados
echo -e "${CYAN}<ssl01>${NC} Verificando certificados SSL..."
CERT_DIR="/etc/letsencrypt/live/pedidosfriosur.com"

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo -e "${RED}❌ Certificados no encontrados en $CERT_DIR. Abortando.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Certificados SSL existentes en $CERT_DIR${NC}"
fi

# ✅ Reconstruir contenedores
echo -e "${CYAN}<dd42>${NC} Reconstruyendo e iniciando contenedores..."
docker compose up --build -d

echo -e "${GREEN}✅ Deploy completo. Contenedores corriendo.${NC}"
