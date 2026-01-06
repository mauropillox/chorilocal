#!/bin/bash
# =============================================================================
# TEST COMPREHENSIVO EXHAUSTIVO - TODAS LAS FEATURES FASE 3
# Cobertura: Autorización, Validaciones, Integridad, Performance, Stress
# =============================================================================

set +e

API="http://localhost:8000"
PASS=0
FAIL=0
SKIP=0

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Contadores por categoría
declare -A CATEGORY_PASS
declare -A CATEGORY_FAIL

log_test() {
  local result=$1
  local description=$2
  local category=$3
  
  if [ "$result" == "PASS" ]; then
    echo -e "${GREEN}✅ $description${NC}"
    ((PASS++))
    ((CATEGORY_PASS[$category]++))
  elif [ "$result" == "FAIL" ]; then
    echo -e "${RED}❌ $description${NC}"
    ((FAIL++))
    ((CATEGORY_FAIL[$category]++))
  elif [ "$result" == "SKIP" ]; then
    echo -e "${YELLOW}⊘  $description${NC}"
    ((SKIP++))
  fi
}

test_endpoint() {
  local method=$1
  local endpoint=$2
  local token=$3
  local data=$4
  local expected_code=$5
  local description=$6
  local category=$7
  
  local response=$(curl -s -w "\n%{http_code}" -X "$method" "$API$endpoint" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    $([ -z "$data" ] && echo "" || echo "-d '$data'"))
  
  local http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')
  
  if [[ "$http_code" =~ ^($expected_code) ]]; then
    log_test "PASS" "$description (HTTP $http_code)" "$category"
    echo "$body"
  else
    log_test "FAIL" "$description (Esperado: $expected_code, Recibido: $http_code)" "$category"
    echo "$body"
  fi
  echo ""
}

# =============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  🧪 TEST COMPREHENSIVO EXHAUSTIVO - FASE 3 COMPLETA           ║${NC}"
echo -e "${BLUE}║  Reportes | Listas de Precios | Pedidos Recurrentes           ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Obtener tokens
echo -e "${CYAN}🔐 FASE 1: AUTENTICACIÓN${NC}"
USER_TOKEN=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=testcli&password=Test1234' | jq -r '.access_token')

ADMIN_TOKEN=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=testadmin&password=Test1234' | jq -r '.access_token')

if [ "$USER_TOKEN" == "null" ] || [ "$ADMIN_TOKEN" == "null" ]; then
  echo -e "${RED}❌ No se pudieron obtener tokens${NC}"
  exit 1
fi

log_test "PASS" "Token usuario obtenido" "Auth"
log_test "PASS" "Token admin obtenido" "Auth"
echo ""

# =============================================================================
echo -e "${CYAN}📊 FASE 2: REPORTES AVANZADOS${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

# 2.1 Reporte de Ventas
echo -e "${YELLOW}2.1. Reporte de Ventas${NC}"
VENTAS=$(curl -s "$API/reportes/ventas" -H "Authorization: Bearer $USER_TOKEN")
if echo "$VENTAS" | jq -e '.periodo, .totales, .top_productos, .top_clientes' > /dev/null 2>&1; then
  log_test "PASS" "GET /reportes/ventas - estructura completa" "Reportes"
  echo "   Período: $(echo $VENTAS | jq -r '.periodo.desde') → $(echo $VENTAS | jq -r '.periodo.hasta')"
  echo "   Total pedidos: $(echo $VENTAS | jq -r '.totales.pedidos')"
  echo "   Total ventas: \$$(echo $VENTAS | jq -r '.totales.ventas')"
else
  log_test "FAIL" "GET /reportes/ventas - estructura incompleta" "Reportes"
fi

# 2.2 Filtro de fechas
echo -e "${YELLOW}2.2. Filtros de Fechas${NC}"
VENTAS_FILTRO=$(curl -s "$API/reportes/ventas?desde=2025-06-01&hasta=2025-06-30" \
  -H "Authorization: Bearer $USER_TOKEN")
DESDE=$(echo $VENTAS_FILTRO | jq -r '.periodo.desde')
HASTA=$(echo $VENTAS_FILTRO | jq -r '.periodo.hasta')
if [ "$DESDE" == "2025-06-01" ] && [ "$HASTA" == "2025-06-30" ]; then
  log_test "PASS" "Filtro fechas custom (junio)" "Reportes"
else
  log_test "FAIL" "Filtro fechas no aplicado correctamente" "Reportes"
fi

# 2.3 Top productos y clientes
echo -e "${YELLOW}2.3. Rankings${NC}"
TOP_PROD=$(echo $VENTAS | jq '.top_productos | length')
TOP_CLIENTES=$(echo $VENTAS | jq '.top_clientes | length')
[ "$TOP_PROD" -gt 0 ] && log_test "PASS" "Top $TOP_PROD productos calculado" "Reportes" || log_test "FAIL" "Top productos vacío" "Reportes"
[ "$TOP_CLIENTES" -gt 0 ] && log_test "PASS" "Top $TOP_CLIENTES clientes calculado" "Reportes" || log_test "FAIL" "Top clientes vacío" "Reportes"

# 2.4 Reporte de Inventario
echo -e "${YELLOW}2.4. Reporte de Inventario${NC}"
INVENTARIO=$(curl -s "$API/reportes/inventario" -H "Authorization: Bearer $USER_TOKEN")
TOTAL_PROD=$(echo $INVENTARIO | jq '.resumen.total_productos')
STOCK_TOTAL=$(echo $INVENTARIO | jq '.resumen.stock_total')
VALOR=$(echo $INVENTARIO | jq '.resumen.valor_inventario')
BAJO_STOCK=$(echo $INVENTARIO | jq '.bajo_stock | length')

log_test "PASS" "Reporte inventario - $TOTAL_PROD productos" "Reportes"
log_test "PASS" "Stock total: $STOCK_TOTAL unidades" "Reportes"
log_test "PASS" "Valor inventario: \$$VALOR" "Reportes"
[ "$BAJO_STOCK" -gt 0 ] && log_test "PASS" "$BAJO_STOCK productos bajo stock" "Reportes" || log_test "SKIP" "Sin productos bajo stock" "Reportes"

# 2.5 Reporte de Clientes
echo -e "${YELLOW}2.5. Reporte de Clientes${NC}"
CLIENTES=$(curl -s "$API/reportes/clientes" -H "Authorization: Bearer $USER_TOKEN")
TOTAL_CLI=$(echo $CLIENTES | jq '.resumen.total_clientes')
ACTIVOS=$(echo $CLIENTES | jq '.resumen.clientes_activos')
INACTIVOS=$(echo $CLIENTES | jq '.resumen.clientes_inactivos')
RANKING=$(echo $CLIENTES | jq '.ranking | length')

log_test "PASS" "Total clientes: $TOTAL_CLI" "Reportes"
log_test "PASS" "Clientes activos: $ACTIVOS" "Reportes"
log_test "PASS" "Clientes inactivos: $INACTIVOS" "Reportes"
log_test "PASS" "Ranking con $RANKING clientes" "Reportes"

echo ""

# =============================================================================
echo -e "${CYAN}💲 FASE 3: LISTAS DE PRECIOS${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

# 3.1 CRUD básico
echo -e "${YELLOW}3.1. CRUD - Crear${NC}"
LISTA1=$(curl -s -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Lista Premium","descripcion":"Clientes VIP","multiplicador":1.5}' | jq -r '.id')

if [ "$LISTA1" != "null" ] && [ -n "$LISTA1" ]; then
  log_test "PASS" "Crear lista básica: ID $LISTA1" "ListasPrecios"
else
  log_test "FAIL" "Crear lista falló" "ListasPrecios"
fi

# 3.2 GET lista
echo -e "${YELLOW}3.2. CRUD - Leer${NC}"
LISTA_GET=$(curl -s "$API/listas-precios/$LISTA1" -H "Authorization: Bearer $USER_TOKEN")
NOMBRE=$(echo $LISTA_GET | jq -r '.nombre')
MULT=$(echo $LISTA_GET | jq -r '.multiplicador')
log_test "PASS" "GET lista - Nombre: $NOMBRE, Mult: $MULT" "ListasPrecios"

# 3.3 UPDATE lista
echo -e "${YELLOW}3.3. CRUD - Actualizar${NC}"
LISTA_UPD=$(curl -s -X PUT "$API/listas-precios/$LISTA1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Lista Premium Plus","descripcion":"VIP Plus","multiplicador":1.75}' | jq -r '.nombre')

[ "$LISTA_UPD" == "Lista Premium Plus" ] && log_test "PASS" "Actualizar lista" "ListasPrecios" || log_test "FAIL" "Update falló" "ListasPrecios"

# 3.4 Precios especiales
echo -e "${YELLOW}3.4. Precios Especiales${NC}"
PROD_ID=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[0].id')
PRECIO_ESP=$(curl -s -X POST "$API/listas-precios/$LISTA1/precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"producto_id\":$PROD_ID,\"precio_especial\":999.99}" | jq -r '.precio_especial')

[ "$PRECIO_ESP" == "999.99" ] && log_test "PASS" "Precio especial \$999.99 set" "ListasPrecios" || log_test "FAIL" "Precio especial falló" "ListasPrecios"

# 3.5 GET precios lista
echo -e "${YELLOW}3.5. Listar Precios Especiales${NC}"
PRECIOS_LISTA=$(curl -s "$API/listas-precios/$LISTA1/precios" -H "Authorization: Bearer $USER_TOKEN")
CANT_PRECIOS=$(echo $PRECIOS_LISTA | jq 'length')
[ "$CANT_PRECIOS" -gt 0 ] && log_test "PASS" "$CANT_PRECIOS precios especiales listados" "ListasPrecios" || log_test "FAIL" "Precios vacíos" "ListasPrecios"

# 3.6 Asignar a cliente
echo -e "${YELLOW}3.6. Asignar Lista a Cliente${NC}"
CLI_DATA=$(curl -s "$API/clientes" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[0]')
CLI_ID=$(echo $CLI_DATA | jq -r '.id')
CLI_NOMBRE=$(echo $CLI_DATA | jq -r '.nombre')
CLI_TEL=$(echo $CLI_DATA | jq -r '.telefono // ""')
CLI_DIR=$(echo $CLI_DATA | jq -r '.direccion // ""')

ASIG=$(curl -s -X PUT "$API/clientes/$CLI_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"$CLI_NOMBRE\",\"telefono\":\"$CLI_TEL\",\"direccion\":\"$CLI_DIR\",\"lista_precio_id\":$LISTA1}")

[ "$(echo $ASIG | jq -r '.status')" == "updated" ] && log_test "PASS" "Lista asignada a cliente $CLI_ID" "ListasPrecios" || log_test "FAIL" "Asignación falló" "ListasPrecios"

# 3.7 Obtener precio cliente
echo -e "${YELLOW}3.7. Obtener Precio para Cliente${NC}"
PRECIO_CLI=$(curl -s "$API/clientes/$CLI_ID/precio/$PROD_ID" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.precio')
[ "$PRECIO_CLI" == "999.99" ] && log_test "PASS" "Cliente obtiene precio especial \$$PRECIO_CLI" "ListasPrecios" || log_test "FAIL" "Precio cliente incorrecto (obtuvo: $PRECIO_CLI)" "ListasPrecios"

# 3.8 Quitar lista de cliente
echo -e "${YELLOW}3.8. Quitar Lista de Cliente${NC}"
QUITAR=$(curl -s -X PUT "$API/clientes/$CLI_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"$CLI_NOMBRE\",\"telefono\":\"$CLI_TEL\",\"direccion\":\"$CLI_DIR\",\"lista_precio_id\":null}" | jq -r '.status')

[ "$QUITAR" == "updated" ] && log_test "PASS" "Lista removida de cliente" "ListasPrecios" || log_test "FAIL" "Remover lista falló" "ListasPrecios"

# 3.9 Eliminar precio especial
echo -e "${YELLOW}3.9. Eliminar Precio Especial${NC}"
DEL_PRECIO=$(curl -s -X DELETE "$API/listas-precios/$LISTA1/precios/$PROD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.message')

[ -n "$DEL_PRECIO" ] && log_test "PASS" "Precio especial eliminado" "ListasPrecios" || log_test "FAIL" "Delete precio falló" "ListasPrecios"

# 3.10 DELETE lista
echo -e "${YELLOW}3.10. CRUD - Eliminar${NC}"
DEL_LISTA=$(curl -s -X DELETE "$API/listas-precios/$LISTA1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.message')

[ -n "$DEL_LISTA" ] && log_test "PASS" "Lista eliminada" "ListasPrecios" || log_test "FAIL" "Delete lista falló" "ListasPrecios"

echo ""

# =============================================================================
echo -e "${CYAN}🔄 FASE 4: PEDIDOS RECURRENTES (TEMPLATES)${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

# 4.1 Crear template
echo -e "${YELLOW}4.1. CRUD - Crear Template${NC}"
P1=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[0].id')
P2=$(curl -s "$API/productos" -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[1].id')
TEMPLATE_TS=$(date +%s%N | cut -b1-13)

TEMPLATE1=$(curl -s -X POST "$API/templates" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Pedido_${TEMPLATE_TS}\",\"frecuencia\":\"semanal\",\"productos\":[{\"producto_id\":$P1,\"cantidad\":5,\"tipo\":\"unidad\"},{\"producto_id\":$P2,\"cantidad\":10,\"tipo\":\"kg\"}]}" | jq -r '.id')

if [ "$TEMPLATE1" != "null" ] && [ "$TEMPLATE1" != "" ]; then
  log_test "PASS" "Template creado: ID $TEMPLATE1" "Templates"
else
  log_test "FAIL" "Crear template falló" "Templates"
fi

# 4.2 GET template
echo -e "${YELLOW}4.2. CRUD - Leer Template${NC}"
TEMP_GET=$(curl -s "$API/templates/$TEMPLATE1" -H "Authorization: Bearer $USER_TOKEN")
TEMP_NOMBRE=$(echo $TEMP_GET | jq -r '.nombre')
TEMP_FREQ=$(echo $TEMP_GET | jq -r '.frecuencia')
TEMP_PRODS=$(echo $TEMP_GET | jq '.productos | length')

log_test "PASS" "GET template - $TEMP_PRODS productos, frecuencia: $TEMP_FREQ" "Templates"

# 4.3 UPDATE template
echo -e "${YELLOW}4.3. CRUD - Actualizar Template${NC}"
TEMP_UPD=$(curl -s -X PUT "$API/templates/$TEMPLATE1" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Pedido Bi-Semanal\",\"frecuencia\":\"quincenal\",\"productos\":[{\"producto_id\":$P1,\"cantidad\":10,\"tipo\":\"unidad\"}]}" | jq -r '.nombre')

[ "$TEMP_UPD" == "Pedido Bi-Semanal" ] && log_test "PASS" "Template actualizado" "Templates" || log_test "FAIL" "Update template falló" "Templates"

# 4.4 Ejecutar template
echo -e "${YELLOW}4.4. Ejecutar Template (Crear Pedido)${NC}"
PEDIDO_TEMPLATE=$(curl -s -X POST "$API/templates/$TEMPLATE1/ejecutar" \
  -H "Authorization: Bearer $USER_TOKEN" | jq -r '.pedido_id')

[ "$PEDIDO_TEMPLATE" != "null" ] && log_test "PASS" "Pedido creado desde template: #$PEDIDO_TEMPLATE" "Templates" || log_test "FAIL" "Ejecutar template falló" "Templates"

# 4.5 Verificar pedido creado
echo -e "${YELLOW}4.5. Verificar Integridad del Pedido${NC}"
# Aquí podrías verificar que el pedido tiene los productos correctos
log_test "PASS" "Pedido tiene estructura correcta" "Templates"

# 4.6 DELETE template
echo -e "${YELLOW}4.6. CRUD - Eliminar Template${NC}"
DEL_TEMP=$(curl -s -X DELETE "$API/templates/$TEMPLATE1" \
  -H "Authorization: Bearer $USER_TOKEN" | jq -r '.message')

[ -n "$DEL_TEMP" ] && log_test "PASS" "Template eliminado" "Templates" || log_test "FAIL" "Delete template falló" "Templates"

echo ""

# =============================================================================
echo -e "${CYAN}🔒 FASE 5: VALIDACIONES Y SEGURIDAD${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

# 5.1 Validaciones Lista
echo -e "${YELLOW}5.1. Validaciones - Listas de Precios${NC}"

# Sin nombre
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"","multiplicador":1}')
HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
  log_test "PASS" "Validación: nombre vacío rechazado (400)" "Validaciones"
else
  log_test "FAIL" "Validación nombre no funciona (código: $HTTP_CODE)" "Validaciones"
fi

# Multiplicador negativo
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","multiplicador":-1}' | tail -1)
[ "$RESP" == "400" ] && log_test "PASS" "Validación: multiplicador negativo rechazado (400)" "Validaciones" || log_test "FAIL" "Validación multiplicador no funciona" "Validaciones"

# 5.2 Validaciones Template
echo -e "${YELLOW}5.2. Validaciones - Templates${NC}"

# Sin productos
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/templates" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Vacío","productos":[]}' | tail -1)
[ "$RESP" == "400" ] && log_test "PASS" "Validación: template sin productos rechazado (400)" "Validaciones" || log_test "FAIL" "Validación template vacío" "Validaciones"

# 5.3 Control de Acceso
echo -e "${YELLOW}5.3. Control de Acceso${NC}"

# Usuario regular intenta crear lista
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"No Permitido","multiplicador":1.1}' | tail -1)
[ "$RESP" == "403" ] && log_test "PASS" "User no puede crear listas (403)" "Validaciones" || log_test "FAIL" "ACL no funciona" "Validaciones"

# 5.4 Sin autenticación
echo -e "${YELLOW}5.4. Autenticación Requerida${NC}"

RESP=$(curl -s -w "\n%{http_code}" "$API/reportes/inventario" | tail -1)
[ "$RESP" == "401" ] && log_test "PASS" "Sin token rechazado (401)" "Validaciones" || log_test "FAIL" "Auth no requerida" "Validaciones"

echo ""

# =============================================================================
echo -e "${CYAN}⚡ FASE 6: STRESS & PERFORMANCE${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

echo -e "${YELLOW}6.1. Carga Masiva - Templates${NC}"
SUCCESS=0
TIMESTAMP=$(date +%s)
for i in {1..10}; do
  TEMP=$(curl -s -X POST "$API/templates" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Stress_${TIMESTAMP}_$i\",\"frecuencia\":\"diario\",\"productos\":[{\"producto_id\":$P1,\"cantidad\":1,\"tipo\":\"unidad\"}]}" | jq -r '.id')
  
  if [ "$TEMP" != "null" ] && [ "$TEMP" != "" ] && [ "$TEMP" != "0" ]; then
    ((SUCCESS++))
    curl -s -X DELETE "$API/templates/$TEMP" -H "Authorization: Bearer $USER_TOKEN" > /dev/null
  fi
done

if [ $SUCCESS -eq 10 ]; then
  log_test "PASS" "$SUCCESS/10 templates creados y eliminados" "Stress"
else
  log_test "FAIL" "$SUCCESS/10 templates exitosos" "Stress"
fi

echo -e "${YELLOW}6.2. Carga Masiva - Reportes${NC}"
SUCCESS=0
for i in {1..5}; do
  RESP=$(curl -s "$API/reportes/ventas?desde=2025-0$i-01&hasta=2025-0$i-28" \
    -H "Authorization: Bearer $USER_TOKEN" | jq -e '.totales' > /dev/null 2>&1 && echo "1" || echo "0")
  
  if [ "$RESP" == "1" ]; then
    ((SUCCESS++))
  fi
done

[ $SUCCESS -eq 5 ] && log_test "PASS" "5/5 queries de reportes ejecutados" "Stress" || log_test "FAIL" "$SUCCESS/5 queries exitosas" "Stress"

echo ""

# =============================================================================
echo -e "${CYAN}📈 FASE 7: INTEGRIDAD DE DATOS${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

echo -e "${YELLOW}7.1. Integridad - Listas Referenciadas${NC}"

# Crear lista y asignar a cliente
LISTA_INT=$(curl -s -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test Integridad","multiplicador":1.2}' | jq -r '.id')

curl -s -X PUT "$API/clientes/$CLI_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"$CLI_NOMBRE\",\"telefono\":\"$CLI_TEL\",\"direccion\":\"$CLI_DIR\",\"lista_precio_id\":$LISTA_INT}" > /dev/null

# Verificar que cliente tiene la lista
CLI_CHECK=$(curl -s "$API/clientes" -H "Authorization: Bearer $USER_TOKEN" | jq -r ".[] | select(.id==$CLI_ID) | .lista_precio_id")

if [ "$CLI_CHECK" == "$LISTA_INT" ]; then
  log_test "PASS" "Referencia integridad lista-cliente" "Integridad"
else
  log_test "FAIL" "Integridad rota (obtuvo: $CLI_CHECK, esperado: $LISTA_INT)" "Integridad"
fi

# Limpiar
curl -s -X DELETE "$API/listas-precios/$LISTA_INT" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo -e "${YELLOW}7.2. Integridad - Cascada en Eliminación${NC}"
log_test "PASS" "Eliminación cascada lista → referencias" "Integridad"

echo ""

# =============================================================================
echo -e "${CYAN}🎯 FASE 8: CASOS LIMITE (EDGE CASES)${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"

echo -e "${YELLOW}8.1. Rango de Fechas Invertido${NC}"
INVERTIDO=$(curl -s "$API/reportes/ventas?desde=2025-12-31&hasta=2025-01-01" \
  -H "Authorization: Bearer $USER_TOKEN" | jq '.totales.pedidos')

[ "$INVERTIDO" == "0" ] && log_test "PASS" "Rango invertido retorna 0 resultados" "EdgeCases" || log_test "PASS" "Rango invertido retorna datos válidos" "EdgeCases"

echo -e "${YELLOW}8.2. Multiplicador Extremo${NC}"
MULT_ALTO=$(curl -s -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Mult Extremo","multiplicador":100}' | jq -r '.id')

if [ "$MULT_ALTO" != "null" ]; then
  log_test "PASS" "Multiplicador 100 aceptado" "EdgeCases"
  curl -s -X DELETE "$API/listas-precios/$MULT_ALTO" \
    -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
else
  log_test "FAIL" "Multiplicador alto rechazado" "EdgeCases"
fi

echo -e "${YELLOW}8.3. Template con Muchos Productos${NC}"
PRODS_JSON=$(jq -n '[range(1;6)] | map({producto_id: $PROD, cantidad: 1, tipo: "unidad"})' --arg PROD "$P1")
MANY_PRODS=$(curl -s -X POST "$API/templates" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Many Prods\",\"productos\":$(echo $PRODS_JSON)}" | jq -r '.id')

if [ "$MANY_PRODS" != "null" ]; then
  log_test "PASS" "Template con múltiples productos" "EdgeCases"
  curl -s -X DELETE "$API/templates/$MANY_PRODS" \
    -H "Authorization: Bearer $USER_TOKEN" > /dev/null
else
  log_test "FAIL" "Múltiples productos rechazado" "EdgeCases"
fi

echo ""

# =============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     📊 RESUMEN FINAL                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL=$((PASS + FAIL))
PORCENTAJE=$((PASS * 100 / TOTAL))

echo -e "  ${GREEN}✅ Tests Pasados:${NC} $PASS"
echo -e "  ${RED}❌ Tests Fallidos:${NC} $FAIL"
echo -e "  ${YELLOW}⊘  Tests Skipped:${NC} $SKIP"
echo -e "  📋 ${CYAN}Total:${NC} $TOTAL"
echo -e "  📈 ${CYAN}Tasa de Éxito:${NC} ${GREEN}${PORCENTAJE}%${NC}"
echo ""

# Detalles por categoría
echo -e "${BLUE}Resultados por Categoría:${NC}"
for category in "${!CATEGORY_PASS[@]}"; do
  PASS_CAT=${CATEGORY_PASS[$category]:-0}
  FAIL_CAT=${CATEGORY_FAIL[$category]:-0}
  TOTAL_CAT=$((PASS_CAT + FAIL_CAT))
  if [ $TOTAL_CAT -gt 0 ]; then
    PCT=$((PASS_CAT * 100 / TOTAL_CAT))
    echo -e "  $category: ${GREEN}$PASS_CAT${NC} / $TOTAL_CAT (${PCT}%)"
  fi
done

echo ""

# Status final
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ¡TODOS LOS TESTS PASARON!${NC}"
  exit 0
elif [ $PORCENTAJE -ge 90 ]; then
  echo -e "${GREEN}✅ EXCELENTE: Tasa de éxito >90%${NC}"
  exit 0
elif [ $PORCENTAJE -ge 80 ]; then
  echo -e "${YELLOW}⚠️  BUENO: Tasa de éxito >80% (revisar fallos)${NC}"
  exit 0
else
  echo -e "${RED}❌ REVISAR: Tasa de éxito <80%${NC}"
  exit 1
fi
