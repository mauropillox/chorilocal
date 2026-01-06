#!/bin/bash

echo "🧪 TEST SIMPLIFICADO - CASA DE CONGELADOS"
echo "═════════════════════════════════════════════════════════════"

API_URL="http://localhost:8000"
USERNAME="testadmin"
PASSWORD="test1234"
TEMP_FILE="/tmp/test_response.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        return 1
    fi
}

# 1️⃣ LOGIN
echo -e "\n${BLUE}1️⃣ AUTENTICACIÓN${NC}"
curl -s -X POST "$API_URL/login" \
    -d "username=$USERNAME&password=$PASSWORD" \
    -o $TEMP_FILE

TOKEN=$(jq -r '.access_token' $TEMP_FILE 2>/dev/null)
if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    test_result 0 "Login exitoso"
else
    test_result 1 "Login fallido"
    exit 1
fi

# 2️⃣ OBTENER ESTADO INICIAL
echo -e "\n${BLUE}2️⃣ ESTADO INICIAL${NC}"
curl -s "$API_URL/pedidos?estado=pendiente" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
PENDIENTES=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)
curl -s "$API_URL/pedidos?estado=generado" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
GENERADOS=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)

echo "   Pedidos Pendientes: $PENDIENTES"
echo "   Pedidos Generados: $GENERADOS"

# 3️⃣ CREAR CLIENTE
echo -e "\n${BLUE}3️⃣ CREAR NUEVO CLIENTE${NC}"
CLIENTE_JSON=$(curl -s -X POST "$API_URL/clientes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\": \"TestCli_$(date +%s)\", \"email\": \"test@cli.com\", \"direccion\": \"Test 123\", \"telefono\": \"1234567890\"}")

CLIENTE_ID=$(echo "$CLIENTE_JSON" | jq -r '.id' 2>/dev/null)
if [ ! -z "$CLIENTE_ID" ] && [ "$CLIENTE_ID" != "null" ]; then
    test_result 0 "Cliente creado: ID $CLIENTE_ID"
else
    test_result 1 "No se pudo crear cliente"
    echo "$CLIENTE_JSON" | jq .
    exit 1
fi

# 4️⃣ CREAR PEDIDO CON FORMATO CORRECTO
echo -e "\n${BLUE}4️⃣ CREAR NUEVO PEDIDO${NC}"

# Primero obtener primer producto disponible
curl -s "$API_URL/productos" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
PROD_ID=$(jq '.productos[0].id' $TEMP_FILE 2>/dev/null)

if [ -z "$PROD_ID" ] || [ "$PROD_ID" = "null" ]; then
    test_result 1 "No hay productos disponibles"
    exit 1
fi

PEDIDO_JSON=$(curl -s -X POST "$API_URL/pedidos" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"cliente\": {\"id\": $CLIENTE_ID},
        \"productos\": [{\"id\": $PROD_ID, \"cantidad\": 2}]
    }")

PEDIDO_ID=$(echo "$PEDIDO_JSON" | jq -r '.id' 2>/dev/null)
if [ ! -z "$PEDIDO_ID" ] && [ "$PEDIDO_ID" != "null" ]; then
    test_result 0 "Pedido creado: ID $PEDIDO_ID"
else
    test_result 1 "No se pudo crear pedido"
    echo "$PEDIDO_JSON" | jq .
    exit 1
fi

# 5️⃣ VERIFICAR ESTADO INICIAL DEL PEDIDO
echo -e "\n${BLUE}5️⃣ ESTADO INICIAL DEL PEDIDO${NC}"
curl -s "$API_URL/pedidos/$PEDIDO_ID" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
ESTADO=$(jq -r '.estado' $TEMP_FILE 2>/dev/null)
PDF_GEN=$(jq -r '.pdf_generado' $TEMP_FILE 2>/dev/null)

echo "   Estado: $ESTADO"
echo "   PDF Generado: $PDF_GEN"

# 6️⃣ GENERAR PDF
echo -e "\n${BLUE}6️⃣ GENERAR PDF DEL PEDIDO${NC}"
curl -s -X POST "$API_URL/pedidos/$PEDIDO_ID/generar-pdf" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

PDF_URL=$(jq -r '.pdf_url' $TEMP_FILE 2>/dev/null)
if [ ! -z "$PDF_URL" ] && [ "$PDF_URL" != "null" ]; then
    test_result 0 "PDF generado: $PDF_URL"
else
    test_result 1 "No se pudo generar PDF"
    jq . $TEMP_FILE
fi

# 7️⃣ VERIFICAR ESTADO FINAL
echo -e "\n${BLUE}7️⃣ ESTADO FINAL DEL PEDIDO${NC}"
sleep 1
curl -s "$API_URL/pedidos/$PEDIDO_ID" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
ESTADO_FINAL=$(jq -r '.estado' $TEMP_FILE 2>/dev/null)
PDF_GEN_FINAL=$(jq -r '.pdf_generado' $TEMP_FILE 2>/dev/null)

echo "   Estado: $ESTADO_FINAL"
echo "   PDF Generado: $PDF_GEN_FINAL"

if [ "$ESTADO_FINAL" = "generado" ]; then
    test_result 0 "Pedido en estado GENERADO"
else
    test_result 1 "Pedido en estado $ESTADO_FINAL (esperado: generado)"
fi

# 8️⃣ CONTEO FINAL
echo -e "\n${BLUE}8️⃣ CONTEO FINAL${NC}"
curl -s "$API_URL/pedidos?estado=pendiente" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
PEND_FINAL=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)

curl -s "$API_URL/pedidos?estado=generado" -H "Authorization: Bearer $TOKEN" -o $TEMP_FILE
GEN_FINAL=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)

echo "📊 CAMBIOS:"
echo "   Pendientes: $PENDIENTES → $PEND_FINAL (cambio: $((PEND_FINAL - PENDIENTES)))"
echo "   Generados: $GENERADOS → $GEN_FINAL (cambio: $((GEN_FINAL - GENERADOS)))"

if [ $GEN_FINAL -gt $GENERADOS ]; then
    test_result 0 "Generados aumentó correctamente"
else
    test_result 1 "Generados no cambió"
fi

echo -e "\n${YELLOW}═════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}✅ TEST COMPLETADO${NC}"
echo -e "${YELLOW}═════════════════════════════════════════════════════════════${NC}"

rm -f $TEMP_FILE
