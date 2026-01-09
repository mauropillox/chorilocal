#!/bin/bash

API_URL="https://api.pedidosfriosur.com/api"

echo "=========================================="
echo "🧪 TEST: BULK DELETE EN PRODUCCIÓN"
echo "=========================================="
echo ""

# Login
echo "1️⃣ Login como admin..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

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
    TIMESTAMP=$(date +%s)
    RESPONSE=$(curl -s -X POST "${API_URL}/pedidos" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"cliente_id\":1,\"estado\":\"pendiente\",\"notas\":\"TEST_BULK_DELETE_${TIMESTAMP}_$i\"}")
    
    PEDIDO_ID=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
    
    if [ ! -z "$PEDIDO_ID" ]; then
        PEDIDO_IDS+=($PEDIDO_ID)
        echo "   ✓ Pedido $PEDIDO_ID creado"
    else
        echo "   ⚠️  Error creando pedido $i: $RESPONSE"
    fi
    sleep 0.3
done

if [ ${#PEDIDO_IDS[@]} -eq 0 ]; then
    echo "❌ No se pudieron crear pedidos de prueba"
    exit 1
fi

echo "   Pedidos creados: ${PEDIDO_IDS[@]}"
echo ""

# Test bulk delete
echo "3️⃣ Probando bulk delete de ${#PEDIDO_IDS[@]} pedidos..."
IDS_JSON="[$(IFS=,; echo "${PEDIDO_IDS[*]}")]"
DELETE_RESPONSE=$(curl -s -X POST "${API_URL}/pedidos/bulk-delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pedido_ids\":$IDS_JSON}")

echo "   Respuesta: $DELETE_RESPONSE"

DELETED_COUNT=$(echo $DELETE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('deleted', 0))" 2>/dev/null)
EXPECTED=${#PEDIDO_IDS[@]}

if [ "$DELETED_COUNT" = "$EXPECTED" ]; then
    echo "✅ Bulk delete exitoso: $DELETED_COUNT pedidos eliminados"
else
    echo "⚠️  Se eliminaron $DELETED_COUNT de $EXPECTED pedidos"
fi
echo ""

# Verificar que fueron eliminados
echo "4️⃣ Verificando eliminación..."
VERIFIED=0
for PEDIDO_ID in "${PEDIDO_IDS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/pedidos/${PEDIDO_ID}" \
      -H "Authorization: Bearer $TOKEN")
    
    if [ "$STATUS" = "404" ]; then
        echo "   ✓ Pedido $PEDIDO_ID correctamente eliminado (HTTP $STATUS)"
        ((VERIFIED++))
    else
        echo "   ❌ Pedido $PEDIDO_ID todavía existe (HTTP $STATUS)"
    fi
done

echo ""
echo "=========================================="
if [ "$VERIFIED" = "$EXPECTED" ]; then
    echo "✅ TEST BULK DELETE: PASÓ ($VERIFIED/$EXPECTED)"
else
    echo "⚠️  TEST BULK DELETE: PARCIAL ($VERIFIED/$EXPECTED)"
fi
echo "=========================================="
