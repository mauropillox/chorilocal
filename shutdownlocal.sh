#!/bin/bash
echo "🛑 Apagando contenedores Docker..."
docker compose down --volumes --remove-orphans

echo "🧹 Borrando imágenes del proyecto..."
docker image prune -af

echo "✅ Todo apagado y limpiado."
