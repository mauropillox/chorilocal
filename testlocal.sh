#!/bin/bash
echo "🔍 Verificando estado de los contenedores..."
docker ps --format "table {{.Names}}	{{.Status}}	{{.Ports}}"

echo ""
echo "📦 Contenedores relevantes:"
docker inspect -f '{{ .Name }} -> {{ .State.Status }}' chorizaurio-frontend 2>/dev/null || echo "❌ chorizaurio-frontend no encontrado"
docker inspect -f '{{ .Name }} -> {{ .State.Status }}' chorizaurio-backend 2>/dev/null || echo "❌ chorizaurio-backend no encontrado"

echo ""
echo "🧪 Probar conectividad:"
curl -s -o /dev/null -w "🌐 Backend: %{http_code}\n" http://localhost:8000/login
curl -s -o /dev/null -w "🌐 Frontend: %{http_code}\n" http://localhost:3000
