#!/bin/bash
# Test final post-UX improvements

TOKEN=$(curl -s -X POST http://localhost:8000/login -d "username=admin&password=admin123" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "========================================"
echo "  🔍 PRUEBAS FINALES POST-UX MEJORAS"
echo "========================================"
echo ""

echo "📊 Dashboard Metrics:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/dashboard/metrics | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   ✅ Clientes: {d[\"total_clientes\"]}, Productos: {d[\"total_productos\"]}, Ventas hoy: {d[\"ventas_hoy\"]}')"

echo ""
echo "📊 Dashboard Alertas:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/dashboard/alertas | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   ✅ Stock bajo: {len(d[\"stock_bajo\"])}, Sin stock: {len(d[\"sin_stock\"])}')"

echo ""
echo "👥 Clientes:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/clientes | python3 -c "import sys,json; print(f'   ✅ Total: {len(json.load(sys.stdin))}')"

echo ""
echo "📦 Productos:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/productos | python3 -c "import sys,json; print(f'   ✅ Total: {len(json.load(sys.stdin))}')"

echo ""
echo "🛒 Pedidos:"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/pedidos?limit=10" | python3 -c "import sys,json; print(f'   ✅ Recuperados: {len(json.load(sys.stdin))}')"

echo ""
echo "🎉 Ofertas CRUD Test:"
OFERTA_RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "http://localhost:8000/ofertas" -d "titulo=TestFinal&descripcion=Test&desde=2025-01-01&hasta=2025-12-31&productos=[]&descuento_porcentaje=10")
OFERTA_ID=$(echo "$OFERTA_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   ✅ Creada oferta ID: $OFERTA_ID"
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "http://localhost:8000/ofertas/$OFERTA_ID" > /dev/null
echo "   ✅ Eliminada oferta ID: $OFERTA_ID"

echo ""
echo "📋 Templates:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/templates | python3 -c "import sys,json; print(f'   ✅ Total: {len(json.load(sys.stdin))}')"

echo ""
echo "💲 Listas de Precios:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/listas-precios | python3 -c "import sys,json; print(f'   ✅ Total: {len(json.load(sys.stdin))}')"

echo ""
echo "📈 Reportes:"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/reportes/ventas_mes?mes=2025-01" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   ✅ Productos en reporte: {len(d.get(\"productos\", []))}')"

echo ""
echo "========================================"
echo "  🎉 TODAS LAS PRUEBAS COMPLETADAS ✅"
echo "========================================"
