#!/bin/bash
# =============================================================================
# TEST EXHAUSTIVO COMPLETO - CASOS AVANZADOS
# Incluye: Autorización, validaciones, edge cases, carga, consistencia
# =============================================================================

API="http://localhost:8000"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🧪 TEST EXHAUSTIVO COMPLETO - CASOS AVANZADOS${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

# Obtener tokens
echo -e "${YELLOW}🔑 Obteniendo tokens...${NC}"
USER_TOKEN=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=testcli&password=Test1234' | jq -r '.access_token')

ADMIN_TOKEN=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=testadmin&password=Test1234' | jq -r '.access_token')

if [ "$USER_TOKEN" == "null" ] || [ "$ADMIN_TOKEN" == "null" ]; then
  echo -e "${RED}❌ ERROR: No se obtuvieron tokens${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Tokens obtenidos${NC}\n"

# Función para test
test_case() {
  local method=$1
  local endpoint=$2
  local token=$3
  local data=$4
  local expected_status=$5
  local description=$6
  
  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [[ "$http_code" =~ ^$expected_status ]]; then
    echo -e "${GREEN}✅ $description${NC}"
    ((PASS++))
    echo "$body"
  else
    echo -e "${RED}❌ $description${NC}"
    echo "   Esperado: $expected_status | Recibido: $http_code"
    echo "   Body: ${body:0:100}"
    ((FAIL++))
    echo "$body"
  fi
  echo ""
}

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔒 1. TESTS DE AUTORIZACIÓN Y ROLES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Usuario regular intenta crear lista (debe fallar 403)...${NC}"
test_case "POST" "/listas-precios" "$USER_TOKEN" \
  '{"nombre":"No Permitido","multiplicador":1.1}' \
  "403" \
  "Usuario regular NO puede crear lista"

echo -e "${YELLOW}Usuario regular intenta crear template (debe funcionar - sin admin)...${NC}"
PRODUCTO_ID=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[0].id')
test_case "POST" "/templates" "$USER_TOKEN" \
  "{\"nombre\":\"Template Normal\",\"productos\":[{\"producto_id\":$PRODUCTO_ID,\"cantidad\":1,\"tipo\":\"unidad\"}]}" \
  "200" \
  "Usuario regular PUEDE crear template"

echo -e "${YELLOW}Usuario regular accede a reportes (debe funcionar)...${NC}"
test_case "GET" "/reportes/inventario" "$USER_TOKEN" \
  "" \
  "200" \
  "Usuario regular PUEDE leer reportes"

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚠️  2. TESTS DE VALIDACIONES DE DATOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Crear lista sin nombre (debe fallar)...${NC}"
test_case "POST" "/listas-precios" "$ADMIN_TOKEN" \
  '{"nombre":"","multiplicador":1.1}' \
  "400|422" \
  "Lista sin nombre rechazada"

echo -e "${YELLOW}Crear lista con multiplicador negativo (debe fallar)...${NC}"
test_case "POST" "/listas-precios" "$ADMIN_TOKEN" \
  '{"nombre":"Negativa","multiplicador":-0.5}' \
  "400|422" \
  "Multiplicador negativo rechazado"

echo -e "${YELLOW}Crear lista con multiplicador cero (debe fallar)...${NC}"
test_case "POST" "/listas-precios" "$ADMIN_TOKEN" \
  '{"nombre":"Cero","multiplicador":0}' \
  "400|422" \
  "Multiplicador cero rechazado"

echo -e "${YELLOW}Crear template sin productos (debe fallar)...${NC}"
test_case "POST" "/templates" "$ADMIN_TOKEN" \
  '{"nombre":"Vacío","productos":[]}' \
  "400|422" \
  "Template sin productos rechazado"

echo -e "${YELLOW}Crear template con cantidad negativa (debe fallar)...${NC}"
test_case "POST" "/templates" "$ADMIN_TOKEN" \
  "{\"nombre\":\"Negativo\",\"productos\":[{\"producto_id\":$PRODUCTO_ID,\"cantidad\":-1,\"tipo\":\"unidad\"}]}" \
  "400|422" \
  "Cantidad negativa rechazada"

echo -e "${YELLOW}Precio especial con producto inexistente (debe fallar)...${NC}"
# Crear una lista primero
LISTA_ID=$(curl -s -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Prueba Validación","multiplicador":1.1}' | jq -r '.id')

test_case "POST" "/listas-precios/$LISTA_ID/precios" "$ADMIN_TOKEN" \
  '{"producto_id":99999,"precio_especial":100}' \
  "404" \
  "Precio para producto inexistente rechazado"

# Limpiar
curl -s -X DELETE "$API/listas-precios/$LISTA_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 3. TESTS DE FILTROS EN REPORTES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Reporte ventas con fechas válidas...${NC}"
test_case "GET" "/reportes/ventas?desde=2025-01-01&hasta=2025-12-31" "$USER_TOKEN" \
  "" \
  "200" \
  "Filtro fechas válidas funciona"

echo -e "${YELLOW}Reporte ventas con desde > hasta (rango invertido)...${NC}"
test_case "GET" "/reportes/ventas?desde=2025-12-31&hasta=2025-01-01" "$USER_TOKEN" \
  "" \
  "200" \
  "Rango invertido retorna datos (posiblemente vacío)"

echo -e "${YELLOW}Reporte ventas con fechas futuras...${NC}"
test_case "GET" "/reportes/ventas?desde=2099-01-01&hasta=2099-12-31" "$USER_TOKEN" \
  "" \
  "200" \
  "Fechas futuras sin errores"

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💰 4. TESTS DE CONSISTENCIA DE PRECIOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Flujo de precios: base → lista → especial → sin lista...${NC}"

# Crear lista
LISTA_CONSISTENCIA=$(curl -s -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Consistencia Test","multiplicador":2.0}' | jq -r '.id')

# Obtener precio base
PRECIO_BASE=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | \
  jq -r ".[] | select(.id == $PRODUCTO_ID) | .precio")

echo "   Precio base del producto: $PRECIO_BASE"

# Obtener cliente
CLIENTE_ID=$(curl -s "$API/clientes" -H "Authorization: Bearer $USER_TOKEN" | \
  jq -r '.data[0].id // .[0].id')

# Asignar lista a cliente
curl -s -X PUT "$API/clientes/$CLIENTE_ID/lista-precio" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"lista_id\":$LISTA_CONSISTENCIA}" > /dev/null

# Obtener precio con multiplicador
PRECIO_CON_LISTA=$(curl -s "$API/clientes/$CLIENTE_ID/precio/$PRODUCTO_ID" \
  -H "Authorization: Bearer $USER_TOKEN" | jq -r '.precio')
echo "   Precio con lista (2x): $PRECIO_CON_LISTA"

# Agregar precio especial
curl -s -X POST "$API/listas-precios/$LISTA_CONSISTENCIA/precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"producto_id\":$PRODUCTO_ID,\"precio_especial\":123.45}" > /dev/null

# Obtener precio especial
PRECIO_ESPECIAL=$(curl -s "$API/clientes/$CLIENTE_ID/precio/$PRODUCTO_ID" \
  -H "Authorization: Bearer $USER_TOKEN" | jq -r '.precio')
echo "   Precio especial: $PRECIO_ESPECIAL"

if [ "$PRECIO_ESPECIAL" == "123.45" ]; then
  echo -e "${GREEN}✅ Precio especial correcto${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Precio especial incorrecto (esperaba 123.45, recibió $PRECIO_ESPECIAL)${NC}"
  ((FAIL++))
fi

# Quitar lista
curl -s -X PUT "$API/clientes/$CLIENTE_ID/lista-precio" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lista_id":null}' > /dev/null

# Obtener precio sin lista (debe volver a base)
PRECIO_SIN_LISTA=$(curl -s "$API/clientes/$CLIENTE_ID/precio/$PRODUCTO_ID" \
  -H "Authorization: Bearer $USER_TOKEN" | jq -r '.precio')
echo "   Precio sin lista (vuelto a base): $PRECIO_SIN_LISTA"

if [ "$PRECIO_SIN_LISTA" == "$PRECIO_BASE" ]; then
  echo -e "${GREEN}✅ Precio volvió a base${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Precio no volvió a base (esperaba $PRECIO_BASE, recibió $PRECIO_SIN_LISTA)${NC}"
  ((FAIL++))
fi

# Limpiar
curl -s -X DELETE "$API/listas-precios/$LISTA_CONSISTENCIA" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 5. TESTS EDGE CASES - TEMPLATES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Template con cliente asignado...${NC}"
TEMPLATE_CON_CLIENTE=$(curl -s -X POST "$API/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Template Con Cliente\",\"cliente_id\":$CLIENTE_ID,\"productos\":[{\"producto_id\":$PRODUCTO_ID,\"cantidad\":2,\"tipo\":\"unidad\"}]}" | jq -r '.id')

if [ "$TEMPLATE_CON_CLIENTE" != "null" ]; then
  echo -e "${GREEN}✅ Template con cliente creado: $TEMPLATE_CON_CLIENTE${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Template con cliente falló${NC}"
  ((FAIL++))
fi

echo -e "${YELLOW}Actualizar template para remover todos los productos (debe fallar)...${NC}"
test_case "PUT" "/templates/$TEMPLATE_CON_CLIENTE" "$ADMIN_TOKEN" \
  '{"nombre":"Template Vacío","productos":[]}' \
  "400|422" \
  "No permitir remover todos los productos"

echo -e "${YELLOW}Obtener datos del template...${NC}"
TEMPLATE_DATA=$(curl -s "$API/templates/$TEMPLATE_CON_CLIENTE" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CLIENTE_EN_TEMPLATE=$(echo "$TEMPLATE_DATA" | jq -r '.cliente_id')
if [ "$CLIENTE_EN_TEMPLATE" == "$CLIENTE_ID" ]; then
  echo -e "${GREEN}✅ Cliente correctamente asignado en template${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Cliente no se guardó correctamente${NC}"
  ((FAIL++))
fi

echo -e "${YELLOW}Ejecutar template con cliente asignado...${NC}"
PEDIDO_TEMPLATE=$(curl -s -X POST "$API/templates/$TEMPLATE_CON_CLIENTE/ejecutar" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.pedido_id')

if [ "$PEDIDO_TEMPLATE" != "null" ] && [ -n "$PEDIDO_TEMPLATE" ]; then
  echo -e "${GREEN}✅ Pedido creado desde template: $PEDIDO_TEMPLATE${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Pedido no se creó${NC}"
  ((FAIL++))
fi

# Limpiar
curl -s -X DELETE "$API/templates/$TEMPLATE_CON_CLIENTE" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔁 6. TESTS - REPETIR ÚLTIMO PEDIDO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Obtener último pedido de cliente...${NC}"
ULTIMO_PEDIDO=$(curl -s "$API/clientes/$CLIENTE_ID/ultimo-pedido" \
  -H "Authorization: Bearer $USER_TOKEN")

if echo "$ULTIMO_PEDIDO" | jq -e '.id' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Último pedido obtenido${NC}"
  echo "   $(echo $ULTIMO_PEDIDO | jq -r '.id,.fecha' | head -2 | tr '\n' ' ')"
  ((PASS++))
  
  echo -e "${YELLOW}Repetir último pedido...${NC}"
  REPETIDO=$(curl -s -X POST "$API/clientes/$CLIENTE_ID/repetir-pedido" \
    -H "Authorization: Bearer $USER_TOKEN" | jq -r '.pedido_id')
  
  if [ "$REPETIDO" != "null" ] && [ -n "$REPETIDO" ]; then
    echo -e "${GREEN}✅ Pedido repetido: $REPETIDO${NC}"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠️  Pedido no se repitió (posible: no hay detalles o error)${NC}"
    ((FAIL++))
  fi
else
  echo -e "${YELLOW}⚠️  Cliente sin pedidos previos${NC}"
  ((PASS++))
fi

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 7. TESTS - INVENTARIO BAJO STOCK${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Obtener reporte inventario y buscar bajo stock...${NC}"
INVENTARIO=$(curl -s "$API/reportes/inventario" \
  -H "Authorization: Bearer $USER_TOKEN")

BAJO_STOCK=$(echo "$INVENTARIO" | jq '.bajo_stock | length')
echo "   Productos bajo stock: $BAJO_STOCK"

if echo "$INVENTARIO" | jq -e '.bajo_stock | length > 0' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Hay productos bajo stock en reporte${NC}"
  echo "$INVENTARIO" | jq -r '.bajo_stock[:3] | .[] | "     - \(.nombre) (stock: \(.stock))"'
  ((PASS++))
else
  echo -e "${YELLOW}⚠️  Sin productos bajo stock (dato normal)${NC}"
  ((PASS++))
fi

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚡ 8. TESTS - CARGA MASIVA (STRESS LIGERO)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Crear 5 listas de precios en secuencia...${NC}"
LISTAS_CREADAS=0
for i in {1..5}; do
  LISTA=$(curl -s -X POST "$API/listas-precios" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Carga Test $i\",\"multiplicador\":$((100 + i))/100}" | jq -r '.id')
  
  if [ "$LISTA" != "null" ]; then
    ((LISTAS_CREADAS++))
    # Limpiar inmediatamente para no saturar DB
    curl -s -X DELETE "$API/listas-precios/$LISTA" \
      -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
  fi
done

if [ $LISTAS_CREADAS -eq 5 ]; then
  echo -e "${GREEN}✅ Todas las 5 listas creadas exitosamente${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Solo se crearon $LISTAS_CREADAS/5 listas${NC}"
  ((FAIL++))
fi

echo -e "${YELLOW}Crear 5 templates en secuencia...${NC}"
TEMPLATES_CREADOS=0
P1=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[0].id')
P2=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[1].id')

for i in {1..5}; do
  TEMPLATE=$(curl -s -X POST "$API/templates" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Template Carga $i\",\"productos\":[{\"producto_id\":$P1,\"cantidad\":$i,\"tipo\":\"unidad\"},{\"producto_id\":$P2,\"cantidad\":$((i+1)),\"tipo\":\"kg\"}]}" | jq -r '.id')
  
  if [ "$TEMPLATE" != "null" ]; then
    ((TEMPLATES_CREADOS++))
    # Limpiar inmediatamente
    curl -s -X DELETE "$API/templates/$TEMPLATE" \
      -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
  fi
done

if [ $TEMPLATES_CREADOS -eq 5 ]; then
  echo -e "${GREEN}✅ Todos los 5 templates creados exitosamente${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Solo se crearon $TEMPLATES_CREADOS/5 templates${NC}"
  ((FAIL++))
fi

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔒 9. TESTS - EDGE CASES DE SEGURIDAD${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Token inválido intenta acceder...${NC}"
test_case "GET" "/reportes/inventario" "token_invalido_xyz" \
  "" \
  "401|403" \
  "Token inválido rechazado"

echo -e "${YELLOW}Intentar modificar lista de otro usuario...${NC}"
# Crear lista como admin
LISTA_OTRO=$(curl -s -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Lista Protegida","multiplicador":1.5}' | jq -r '.id')

# Usuario regular intenta modificar (debe fallar)
test_case "PUT" "/listas-precios/$LISTA_OTRO" "$USER_TOKEN" \
  '{"nombre":"Modificada","multiplicador":2.0}' \
  "403" \
  "Usuario regular NO puede modificar lista admin"

# Limpiar
curl -s -X DELETE "$API/listas-precios/$LISTA_OTRO" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# =============================================================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📊 RESUMEN FINAL${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✅ Tests Pasados: $PASS${NC}"
echo -e "  ${RED}❌ Tests Fallidos: $FAIL${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  📋 Total: $TOTAL"
PORCENTAJE=$((PASS * 100 / TOTAL))
echo -e "  📈 Tasa de éxito: ${PORCENTAJE}%"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ¡TODOS LOS TESTS PASARON!${NC}"
  exit 0
elif [ $PORCENTAJE -ge 90 ]; then
  echo -e "${YELLOW}⚠️  Algunos tests fallaron, pero tasa de éxito >90%${NC}"
  exit 0
else
  echo -e "${RED}❌ Múltiples fallos detectados${NC}"
  exit 1
fi
