#!/bin/bash

echo "🧪 TEST COMPLETO DEL SISTEMA - CASA DE CONGELADOS"
echo "═════════════════════════════════════════════════════════════"

# Configuración
API_URL="http://localhost:8000"
USERNAME="testadmin"
PASSWORD="test1234"
TEMP_FILE="/tmp/test_response.json"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para test
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        return 1
    fi
}

# 1️⃣ LOGIN (usando Form data, no JSON)
echo -e "\n${BLUE}1️⃣ AUTENTICACIÓN${NC}"
echo "────────────────────"
curl -s -X POST "$API_URL/login" \
    -d "username=$USERNAME&password=$PASSWORD" \
    -o $TEMP_FILE

TOKEN=$(jq -r '.access_token' $TEMP_FILE 2>/dev/null)
if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    test_result 0 "Login exitoso"
    echo "   Token: ${TOKEN:0:20}..."
else
    echo "   Error: $(jq '.detail' $TEMP_FILE 2>/dev/null)"
    test_result 1 "Login fallido"
    exit 1
fi

# 2️⃣ GET PENDIENTES
echo -e "\n${BLUE}2️⃣ OBTENER PEDIDOS PENDIENTES${NC}"
echo "────────────────────────────────"
curl -s -X GET "$API_URL/pedidos?estado=pendiente" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

PENDIENTES=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)
if [ ! -z "$PENDIENTES" ] && [ "$PENDIENTES" != "null" ]; then
    test_result 0 "Se obtuvieron $PENDIENTES pedidos pendientes"
else
    test_result 1 "No se pudieron obtener pedidos pendientes"
    jq '.' $TEMP_FILE
fi

# 3️⃣ GET GENERADOS
echo -e "\n${BLUE}3️⃣ OBTENER PEDIDOS GENERADOS${NC}"
echo "─────────────────────────────"
curl -s -X GET "$API_URL/pedidos?estado=generado" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

GENERADOS=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)
if [ ! -z "$GENERADOS" ] && [ "$GENERADOS" != "null" ]; then
    test_result 0 "Se obtuvieron $GENERADOS pedidos generados"
else
    test_result 1 "No se pudieron obtener pedidos generados"
fi

# 4️⃣ GET PRODUCTOS
echo -e "\n${BLUE}4️⃣ OBTENER PRODUCTOS${NC}"
echo "────────────────────"
curl -s -X GET "$API_URL/productos" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

PRODUCTOS=$(jq '.productos | length' $TEMP_FILE 2>/dev/null)
if [ ! -z "$PRODUCTOS" ] && [ "$PRODUCTOS" != "null" ] && [ "$PRODUCTOS" -gt 0 ]; then
    test_result 0 "Se obtuvieron $PRODUCTOS productos"
else
    test_result 1 "No se pudieron obtener productos"
fi

# 5️⃣ GET CLIENTES
echo -e "\n${BLUE}5️⃣ OBTENER CLIENTES${NC}"
echo "───────────────────"
curl -s -X GET "$API_URL/clientes" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

CLIENTES=$(jq '.clientes | length' $TEMP_FILE 2>/dev/null)
if [ ! -z "$CLIENTES" ] && [ "$CLIENTES" != "null" ] && [ "$CLIENTES" -gt 0 ]; then
    test_result 0 "Se obtuvieron $CLIENTES clientes"
else
    test_result 1 "No se pudieron obtener clientes"
fi

# 6️⃣ CREAR NUEVO CLIENTE
echo -e "\n${BLUE}6️⃣ CREAR NUEVO CLIENTE${NC}"
echo "──────────────────────"
CLIENTE_NAME="TestCli_$(date +%s)"
curl -s -X POST "$API_URL/clientes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\": \"$CLIENTE_NAME\", \"email\": \"test@cli.com\", \"direccion\": \"Calle Test 123\", \"telefono\": \"9876543210\"}" \
    -o $TEMP_FILE

CLIENTE_ID=$(jq -r '.id' $TEMP_FILE 2>/dev/null)
if [ ! -z "$CLIENTE_ID" ] && [ "$CLIENTE_ID" != "null" ]; then
    test_result 0 "Cliente creado: $CLIENTE_NAME (ID: $CLIENTE_ID)"
else
    test_result 1 "No se pudo crear cliente"
    jq '.' $TEMP_FILE
fi

# 7️⃣ CREAR NUEVO PEDIDO
echo -e "\n${BLUE}7️⃣ CREAR NUEVO PEDIDO${NC}"
echo "────────────────────"
curl -s -X POST "$API_URL/pedidos" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"cliente_id\": $CLIENTE_ID, \"detalles\": [{\"producto_id\": 1, \"cantidad\": 2}]}" \
    -o $TEMP_FILE

PEDIDO_ID=$(jq -r '.id' $TEMP_FILE 2>/dev/null)
if [ ! -z "$PEDIDO_ID" ] && [ "$PEDIDO_ID" != "null" ]; then
    test_result 0 "Pedido creado: ID $PEDIDO_ID"
else
    test_result 1 "No se pudo crear pedido"
    jq '.' $TEMP_FILE
fi

# 8️⃣ VERIFICAR PEDIDO EN ESTADO PENDIENTE
echo -e "\n${BLUE}8️⃣ VERIFICAR PEDIDO PENDIENTE${NC}"
echo "──────────────────────────────"
curl -s -X GET "$API_URL/pedidos/$PEDIDO_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

PEDIDO_STATE=$(jq -r '.estado' $TEMP_FILE 2>/dev/null)
PEDIDO_PDF=$(jq -r '.pdf_generado' $TEMP_FILE 2>/dev/null)

if [ "$PEDIDO_STATE" = "pendiente" ]; then
    test_result 0 "Pedido está en estado PENDIENTE"
else
    test_result 1 "Pedido no está en estado pendiente (estado: $PEDIDO_STATE)"
fi

if [ "$PEDIDO_PDF" = "false" ] || [ "$PEDIDO_PDF" = "False" ]; then
    test_result 0 "PDF no generado aún (pdf_generado: false)"
else
    test_result 1 "PDF ya está generado (pdf_generado: $PEDIDO_PDF)"
fi

# 9️⃣ GENERAR PDF
echo -e "\n${BLUE}9️⃣ GENERAR PDF DEL PEDIDO${NC}"
echo "─────────────────────────"
PDF_RESPONSE=$(curl -s -X POST "$API_URL/pedidos/$PEDIDO_ID/generar-pdf" \
    -H "Authorization: Bearer $TOKEN")

PDF_FILE=$(echo "$PDF_RESPONSE" | jq -r '.pdf_url' 2>/dev/null)
if [ ! -z "$PDF_FILE" ] && [ "$PDF_FILE" != "null" ]; then
    test_result 0 "PDF generado: $PDF_FILE"
else
    test_result 1 "No se pudo generar PDF"
    echo "$PDF_RESPONSE"
fi

# 🔟 VERIFICAR PEDIDO EN ESTADO GENERADO
echo -e "\n${BLUE}🔟 VERIFICAR PEDIDO GENERADO${NC}"
echo "───────────────────────────"
sleep 1  # Esperar a que se procese
curl -s -X GET "$API_URL/pedidos/$PEDIDO_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE

PEDIDO_STATE=$(jq -r '.estado' $TEMP_FILE 2>/dev/null)
PEDIDO_PDF=$(jq -r '.pdf_generado' $TEMP_FILE 2>/dev/null)

if [ "$PEDIDO_STATE" = "generado" ]; then
    test_result 0 "Pedido cambió a estado GENERADO"
else
    test_result 1 "Pedido sigue en estado $PEDIDO_STATE (debería ser generado)"
fi

if [ "$PEDIDO_PDF" = "true" ] || [ "$PEDIDO_PDF" = "True" ]; then
    test_result 0 "PDF marcado como generado (pdf_generado: true)"
else
    test_result 1 "PDF no marcado como generado (pdf_generado: $PEDIDO_PDF)"
fi

# 1️⃣1️⃣ CONTAR PENDIENTES Y GENERADOS FINALES
echo -e "\n${BLUE}1️⃣1️⃣ CONTEO FINAL${NC}"
echo "────────────────"
curl -s -X GET "$API_URL/pedidos?estado=pendiente" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE
PENDIENTES_FINAL=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)

curl -s -X GET "$API_URL/pedidos?estado=generado" \
    -H "Authorization: Bearer $TOKEN" \
    -o $TEMP_FILE
GENERADOS_FINAL=$(jq '.pedidos | length' $TEMP_FILE 2>/dev/null)

echo "📊 Resultado:"
echo "   Pendientes: $PENDIENTES_FINAL (antes: $PENDIENTES)"
echo "   Generados: $GENERADOS_FINAL (antes: $GENERADOS)"

if [ $GENERADOS_FINAL -gt $GENERADOS ]; then
    test_result 0 "El conteo de generados aumentó correctamente"
else
    test_result 1 "El conteo de generados no cambió"
fi

# RESUMEN
echo -e "\n${YELLOW}═════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}✅ TODOS LOS TESTS COMPLETADOS${NC}"
echo -e "${YELLOW}═════════════════════════════════════════════════════════════${NC}"

rm -f $TEMP_FILE
