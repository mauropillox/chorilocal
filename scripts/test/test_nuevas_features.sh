#!/bin/bash
# =============================================================================
# TEST EXHAUSTIVO - NUEVAS FEATURES
# Listas de Precios, Reportes Avanzados, Pedidos Recurrentes
# =============================================================================

API="http://localhost:8000"
PASS=0
FAIL=0

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  🧪 TEST EXHAUSTIVO - NUEVAS FEATURES${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Obtener token
echo -e "${YELLOW}🔑 Obteniendo token de autenticación...${NC}"
TOKEN=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=testcli&password=Test1234' | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ ERROR: No se pudo obtener token usuario${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Token usuario obtenido${NC}"

# Obtener token admin para operaciones que requieren admin
ADMIN_TOKEN=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=admin&password=admin' | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${YELLOW}⚠️ No se pudo obtener token admin. Probando con testadmin...${NC}"
  ADMIN_TOKEN=$(curl -s -X POST "$API/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d 'username=testadmin&password=Test1234' | jq -r '.access_token')
fi

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${YELLOW}⚠️ Sin token admin. Tests de listas de precios limitados.${NC}"
  ADMIN_TOKEN=$TOKEN
else
  echo -e "${GREEN}✅ Token admin obtenido${NC}"
fi
echo ""

# Función para test
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expected=$4
  local description=$5
  
  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "$expected" ]; then
    echo -e "${GREEN}✅ $description${NC}"
    echo "   HTTP $http_code | ${body:0:80}..."
    ((PASS++))
    return 0
  else
    echo -e "${RED}❌ $description${NC}"
    echo "   Esperado: $expected | Recibido: $http_code"
    echo "   Body: ${body:0:100}"
    ((FAIL++))
    return 1
  fi
}

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 1. REPORTES AVANZADOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_endpoint "GET" "/reportes/ventas" "" "200" "GET /reportes/ventas (sin filtros)"
test_endpoint "GET" "/reportes/ventas?fecha_inicio=2025-01-01&fecha_fin=2025-12-31" "" "200" "GET /reportes/ventas (con fechas)"
test_endpoint "GET" "/reportes/inventario" "" "200" "GET /reportes/inventario"
test_endpoint "GET" "/reportes/clientes" "" "200" "GET /reportes/clientes"

# Verificar estructura de respuesta
echo ""
echo -e "${YELLOW}📋 Verificando estructura de reportes...${NC}"

ventas=$(curl -s "$API/reportes/ventas" -H "Authorization: Bearer $TOKEN")
if echo "$ventas" | jq -e '.totales, .por_dia, .top_productos, .top_clientes' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Estructura de reporte ventas correcta${NC}"
  echo "   total_ventas: $(echo $ventas | jq '.totales.total_ventas // .totales[1]')"
  echo "   total_pedidos: $(echo $ventas | jq '.totales.total_pedidos // .totales[0]')"
  echo "   top_productos: $(echo $ventas | jq '.top_productos | length') items"
  echo "   top_clientes: $(echo $ventas | jq '.top_clientes | length') items"
  ((PASS++))
else
  echo -e "${RED}❌ Estructura de reporte ventas incorrecta${NC}"
  echo "   Response: ${ventas:0:200}"
  ((FAIL++))
fi

inventario=$(curl -s "$API/reportes/inventario" -H "Authorization: Bearer $TOKEN")
if echo "$inventario" | jq -e '.resumen' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Estructura de reporte inventario correcta${NC}"
  echo "   total_productos: $(echo $inventario | jq '.resumen.total_productos')"
  echo "   stock_total: $(echo $inventario | jq '.resumen.stock_total')"
  echo "   valor_inventario: $(echo $inventario | jq '.resumen.valor_inventario')"
  echo "   bajo_stock: $(echo $inventario | jq '.bajo_stock | length') items"
  ((PASS++))
else
  echo -e "${RED}❌ Estructura de reporte inventario incorrecta${NC}"
  ((FAIL++))
fi

clientes=$(curl -s "$API/reportes/clientes" -H "Authorization: Bearer $TOKEN")
if echo "$clientes" | jq -e '.resumen' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Estructura de reporte clientes correcta${NC}"
  echo "   total_clientes: $(echo $clientes | jq '.resumen.total_clientes')"
  echo "   activos: $(echo $clientes | jq '.resumen.clientes_activos')"
  echo "   inactivos_count: $(echo $clientes | jq '.inactivos | length')"
  echo "   ranking: $(echo $clientes | jq '.ranking | length') items"
  ((PASS++))
else
  echo -e "${RED}❌ Estructura de reporte clientes incorrecta${NC}"
  ((FAIL++))
fi

# =============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💲 2. LISTAS DE PRECIOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET todas las listas
test_endpoint "GET" "/listas-precios" "" "200" "GET /listas-precios (listar todas)"

# Crear nueva lista (requiere admin)
echo ""
echo -e "${YELLOW}📝 Creando lista de precios de prueba (requiere admin)...${NC}"
create_response=$(curl -s -w "\n%{http_code}" -X POST "$API/listas-precios" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Lista Test CLI","descripcion":"Lista creada por test","multiplicador":1.15}')

http_code=$(echo "$create_response" | tail -1)
body=$(echo "$create_response" | sed '$d')
LISTA_ID=$(echo "$body" | jq -r '.id')

if [ "$http_code" == "200" ] && [ "$LISTA_ID" != "null" ]; then
  echo -e "${GREEN}✅ POST /listas-precios - Lista creada con ID: $LISTA_ID${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ POST /listas-precios - Error creando lista${NC}"
  echo "   HTTP: $http_code | Body: $body"
  ((FAIL++))
fi

# GET lista específica
if [ "$LISTA_ID" != "null" ] && [ -n "$LISTA_ID" ]; then
  test_endpoint "GET" "/listas-precios/$LISTA_ID" "" "200" "GET /listas-precios/$LISTA_ID"
  
  # Actualizar lista (requiere admin)
  update_resp=$(curl -s -w "\n%{http_code}" -X PUT "$API/listas-precios/$LISTA_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Lista Test CLI Actualizada","descripcion":"Descripcion actualizada","multiplicador":1.20}')
  http_code=$(echo "$update_resp" | tail -1)
  if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ PUT /listas-precios/$LISTA_ID${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ PUT /listas-precios/$LISTA_ID (HTTP $http_code)${NC}"
    ((FAIL++))
  fi
  
  # Obtener un producto para agregar precio especial
  PRODUCTO_ID=$(curl -s "$API/productos" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
  
  if [ "$PRODUCTO_ID" != "null" ] && [ -n "$PRODUCTO_ID" ]; then
    echo ""
    echo -e "${YELLOW}💰 Probando precios especiales...${NC}"
    
    # Agregar precio especial (admin)
    add_precio=$(curl -s -w "\n%{http_code}" -X POST "$API/listas-precios/$LISTA_ID/precios" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"producto_id\":$PRODUCTO_ID,\"precio_especial\":99.99}")
    http_code=$(echo "$add_precio" | tail -1)
    if [ "$http_code" == "200" ]; then
      echo -e "${GREEN}✅ POST precio especial (producto $PRODUCTO_ID)${NC}"
      ((PASS++))
    else
      echo -e "${RED}❌ POST precio especial (HTTP $http_code)${NC}"
      ((FAIL++))
    fi
    
    # Listar precios de la lista
    test_endpoint "GET" "/listas-precios/$LISTA_ID/precios" "" "200" "GET /listas-precios/$LISTA_ID/precios"
    
    # Eliminar precio especial (admin)
    del_precio=$(curl -s -w "\n%{http_code}" -X DELETE "$API/listas-precios/$LISTA_ID/precios/$PRODUCTO_ID" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    http_code=$(echo "$del_precio" | tail -1)
    if [ "$http_code" == "200" ]; then
      echo -e "${GREEN}✅ DELETE precio especial${NC}"
      ((PASS++))
    else
      echo -e "${RED}❌ DELETE precio especial (HTTP $http_code)${NC}"
      ((FAIL++))
    fi
  fi
  
  # Probar asignar lista a cliente
  CLIENTE_ID=$(curl -s "$API/clientes" -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id // .[0].id')
  
  if [ "$CLIENTE_ID" != "null" ] && [ -n "$CLIENTE_ID" ]; then
    echo ""
    echo -e "${YELLOW}👤 Probando asignación a cliente...${NC}"
    test_endpoint "PUT" "/clientes/$CLIENTE_ID/lista-precio" "{\"lista_id\":$LISTA_ID}" "200" "PUT asignar lista a cliente $CLIENTE_ID"
    
    # Probar obtener precio para cliente
    if [ "$PRODUCTO_ID" != "null" ]; then
      test_endpoint "GET" "/clientes/$CLIENTE_ID/precio/$PRODUCTO_ID" "" "200" "GET precio cliente/producto"
    fi
    
    # Quitar lista del cliente
    test_endpoint "PUT" "/clientes/$CLIENTE_ID/lista-precio" '{"lista_id":null}' "200" "PUT quitar lista de cliente"
  fi
  
  # Eliminar lista de prueba (admin)
  del_lista=$(curl -s -w "\n%{http_code}" -X DELETE "$API/listas-precios/$LISTA_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  http_code=$(echo "$del_lista" | tail -1)
  if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ DELETE /listas-precios/$LISTA_ID${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ DELETE /listas-precios/$LISTA_ID (HTTP $http_code)${NC}"
    ((FAIL++))
  fi
fi

# =============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 3. PEDIDOS RECURRENTES (TEMPLATES)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET todos los templates
test_endpoint "GET" "/templates" "" "200" "GET /templates (listar todos)"

# Obtener productos para el template
PRODUCTOS=$(curl -s "$API/productos" -H "Authorization: Bearer $TOKEN" | jq -r '[.[:3] | .[].id]')
P1=$(echo $PRODUCTOS | jq -r '.[0]')
P2=$(echo $PRODUCTOS | jq -r '.[1]')

if [ "$P1" != "null" ] && [ "$P2" != "null" ]; then
  echo ""
  echo -e "${YELLOW}📝 Creando template de prueba...${NC}"
  
  # Crear template
  create_template=$(curl -s -w "\n%{http_code}" -X POST "$API/templates" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Template Test CLI\",\"frecuencia\":\"semanal\",\"productos\":[{\"producto_id\":$P1,\"cantidad\":5,\"tipo\":\"unidad\"},{\"producto_id\":$P2,\"cantidad\":3,\"tipo\":\"kg\"}]}")
  
  http_code=$(echo "$create_template" | tail -1)
  body=$(echo "$create_template" | sed '$d')
  TEMPLATE_ID=$(echo "$body" | jq -r '.id')
  
  if [ "$http_code" == "200" ] && [ "$TEMPLATE_ID" != "null" ]; then
    echo -e "${GREEN}✅ POST /templates - Template creado con ID: $TEMPLATE_ID${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ POST /templates - Error creando template${NC}"
    echo "   HTTP: $http_code | Body: ${body:0:100}"
    ((FAIL++))
  fi
  
  if [ "$TEMPLATE_ID" != "null" ] && [ -n "$TEMPLATE_ID" ]; then
    # GET template específico
    test_endpoint "GET" "/templates/$TEMPLATE_ID" "" "200" "GET /templates/$TEMPLATE_ID"
    
    # Verificar estructura del template
    template_data=$(curl -s "$API/templates/$TEMPLATE_ID" -H "Authorization: Bearer $TOKEN")
    if echo "$template_data" | jq -e '.id, .nombre, .productos' > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Estructura de template correcta${NC}"
      echo "   nombre: $(echo $template_data | jq -r '.nombre')"
      echo "   frecuencia: $(echo $template_data | jq -r '.frecuencia')"
      echo "   productos: $(echo $template_data | jq '.productos | length') items"
      ((PASS++))
    else
      echo -e "${RED}❌ Estructura de template incorrecta${NC}"
      ((FAIL++))
    fi
    
    # Actualizar template
    test_endpoint "PUT" "/templates/$TEMPLATE_ID" "{\"nombre\":\"Template Test Actualizado\",\"frecuencia\":\"mensual\",\"productos\":[{\"producto_id\":$P1,\"cantidad\":10,\"tipo\":\"unidad\"}]}" "200" "PUT /templates/$TEMPLATE_ID"
    
    # Ejecutar template (crear pedido)
    echo ""
    echo -e "${YELLOW}▶️ Ejecutando template para crear pedido...${NC}"
    
    ejecutar_response=$(curl -s -w "\n%{http_code}" -X POST "$API/templates/$TEMPLATE_ID/ejecutar" \
      -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$ejecutar_response" | tail -1)
    body=$(echo "$ejecutar_response" | sed '$d')
    PEDIDO_ID=$(echo "$body" | jq -r '.pedido_id')
    
    if [ "$http_code" == "200" ] && [ "$PEDIDO_ID" != "null" ]; then
      echo -e "${GREEN}✅ POST /templates/$TEMPLATE_ID/ejecutar - Pedido creado: $PEDIDO_ID${NC}"
      ((PASS++))
    else
      echo -e "${RED}❌ POST /templates/$TEMPLATE_ID/ejecutar - Error${NC}"
      echo "   HTTP: $http_code | Body: ${body:0:100}"
      ((FAIL++))
    fi
    
    # Eliminar template
    test_endpoint "DELETE" "/templates/$TEMPLATE_ID" "" "200" "DELETE /templates/$TEMPLATE_ID"
  fi
fi

# Probar último pedido y repetir
echo ""
echo -e "${YELLOW}🔁 Probando repetir último pedido...${NC}"

if [ "$CLIENTE_ID" != "null" ] && [ -n "$CLIENTE_ID" ]; then
  # Obtener último pedido
  test_endpoint "GET" "/clientes/$CLIENTE_ID/ultimo-pedido" "" "200" "GET /clientes/$CLIENTE_ID/ultimo-pedido"
  
  # Repetir pedido (puede fallar si no hay pedido previo)
  echo -e "${YELLOW}   (repetir-pedido puede fallar si cliente no tiene pedidos)${NC}"
  repetir_response=$(curl -s -w "\n%{http_code}" -X POST "$API/clientes/$CLIENTE_ID/repetir-pedido" \
    -H "Authorization: Bearer $TOKEN")
  http_code=$(echo "$repetir_response" | tail -1)
  
  if [ "$http_code" == "200" ] || [ "$http_code" == "404" ]; then
    echo -e "${GREEN}✅ POST /clientes/$CLIENTE_ID/repetir-pedido (HTTP $http_code)${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ POST /clientes/$CLIENTE_ID/repetir-pedido (HTTP $http_code)${NC}"
    ((FAIL++))
  fi
fi

# =============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔒 4. TESTS DE SEGURIDAD${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Sin autenticación
echo -e "${YELLOW}Probando endpoints sin token...${NC}"

noauth_response=$(curl -s -w "\n%{http_code}" "$API/reportes/ventas")
http_code=$(echo "$noauth_response" | tail -1)
if [ "$http_code" == "401" ]; then
  echo -e "${GREEN}✅ /reportes/ventas requiere autenticación (401)${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ /reportes/ventas NO requiere autenticación (HTTP $http_code)${NC}"
  ((FAIL++))
fi

noauth_response=$(curl -s -w "\n%{http_code}" "$API/listas-precios")
http_code=$(echo "$noauth_response" | tail -1)
if [ "$http_code" == "401" ]; then
  echo -e "${GREEN}✅ /listas-precios requiere autenticación (401)${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ /listas-precios NO requiere autenticación (HTTP $http_code)${NC}"
  ((FAIL++))
fi

noauth_response=$(curl -s -w "\n%{http_code}" "$API/templates")
http_code=$(echo "$noauth_response" | tail -1)
if [ "$http_code" == "401" ]; then
  echo -e "${GREEN}✅ /templates requiere autenticación (401)${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ /templates NO requiere autenticación (HTTP $http_code)${NC}"
  ((FAIL++))
fi

# =============================================================================
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  📊 RESUMEN DE TESTS${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "  ${GREEN}✅ Pasados: $PASS${NC}"
echo -e "  ${RED}❌ Fallidos: $FAIL${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  📋 Total: $TOTAL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ¡TODOS LOS TESTS PASARON!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️ Algunos tests fallaron. Revisar logs.${NC}"
  exit 1
fi
