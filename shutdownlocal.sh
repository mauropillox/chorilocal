#!/bin/bash
echo "🛑 Apagando contenedores Docker (preservando datos)..."
docker compose down --remove-orphans

echo "🧹 Borrando imágenes del proyecto..."
docker image prune -af

echo "✅ Todo apagado y limpiado."
echo ""
echo "💡 Para eliminar volúmenes también (¡BORRA LA BASE DE DATOS!), usa:"
echo "   docker compose down --volumes --remove-orphans"
