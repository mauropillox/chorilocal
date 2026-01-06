#!/bin/bash
set -e

echo "📥 Clonando repositorio por primera vez..."
if [ ! -d "chorizaurio" ]; then
    git clone https://github.com/mauropillox/chorizaurio.git
fi

cd chorizaurio

echo "🔄 Haciendo pull desde GitHub..."
git pull

echo "🛑 Deteniendo contenedores anteriores..."
docker compose down || true

# ✅ Verificar existencia de .env para el backend
if [ ! -f .env ]; then
  echo "❌ Falta archivo .env para el backend (./.env)"
  exit 1
fi

# ✅ Verificar existencia de archivo .env para el frontend
if [ ! -f frontend/.env ]; then
  echo "❌ Falta archivo frontend/.env"
  exit 1
else
  echo "✅ Archivo .env del frontend ya existe. Verificalo si da error."
fi

# ✅ Validar VITE_API_URL
if ! grep -q "VITE_API_URL=http" frontend/.env; then
  echo "⚠️ VITE_API_URL no está definido correctamente en frontend/.env"
  exit 1
fi

# ✅ Base de datos
echo "🗃️ Verificando base de datos..."
if [ ! -f ventas.db ]; then
    echo "⚠️ ventas.db no encontrada. Ejecutando init_db.py..."
    docker run --rm -v "$PWD":/app -w /app --env-file .env python:3.9 python init_db.py
else
    docker run --rm -v "$PWD":/app -w /app --env-file .env python:3.9 python - <<EOF
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
        docker run --rm -v "$PWD":/app -w /app --env-file .env python:3.9 python init_db.py
    else
        echo "✅ Base de datos OK. Ejecutando migración..."
        docker run --rm -v "$PWD":/app -w /app --env-file .env python:3.9 python migrar_db.py || true
    fi
fi

# ✅ Compilar frontend con Node en contenedor (no requiere npm global)
echo "🧱 Ejecutando build del frontend en contenedor..."
docker run --rm -v "$PWD/frontend":/app -w /app --env-file .env node:18-alpine sh -c "
  npm install && npm run build -- --mode production
"

# ✅ Desplegar contenedores
echo "🚀 Reconstruyendo e iniciando contenedores..."
docker compose up --build -d

echo "✅ Deploy completo. Contenedores corriendo en http://pedidosfriosur.com"
