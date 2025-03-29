#!/bin/bash
set -e

echo "<dd01> Clonando repositorio por primera vez..."
if [ ! -d "chorizaurio" ]; then
    git clone https://github.com/mauropillox/chorizaurio.git
fi

cd chorizaurio

echo "<ddf9> Haciendo pull desde GitHub..."
git pull

echo "<dd28> Deteniendo contenedores anteriores..."
docker compose down || true

# ✅ Verificar existencia de .env
if [ ! -f ../.env ]; then
  echo "⚠️ Falta archivo .env para el backend."
  exit 1
fi

# ✅ Verificar e inicializar base de datos
echo "<db01> Verificando base de datos..."
if [ ! -f ventas.db ]; then
    echo "⚠️ ventas.db no encontrada. Ejecutando init_db.py..."
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
        echo "✅ Base de datos OK. Ejecutando migración..."
        docker run --rm -v "$PWD":/app -w /app --env-file ../.env python:3.9 python migrar_db.py
    fi
fi

# ✅ Verificar y copiar certificados SSL
CERT_ORIG=/etc/letsencrypt/live/pedidosfriosur.com
CERT_DEST=certs

echo "<ssl01> Verificando certificados SSL..."
if [ -f "$CERT_ORIG/fullchain.pem" ] && [ -f "$CERT_ORIG/privkey.pem" ]; then
    mkdir -p "$CERT_DEST"
    cp "$CERT_ORIG/fullchain.pem" "$CERT_DEST/"
    cp "$CERT_ORIG/privkey.pem" "$CERT_DEST/"
    chmod 644 "$CERT_DEST/"*.pem
    echo "✅ Certificados SSL copiados correctamente."
else
    echo "⚠️ Certificados SSL no encontrados en $CERT_ORIG"
fi

echo "<dd42> Reconstruyendo e iniciando contenedores..."
docker compose up --build -d

echo "✅ Deploy completo. Contenedores corriendo."
