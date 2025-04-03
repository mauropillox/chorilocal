#!/bin/bash
set -e

cd "$(dirname "$0")"

# Verificar si sqlite3 está instalado
if ! command -v sqlite3 > /dev/null 2>&1; then
  echo "⚠️ sqlite3 no encontrado. Instalando..."
  sudo apt-get update && sudo apt-get install -y sqlite3
  echo "✅ sqlite3 instalado."
fi

DB_FILE="$(pwd)/ventas.db"

add_missing_column() {
  local table=$1
  local column=$2
  local definition=$3
  if ! sqlite3 "$DB_FILE" "PRAGMA table_info(${table});" | grep -q "${column}"; then
    echo "🛠️ Agregando columna '${column}' a '${table}'..."
    sqlite3 "$DB_FILE" "ALTER TABLE ${table} ADD COLUMN ${column} ${definition};"
    echo "✅ Columna '${column}' agregada."
  else
    echo "✅ La columna '${column}' ya existe en '${table}'."
  fi
}

# WSL check
if grep -qi microsoft /proc/version; then
  echo "🐧 Ejecutando en WSL."
else
  echo "⚠️ Este script está diseñado para WSL. Abortando."
  exit 1
fi

if [[ "$PWD" == /mnt/* ]]; then
  echo "⚠️ Estás en un sistema de archivos de Windows (/mnt)."
fi

# Entorno virtual
echo "🐍 Verificando entorno virtual..."
if [[ -z "$VIRTUAL_ENV" ]]; then
  if [ -d "venv" ] && [ ! -f "venv/bin/activate" ]; then
    echo "⚠️ Carpeta venv inválida. Eliminando..."
    rm -rf venv
  fi

  if [ ! -d "venv" ]; then
    echo "⚙️ Creando entorno virtual..."
    python3 -m venv venv || (sudo apt install -y python3-venv && python3 -m venv venv)
  fi

  source venv/bin/activate
  echo "✅ Entorno virtual activado."
fi

# Requisitos
echo "📦 Instalando dependencias..."
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
else
  echo "⚠️ No se encontró requirements.txt"
fi

# Apagar contenedores anteriores
echo "🛑 Apagando contenedores Docker..."
docker compose -f docker-compose.local.yml down || true

# Verificar y preparar base de datos
echo "🗃️ Verificando base de datos..."
[ ! -f "$DB_FILE" ] && touch "$DB_FILE" && echo "✅ Base de datos creada."

# Crear tablas mínimas si no existen
echo "📐 Verificando tablas principales..."
sqlite3 "$DB_FILE" <<EOF
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    fecha TEXT
);
CREATE TABLE IF NOT EXISTS detalles_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER,
    producto_id INTEGER,
    cantidad REAL
);
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'user',
    activo INTEGER NOT NULL DEFAULT 0
);
EOF
echo "✅ Tablas creadas o ya existentes."

# Agregar columnas nuevas si faltan
echo "🔄 Actualizando esquema..."
add_missing_column "clientes" "telefono" "TEXT"
add_missing_column "clientes" "direccion" "TEXT"
add_missing_column "productos" "precio" "REAL NOT NULL"
add_missing_column "pedidos" "fecha" "TEXT"
add_missing_column "pedidos" "pdf_generado" "INTEGER DEFAULT 0"
add_missing_column "pedidos" "observaciones" "TEXT"
add_missing_column "detalles_pedido" "cantidad" "REAL"
add_missing_column "detalles_pedido" "tipo" "TEXT DEFAULT 'unidad'"
add_missing_column "usuarios" "rol" "TEXT NOT NULL"
add_missing_column "usuarios" "activo" "INTEGER NOT NULL DEFAULT 0"
add_missing_column "usuarios" "last_login" "TEXT"
echo "✅ Esquema actualizado."

# Build del frontend
FRONT_PATH=$(cd frontend && pwd)
echo "📁 Frontend en $FRONT_PATH"
echo "🔧 Compilando frontend con Vite..."
docker run --rm -v "$FRONT_PATH:/app" -w /app node:18-alpine sh -c "
  npm install && npm run build -- --mode development
"

# Levantar servicios
echo "🚀 Levantando contenedores..."
docker compose -f docker-compose.local.yml up --build -d

# Crear usuario admin si no existe
echo "🔐 Verificando si el usuario admin existe..."
ADMIN_EXISTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM usuarios WHERE username = 'admin';")
if [ "$ADMIN_EXISTS" -eq 0 ]; then
  echo "🔐 Usuario admin no existe. Ejecutando resetadmin.py..."
  docker exec -i chorizaurio-backend python resetadmin.py
else
  echo "✅ Usuario admin ya existe. No se requiere reiniciar."
fi

echo "✅ Todo listo. Visitá: http://localhost:3000"
