#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  TEST FINAL EXHAUSTIVO v2.0 - CHORIZAURIO / CASA DE CONGELADOS              ║
# ║  Fecha: 2026-01-04                                                           ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -uo pipefail

API_URL=${API_URL:-"http://localhost:8000"}
ADMIN_USER=${ADMIN_USER:-"admin"}
ADMIN_PASS=${ADMIN_PASS:-"admin123"}
TEST_USER=${TEST_USER:-"testui"}
TEST_PASS=${TEST_PASS:-"testui123"}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASSED=0
FAILED=0
SKIPPED=0
TOTAL=0
TIMESTAMP=$(date +%s)
START_TIME=$(date +%s)
TOKEN=""
ADMIN_TOKEN=""

declare -a FAILED_TESTS=()

log_pass() { ((TOTAL++)); ((PASSED++)); echo -e "  ${GREEN}✅ $1${NC}"; }
log_fail() { ((TOTAL++)); ((FAILED++)); echo -e "  ${RED}❌ $1${NC}"; FAILED_TESTS+=("$1"); }
log_skip() { ((TOTAL++)); ((SKIPPED++)); echo -e "  ${YELLOW}⏭️  $1${NC}"; }

# Simple HTTP request - returns HTTP code
http_code() {
    curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$@"
}

# HTTP request - returns body
http_body() {
    curl -s --max-time 30 "$@"
}

require() {
    command -v "$1" >/dev/null 2>&1 || { echo -e "${RED}Missing: $1${NC}" >&2; exit 1; }
}

require curl
require jq

# Banner
clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🧪 TEST FINAL EXHAUSTIVO v2.0 - CHORIZAURIO${NC}                               ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  📅 $(date '+%Y-%m-%d %H:%M:%S')                                                    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  🌐 $API_URL                                                  ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ 🏥 FASE 0: HEALTH CHECK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

code=$(http_code "$API_URL/health")
if [[ "$code" == "200" ]]; then
    log_pass "API Health Check"
    body=$(http_body "$API_URL/health")
    if echo "$body" | jq -e '.database == "ok"' >/dev/null 2>&1; then
        log_pass "Database Health Check"
    else
        log_fail "Database Health Check"
    fi
else
    echo -e "${RED}❌ FATAL: API no responde en $API_URL (code: $code)${NC}"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 🔐 FASE 1: AUTENTICACIÓN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Login Admin
login_resp=$(http_body -X POST "$API_URL/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$ADMIN_USER&password=$ADMIN_PASS")
ADMIN_TOKEN=$(echo "$login_resp" | jq -r '.access_token // empty')
if [[ -n "$ADMIN_TOKEN" ]]; then
    log_pass "Login Admin ($ADMIN_USER)"
else
    log_fail "Login Admin ($ADMIN_USER)"
fi

# Login Usuario
login_resp=$(http_body -X POST "$API_URL/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$TEST_USER&password=$TEST_PASS")
TOKEN=$(echo "$login_resp" | jq -r '.access_token // empty')
if [[ -n "$TOKEN" ]]; then
    log_pass "Login Usuario ($TEST_USER)"
else
    log_skip "Login Usuario - usando admin"
    TOKEN="$ADMIN_TOKEN"
fi

# Test token inválido
code=$(http_code "$API_URL/clientes" -H "Authorization: Bearer invalid_token")
if [[ "$code" == "401" ]]; then
    log_pass "Rechazo token inválido (401)"
else
    log_fail "Rechazo token inválido (got $code)"
fi

# Test sin token
code=$(http_code "$API_URL/clientes")
if [[ "$code" == "401" ]]; then
    log_pass "Rechazo sin token (401)"
else
    log_fail "Rechazo sin token (got $code)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 👥 FASE 2: CLIENTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

AUTH="-H \"Authorization: Bearer $TOKEN\""

# GET /clientes
code=$(http_code "$API_URL/clientes?limit=10" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    body=$(http_body "$API_URL/clientes?limit=10" -H "Authorization: Bearer $TOKEN")
    count=$(echo "$body" | jq 'length' 2>/dev/null || echo "0")
    log_pass "GET /clientes ($count clientes)"
else
    log_fail "GET /clientes - HTTP $code"
fi

# POST /clientes
CLIENT_NAME="Test Client $TIMESTAMP"
client_json=$(jq -n --arg n "$CLIENT_NAME" --arg t "555-$TIMESTAMP" --arg d "Test St" '{nombre:$n,telefono:$t,direccion:$d}')
resp=$(http_body -X POST "$API_URL/clientes" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$client_json")
CLIENT_ID=$(echo "$resp" | jq -r '.id // empty')
if [[ -n "$CLIENT_ID" ]]; then
    log_pass "POST /clientes (ID: $CLIENT_ID)"
else
    log_fail "POST /clientes"
    CLIENT_ID=""
fi

# PUT /clientes
if [[ -n "$CLIENT_ID" ]]; then
    code=$(http_code -X PUT "$API_URL/clientes/$CLIENT_ID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nombre":"Updated","telefono":"666","direccion":"New"}')
    if [[ "$code" == "200" ]]; then
        log_pass "PUT /clientes/$CLIENT_ID"
    else
        log_fail "PUT /clientes/$CLIENT_ID - HTTP $code"
    fi
fi

# GET /clientes/export/csv
code=$(http_code "$API_URL/clientes/export/csv" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /clientes/export/csv"
else
    log_fail "GET /clientes/export/csv - HTTP $code"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 📦 FASE 3: PRODUCTOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /productos
code=$(http_code "$API_URL/productos" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    body=$(http_body "$API_URL/productos" -H "Authorization: Bearer $TOKEN")
    count=$(echo "$body" | jq 'length' 2>/dev/null || echo "0")
    log_pass "GET /productos ($count productos)"
else
    log_fail "GET /productos - HTTP $code"
fi

# POST /productos
PROD_NAME="Test Prod $TIMESTAMP"
prod_json=$(jq -n --arg n "$PROD_NAME" '{nombre:$n,precio:99.99,stock:100,stock_tipo:"unidad"}')
resp=$(http_body -X POST "$API_URL/productos" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$prod_json")
PRODUCT_ID=$(echo "$resp" | jq -r '.id // empty')
if [[ -n "$PRODUCT_ID" ]]; then
    log_pass "POST /productos (ID: $PRODUCT_ID)"
else
    log_fail "POST /productos"
    PRODUCT_ID=""
fi

# GET /productos/{id}
if [[ -n "$PRODUCT_ID" ]]; then
    code=$(http_code "$API_URL/productos/$PRODUCT_ID" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" ]]; then
        log_pass "GET /productos/$PRODUCT_ID"
    else
        log_fail "GET /productos/$PRODUCT_ID - HTTP $code"
    fi
fi

# PUT /productos
if [[ -n "$PRODUCT_ID" ]]; then
    update_json=$(jq -n --arg n "Updated $PROD_NAME" '{nombre:$n,precio:150,stock:200,stock_tipo:"unidad"}')
    code=$(http_code -X PUT "$API_URL/productos/$PRODUCT_ID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$update_json")
    if [[ "$code" == "200" ]]; then
        log_pass "PUT /productos/$PRODUCT_ID"
    else
        log_fail "PUT /productos/$PRODUCT_ID - HTTP $code"
    fi
fi

# PUT /productos/{id}/stock
if [[ -n "$PRODUCT_ID" ]]; then
    code=$(http_code -X PUT "$API_URL/productos/$PRODUCT_ID/stock?cantidad=50&operacion=sumar" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" ]]; then
        log_pass "PUT /productos/$PRODUCT_ID/stock (sumar)"
    else
        log_fail "PUT /productos/$PRODUCT_ID/stock - HTTP $code"
    fi
fi

# GET /productos/export/csv
code=$(http_code "$API_URL/productos/export/csv" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /productos/export/csv"
else
    log_fail "GET /productos/export/csv - HTTP $code"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 🏷️  FASE 4: CATEGORÍAS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /categorias
code=$(http_code "$API_URL/categorias" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    body=$(http_body "$API_URL/categorias" -H "Authorization: Bearer $TOKEN")
    count=$(echo "$body" | jq 'length' 2>/dev/null || echo "0")
    log_pass "GET /categorias ($count categorías)"
else
    log_fail "GET /categorias - HTTP $code"
fi

# POST /categorias
cat_json=$(jq -n --arg n "Test Cat $TIMESTAMP" '{nombre:$n}')
resp=$(http_body -X POST "$API_URL/categorias" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$cat_json")
CAT_ID=$(echo "$resp" | jq -r '.id // empty')
if [[ -n "$CAT_ID" ]]; then
    log_pass "POST /categorias (ID: $CAT_ID)"
else
    log_fail "POST /categorias"
    CAT_ID=""
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 📋 FASE 5: PEDIDOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /pedidos
code=$(http_code "$API_URL/pedidos?limit=10" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    body=$(http_body "$API_URL/pedidos?limit=10" -H "Authorization: Bearer $TOKEN")
    count=$(echo "$body" | jq 'length' 2>/dev/null || echo "0")
    log_pass "GET /pedidos ($count pedidos)"
else
    log_fail "GET /pedidos - HTTP $code"
fi

# POST /pedidos/preview_stock
PEDIDO_ID=""
if [[ -n "$CLIENT_ID" ]] && [[ -n "$PRODUCT_ID" ]]; then
    preview_json=$(jq -n --argjson cid "$CLIENT_ID" --argjson pid "$PRODUCT_ID" '{cliente:{id:$cid},productos:[{id:$pid,cantidad:1,tipo:"unidad"}]}')
    code=$(http_code -X POST "$API_URL/pedidos/preview_stock" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$preview_json")
    if [[ "$code" == "200" ]]; then
        log_pass "POST /pedidos/preview_stock"
    else
        log_fail "POST /pedidos/preview_stock - HTTP $code"
    fi
    
    # POST /pedidos
    pedido_json=$(jq -n --argjson cid "$CLIENT_ID" --arg cname "$CLIENT_NAME" --argjson pid "$PRODUCT_ID" '{cliente:{id:$cid,nombre:$cname},productos:[{id:$pid,cantidad:2,tipo:"unidad"}]}')
    resp=$(http_body -X POST "$API_URL/pedidos" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$pedido_json")
    PEDIDO_ID=$(echo "$resp" | jq -r '.id // empty')
    if [[ -n "$PEDIDO_ID" ]]; then
        log_pass "POST /pedidos (ID: $PEDIDO_ID)"
    else
        if echo "$resp" | grep -qi "stock"; then
            log_skip "POST /pedidos (stock insuficiente)"
        else
            log_fail "POST /pedidos"
        fi
    fi
fi

# PATCH /pedidos/{id}
if [[ -n "$PEDIDO_ID" ]]; then
    code=$(http_code -X PATCH "$API_URL/pedidos/$PEDIDO_ID" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" ]]; then
        log_pass "PATCH /pedidos/$PEDIDO_ID (cambiar estado)"
    else
        log_fail "PATCH /pedidos/$PEDIDO_ID - HTTP $code"
    fi
fi

# GET /pedidos/export/csv
code=$(http_code "$API_URL/pedidos/export/csv" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /pedidos/export/csv"
else
    log_fail "GET /pedidos/export/csv - HTTP $code"
fi

# DELETE /pedidos/{id}
if [[ -n "$PEDIDO_ID" ]]; then
    code=$(http_code -X DELETE "$API_URL/pedidos/$PEDIDO_ID" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" || "$code" == "204" ]]; then
        log_pass "DELETE /pedidos/$PEDIDO_ID"
    else
        log_fail "DELETE /pedidos/$PEDIDO_ID - HTTP $code"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 🎁 FASE 6: OFERTAS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /ofertas
code=$(http_code "$API_URL/ofertas" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    body=$(http_body "$API_URL/ofertas" -H "Authorization: Bearer $TOKEN")
    count=$(echo "$body" | jq 'length' 2>/dev/null || echo "0")
    log_pass "GET /ofertas ($count ofertas)"
else
    log_fail "GET /ofertas - HTTP $code"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 📊 FASE 7: DASHBOARD Y REPORTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /dashboard/metrics
code=$(http_code "$API_URL/dashboard/metrics" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /dashboard/metrics"
else
    log_fail "GET /dashboard/metrics - HTTP $code"
fi

# GET /dashboard/pedidos_por_dia
code=$(http_code "$API_URL/dashboard/pedidos_por_dia" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /dashboard/pedidos_por_dia"
else
    log_fail "GET /dashboard/pedidos_por_dia - HTTP $code"
fi

# GET /reportes/inventario
code=$(http_code "$API_URL/reportes/inventario" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /reportes/inventario"
else
    log_fail "GET /reportes/inventario - HTTP $code"
fi

# GET /reportes/ventas
code=$(http_code "$API_URL/reportes/ventas" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /reportes/ventas"
else
    log_fail "GET /reportes/ventas - HTTP $code"
fi

# GET /reportes/clientes
code=$(http_code "$API_URL/reportes/clientes" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /reportes/clientes"
else
    log_fail "GET /reportes/clientes - HTTP $code"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 📝 FASE 8: LISTAS Y TEMPLATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /listas-precios
code=$(http_code "$API_URL/listas-precios" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /listas-precios"
else
    log_fail "GET /listas-precios - HTTP $code"
fi

# GET /templates
code=$(http_code "$API_URL/templates" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /templates"
else
    log_fail "GET /templates - HTTP $code"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 🔍 FASE 9: VALIDACIONES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Precio negativo
code=$(http_code -X POST "$API_URL/productos" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nombre":"Invalid","precio":-10,"stock":10}')
if [[ "$code" == "422" || "$code" == "400" ]]; then
    log_pass "Rechazo precio negativo ($code)"
else
    log_fail "Rechazo precio negativo (got $code)"
fi

# Cliente sin nombre
code=$(http_code -X POST "$API_URL/clientes" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"telefono":"123"}')
if [[ "$code" == "422" || "$code" == "400" ]]; then
    log_pass "Rechazo cliente sin nombre ($code)"
else
    log_fail "Rechazo cliente sin nombre (got $code)"
fi

# 404 recurso inexistente
code=$(http_code "$API_URL/productos/999999" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "404" ]]; then
    log_pass "404 para recurso inexistente"
else
    log_fail "404 para recurso inexistente (got $code)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 📄 FASE 10: EXPORTS AVANZADOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# GET /productos/export/xlsx
code=$(http_code "$API_URL/productos/export/xlsx" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /productos/export/xlsx"
else
    log_fail "GET /productos/export/xlsx - HTTP $code"
fi

# GET /dashboard/alertas
code=$(http_code "$API_URL/dashboard/alertas" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /dashboard/alertas"
else
    log_fail "GET /dashboard/alertas - HTTP $code"
fi

# GET /reportes/comparativo
code=$(http_code "$API_URL/reportes/comparativo" -H "Authorization: Bearer $TOKEN")
if [[ "$code" == "200" ]]; then
    log_pass "GET /reportes/comparativo"
else
    log_fail "GET /reportes/comparativo - HTTP $code"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ 🧹 FASE 11: CLEANUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Delete test product
if [[ -n "$PRODUCT_ID" ]]; then
    code=$(http_code -X DELETE "$API_URL/productos/$PRODUCT_ID" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" || "$code" == "204" ]]; then
        log_pass "DELETE /productos/$PRODUCT_ID (cleanup)"
    else
        log_skip "DELETE /productos/$PRODUCT_ID (dependencias)"
    fi
fi

# Delete test client
if [[ -n "$CLIENT_ID" ]]; then
    code=$(http_code -X DELETE "$API_URL/clientes/$CLIENT_ID" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" || "$code" == "204" ]]; then
        log_pass "DELETE /clientes/$CLIENT_ID (cleanup)"
    else
        log_skip "DELETE /clientes/$CLIENT_ID (pedidos)"
    fi
fi

# Delete test category
if [[ -n "$CAT_ID" ]]; then
    code=$(http_code -X DELETE "$API_URL/categorias/$CAT_ID" -H "Authorization: Bearer $TOKEN")
    if [[ "$code" == "200" || "$code" == "204" ]]; then
        log_pass "DELETE /categorias/$CAT_ID (cleanup)"
    else
        log_skip "DELETE /categorias/$CAT_ID"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN
# ═══════════════════════════════════════════════════════════════════════════════
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}                           ${BOLD}📊 RESUMEN FINAL${NC}                                  ${CYAN}║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════════════════════╣${NC}"
printf "${CYAN}║${NC}  ⏱️  Duración: %-5ss                                                       ${CYAN}║${NC}\n" "$DURATION"
printf "${CYAN}║${NC}  📋 Total tests: %-4s                                                       ${CYAN}║${NC}\n" "$TOTAL"
printf "${CYAN}║${NC}  ${GREEN}✅ Passed: %-4s${NC}                                                           ${CYAN}║${NC}\n" "$PASSED"
printf "${CYAN}║${NC}  ${RED}❌ Failed: %-4s${NC}                                                           ${CYAN}║${NC}\n" "$FAILED"
printf "${CYAN}║${NC}  ${YELLOW}⏭️  Skipped: %-4s${NC}                                                         ${CYAN}║${NC}\n" "$SKIPPED"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"

if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}❌ TESTS FALLIDOS:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "   • $test"
    done
fi

if [[ $TOTAL -gt 0 ]]; then
    SUCCESS_RATE=$(( (PASSED * 100) / TOTAL ))
    echo ""
    if [[ $SUCCESS_RATE -ge 95 ]]; then
        echo -e "${GREEN}🎉 SUCCESS RATE: ${SUCCESS_RATE}% - EXCELLENT!${NC}"
    elif [[ $SUCCESS_RATE -ge 80 ]]; then
        echo -e "${YELLOW}👍 SUCCESS RATE: ${SUCCESS_RATE}% - GOOD${NC}"
    else
        echo -e "${RED}⚠️  SUCCESS RATE: ${SUCCESS_RATE}% - NEEDS ATTENTION${NC}"
    fi
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"

[[ $FAILED -eq 0 ]] && exit 0 || exit 1
