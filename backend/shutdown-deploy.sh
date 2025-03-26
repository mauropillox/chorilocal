#!/bin/bash

PROYECTO_DIR="/home/ec2-user/chorizaurio"

echo "⛔ Deteniendo y eliminando contenedores, redes y volúmenes..."
cd "$PROYECTO_DIR" || exit
sudo docker-compose down -v

echo "🧹 Limpiando imágenes huérfanas..."
sudo docker image prune -f

echo "🛑 Deploy detenido correctamente."
