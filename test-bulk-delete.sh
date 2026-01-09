#!/bin/bash

API_URL="https://api.pedidosfriosur.com/api"
FRONTEND_URL="https://www.pedidosfriosur.com"

echo "=================================="
echo "🧪 TEST BULK DELETE EN PRODUCCIÓN"
echo "=================================="
echo ""

# Login
echo "1️⃣ Login como admin..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Error en login"
    exit 1
fi
echo "✅ Login exitoso"
echo ""

# Crear 3 pedidos de prueba
echo "2️⃣ Creando 3 pedidos de prueba..."
PEDIDO_IDS=()

for i in {1..3}; do
    RESPONSE=$(curl -s -X POST "${API_URL}/pedidos" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"cliente_id\":1,\"estado\":\"pendiente\",\"notas\":\"TEST_BULK_DELETE_$i\"}")
    
    PEDIDO_ID=$(echo $RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    
    if [ ! -z "$PEDIDO_ID" ]; then
        PEDIDO_IDS+=($PEDIDO_ID)
        echo "   ✓ Pedido $PEDIDO_ID creado"
    else
        echo "   ❌ Error creando pedido $i"
    fi
done

echo "   Pedidos creados: ${PEDIDO_IDS[@]}"
echo ""

# Test bulk delete
echo "3️⃣ Probando bulk delete..."
IDS_JSON=$(printf '%s\n' "${PEDIDO_IDS[@]}" | jq -s .)
DELETE_RESPONSE=$(curl -s -X POST "${API_URL}/pedidos/bulk-delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pedido_ids\":$IDS_JSON}")

echo "   Respuesta: $DELETE_RESPONSE"

DELETED_COUNT=$(echo $DELETE_RESPONSE | grep -o '"deleted":[0-9]*' | cut -d':' -f2)
if [ "$DELETED_COUNT" = "3" ]; then
    echo "✅ Bulk delete exitoso: $DELETED_COUNT pedidos eliminados"
else
    echo "⚠️  Se eliminaron $DELETED_COUNT de 3 pedidos"
fi
echo ""

# Verificar que fueron eliminados
echo "4️⃣ Verificando eliminación..."
for PEDIDO_ID in "${PEDIDO_IDS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/pedidos/${PEDIDO_ID}" \
      -H "Authorization: Bearer $TOKEN")
    
    if [ "$STATUS" = "404" ]; then
        echo "   ✓ Pedido $PEDIDO_ID correctamente eliminado"
    else
        echo "   ❌ Pedido $PEDIDO_ID todavía existe (HTTP $STATUS)"
    fi
done

echo ""
echo "=================================="
echo "✅ TEST BULK DELETE COMPLETADO"
echo "=================================="
