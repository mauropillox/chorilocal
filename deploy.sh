#!/bin/bash

PROYECTO_DIR="/home/ec2-user/chorizaurio"

# Si no existe el proyecto, lo clona
if [ ! -d "$PROYECTO_DIR" ]; then
  echo "<dd01> Clonando repositorio por primera vez..."
  sudo git clone https://github.com/mauropillox/chorizaurio.git "$PROYECTO_DIR"
fi

cd "$PROYECTO_DIR" || exit

echo "<ddf9> Haciendo pull desde GitHub..."
sudo git pull origin master || exit

echo "<dd28> Deteniendo contenedores anteriores..."
sudo docker-compose down

echo "<dd42> Reconstruyendo e iniciando contenedores..."
if sudo docker-compose up --build -d; then
  echo "✅ Contenedores iniciados."

  echo "<dd60> Aplicando migración de base de datos..."
  sudo docker exec chorizaurio-backend-1 python3 backend/migraciones/migrar_db.py

  echo "✅ Deploy completo."
else
  echo "❌ Error durante el build o inicio de contenedores."
fi
