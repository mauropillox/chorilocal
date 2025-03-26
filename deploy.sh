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
docker compose down

# 🔍 Verificar e inicializar la base de datos si es necesario
echo "<db01> Verificando base de datos..."
if [ ! -f ventas.db ]; then
    echo "⚠️  ventas.db no encontrada. Ejecutando init_db.py..."
    docker run --rm -v "$PWD":/app -w /app python:3.9 python init_db.py
else
    docker run --rm -v "$PWD":/app -w /app python:3.9 python - <<EOF
import sqlite3, sys
db = sqlite3.connect("ventas.db")
c = db.cursor()

def check_table_column(table, column):
    c.execute(f"PRAGMA table_info({table})")
    columns = [r[1] for r in c.fetchall()]
    return column in columns

try:
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pedidos'")
    if not c.fetchone():
        raise Exception("Tabla pedidos no existe.")

    if not check_table_column("pedidos", "pdf_generado"):
        raise Exception("Columna pdf_generado no existe en tabla pedidos.")
except Exception as e:
    print(f"⚠️  {e} Ejecutando init_db.py para corregir...")
    sys.exit(42)
EOF

    if [ $? -eq 42 ]; then
        docker run --rm -v "$PWD":/app -w /app python:3.9 python init_db.py
    else
        echo "✅ Base de datos OK."
    fi
fi

echo "<dd42> Reconstruyendo e iniciando contenedores..."
docker compose up --build -d

echo "✅ Deploy completo."
