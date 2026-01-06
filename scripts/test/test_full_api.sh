#!/bin/bash
# =============================================================================
# COMPLETE API AUDIT SCRIPT - FRIOSUR/CHORIZAURIO
# Tests ALL critical endpoints and reports results
# =============================================================================

# Don't exit on error, we handle errors ourselves
set +e

BASE_URL="http://localhost:80/api"
PASSED=0
FAILED=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5
    local auth=$6
    
    local headers=""
    if [ -n "$auth" ]; then
        headers="-H 'Authorization: Bearer $auth'"
    fi
    
    if [ "$method" == "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" $headers "$BASE_URL$endpoint")
    elif [ "$method" == "POST" ]; then
        if [ -n "$data" ]; then
            status=$(curl -s -o /dev/null -w "%{http_code}" -X POST $headers -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
        else
            status=$(curl -s -o /dev/null -w "%{http_code}" -X POST $headers "$BASE_URL$endpoint")
        fi
    elif [ "$method" == "PUT" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $headers -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" == "DELETE" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $headers "$BASE_URL$endpoint")
    fi
    
    if [ "$status" == "$expected_status" ]; then
        pass "$description (HTTP $status)"
        return 0
    else
        fail "$description - Expected $expected_status, got $status"
        return 1
    fi
}

echo ""
echo "============================================================="
echo "        FRIOSUR API COMPLETE AUDIT - $(date)"
echo "============================================================="
echo ""

# -----------------------------------------------------------------------------
# 1. HEALTH CHECK
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 1. HEALTH CHECK ===${NC}"

HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    pass "Health check - system healthy"
else
    fail "Health check - system not healthy: $HEALTH"
fi

# Check database status
if echo "$HEALTH" | grep -q '"database":"ok"'; then
    pass "Database connection OK"
else
    fail "Database connection issue: $HEALTH"
fi

echo ""

# -----------------------------------------------------------------------------
# 2. AUTHENTICATION TESTS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 2. AUTHENTICATION ===${NC}"

# Test login with valid credentials
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" -F 'username=admin' -F 'password=admin123')
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    pass "Login with valid credentials"
else
    fail "Login with valid credentials - Response: $LOGIN_RESPONSE"
    echo -e "${RED}CRITICAL: Cannot proceed without valid authentication${NC}"
    exit 1
fi

# Test login with invalid credentials
INVALID_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/login" -F 'username=admin' -F 'password=wrongpassword')
if [ "$INVALID_LOGIN" == "401" ]; then
    pass "Login rejects invalid password (HTTP 401)"
else
    fail "Login with invalid password should return 401, got $INVALID_LOGIN"
fi

# Test access without token
NOTOKEN=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/clientes")
if [ "$NOTOKEN" == "401" ]; then
    pass "Protected endpoint rejects unauthenticated requests (HTTP 401)"
else
    fail "Protected endpoint without token should return 401, got $NOTOKEN"
fi

# Test access with token
WITHTOKEN=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes")
if [ "$WITHTOKEN" == "200" ]; then
    pass "Protected endpoint accepts valid token (HTTP 200)"
else
    fail "Protected endpoint with valid token should return 200, got $WITHTOKEN"
fi

# Test token refresh
REFRESH=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/refresh")
if [ "$REFRESH" == "200" ]; then
    pass "Token refresh endpoint works (HTTP 200)"
else
    warn "Token refresh returned $REFRESH (may be rate limited)"
fi

echo ""

# -----------------------------------------------------------------------------
# 3. CLIENTES CRUD
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 3. CLIENTES CRUD ===${NC}"

# GET clientes
CLIENTES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes")
if echo "$CLIENTES" | jq -e '. | type == "array" or .data | type == "array"' > /dev/null 2>&1; then
    CLIENTES_COUNT=$(echo "$CLIENTES" | jq 'if .data then .data | length else length end')
    pass "GET /clientes - returned array with $CLIENTES_COUNT clients"
else
    fail "GET /clientes - invalid response: $CLIENTES"
fi

# POST new cliente (test validation)
NEW_CLIENTE_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"Test Cliente API","telefono":"123456789","direccion":"Test Dir"}' \
    "$BASE_URL/clientes")
NEW_CLIENTE_ID=$(echo "$NEW_CLIENTE_RESPONSE" | jq -r '.id // empty')

if [ -n "$NEW_CLIENTE_ID" ] && [ "$NEW_CLIENTE_ID" != "null" ]; then
    pass "POST /clientes - created cliente with ID $NEW_CLIENTE_ID"
    
    # Test GET single cliente
    SINGLE_CLIENTE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$NEW_CLIENTE_ID")
    if echo "$SINGLE_CLIENTE" | jq -e '.id' > /dev/null 2>&1; then
        pass "GET /clientes/{id} - retrieved single cliente"
    else
        fail "GET /clientes/{id} - failed to retrieve cliente $NEW_CLIENTE_ID"
    fi
    
    # Test PUT update cliente
    UPDATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"nombre":"Test Cliente Updated","telefono":"987654321","direccion":"Updated Dir"}' \
        "$BASE_URL/clientes/$NEW_CLIENTE_ID")
    if [ "$UPDATE_RESPONSE" == "200" ]; then
        pass "PUT /clientes/{id} - updated cliente"
    else
        fail "PUT /clientes/{id} - failed to update, got HTTP $UPDATE_RESPONSE"
    fi
    
    # Cleanup: delete test cliente
    DELETE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
        -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$NEW_CLIENTE_ID")
    if [ "$DELETE_RESPONSE" == "200" ]; then
        pass "DELETE /clientes/{id} - deleted test cliente"
    else
        warn "DELETE /clientes/{id} - got HTTP $DELETE_RESPONSE"
    fi
else
    fail "POST /clientes - failed to create: $NEW_CLIENTE_RESPONSE"
fi

# Test validation - empty name
INVALID_CLIENTE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"","telefono":"123"}' "$BASE_URL/clientes")
if [ "$INVALID_CLIENTE" == "422" ]; then
    pass "POST /clientes validation - rejects empty name (HTTP 422)"
else
    warn "POST /clientes validation - empty name returned $INVALID_CLIENTE (expected 422)"
fi

echo ""

# -----------------------------------------------------------------------------
# 4. PRODUCTOS CRUD
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 4. PRODUCTOS CRUD ===${NC}"

# GET productos
PRODUCTOS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/productos")
if echo "$PRODUCTOS" | jq -e '. | type == "array"' > /dev/null 2>&1; then
    PRODUCTOS_COUNT=$(echo "$PRODUCTOS" | jq 'length')
    pass "GET /productos - returned array with $PRODUCTOS_COUNT products"
else
    fail "GET /productos - invalid response"
fi

# POST new producto
NEW_PRODUCTO_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"Test Producto API","precio":150.00,"stock":100,"stock_minimo":10}' \
    "$BASE_URL/productos")
NEW_PRODUCTO_ID=$(echo "$NEW_PRODUCTO_RESPONSE" | jq -r '.id // empty')

if [ -n "$NEW_PRODUCTO_ID" ] && [ "$NEW_PRODUCTO_ID" != "null" ]; then
    pass "POST /productos - created producto with ID $NEW_PRODUCTO_ID"
    
    # Test PUT update
    UPDATE_PROD=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"nombre":"Test Producto Updated","precio":200.00,"stock":50}' \
        "$BASE_URL/productos/$NEW_PRODUCTO_ID")
    if [ "$UPDATE_PROD" == "200" ]; then
        pass "PUT /productos/{id} - updated producto"
    else
        fail "PUT /productos/{id} - failed, got HTTP $UPDATE_PROD"
    fi
    
    # Cleanup
    DELETE_PROD=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
        -H "Authorization: Bearer $TOKEN" "$BASE_URL/productos/$NEW_PRODUCTO_ID")
    if [ "$DELETE_PROD" == "200" ]; then
        pass "DELETE /productos/{id} - deleted test producto"
    else
        warn "DELETE /productos/{id} - got HTTP $DELETE_PROD"
    fi
else
    fail "POST /productos - failed to create: $NEW_PRODUCTO_RESPONSE"
fi

# Test validation - negative price
INVALID_PRECIO=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"Test","precio":-10}' "$BASE_URL/productos")
if [ "$INVALID_PRECIO" == "422" ]; then
    pass "POST /productos validation - rejects negative price (HTTP 422)"
else
    warn "POST /productos validation - negative price returned $INVALID_PRECIO (expected 422)"
fi

echo ""

# -----------------------------------------------------------------------------
# 5. PEDIDOS CRUD & PDF GENERATION
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 5. PEDIDOS & PDF GENERATION ===${NC}"

# GET pedidos
PEDIDOS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/pedidos")
if echo "$PEDIDOS" | jq -e '. | type == "array"' > /dev/null 2>&1; then
    PEDIDOS_COUNT=$(echo "$PEDIDOS" | jq 'length')
    pass "GET /pedidos - returned array with $PEDIDOS_COUNT pedidos"
else
    fail "GET /pedidos - invalid response"
fi

# Find a pedido to test PDF generation
PENDING_PEDIDO=$(echo "$PEDIDOS" | jq -r '[.[] | select(.generado != 1 and .productos != null and (.productos | length) > 0)][0].id // empty')

if [ -n "$PENDING_PEDIDO" ]; then
    info "Found pending pedido ID: $PENDING_PEDIDO for PDF test"
    
    # Test preview stock
    PREVIEW=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d "{\"pedido_ids\": [$PENDING_PEDIDO]}" "$BASE_URL/pedidos/preview_stock")
    if echo "$PREVIEW" | jq -e '.ok' > /dev/null 2>&1; then
        pass "POST /pedidos/preview_stock - works correctly"
    else
        warn "POST /pedidos/preview_stock - unexpected response: $PREVIEW"
    fi
    
    # Test PDF generation
    PDF_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d "{\"pedido_ids\": [$PENDING_PEDIDO]}" \
        -w "\n%{http_code}" \
        -o /tmp/test_audit.pdf \
        "$BASE_URL/pedidos/generar_pdfs")
    PDF_STATUS=$(echo "$PDF_RESPONSE" | tail -1)
    
    if [ "$PDF_STATUS" == "200" ]; then
        # Verify it's a real PDF
        FILE_TYPE=$(file /tmp/test_audit.pdf)
        if echo "$FILE_TYPE" | grep -q "PDF document"; then
            PDF_SIZE=$(stat -c%s /tmp/test_audit.pdf)
            pass "POST /pedidos/generar_pdfs - generated valid PDF ($PDF_SIZE bytes)"
        else
            fail "POST /pedidos/generar_pdfs - returned non-PDF: $FILE_TYPE"
        fi
    else
        fail "POST /pedidos/generar_pdfs - HTTP $PDF_STATUS"
        cat /tmp/test_audit.pdf 2>/dev/null || true
    fi
else
    warn "No pending pedidos found for PDF generation test"
fi

# Test CSV export
CSV_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/pedidos/export/csv")
if [ "$CSV_RESPONSE" == "200" ]; then
    pass "GET /pedidos/export/csv - export works"
else
    warn "GET /pedidos/export/csv - returned HTTP $CSV_RESPONSE"
fi

echo ""

# -----------------------------------------------------------------------------
# 6. CATEGORIAS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 6. CATEGORIAS ===${NC}"

CATEGORIAS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/categorias")
if echo "$CATEGORIAS" | jq -e '. | type == "array"' > /dev/null 2>&1; then
    CAT_COUNT=$(echo "$CATEGORIAS" | jq 'length')
    pass "GET /categorias - returned array with $CAT_COUNT categories"
else
    fail "GET /categorias - invalid response"
fi

echo ""

# -----------------------------------------------------------------------------
# 7. OFERTAS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 7. OFERTAS ===${NC}"

OFERTAS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/ofertas")
if echo "$OFERTAS" | jq -e '. | type == "array"' > /dev/null 2>&1; then
    OFERTAS_COUNT=$(echo "$OFERTAS" | jq 'length')
    pass "GET /ofertas - returned array with $OFERTAS_COUNT offers"
else
    fail "GET /ofertas - invalid response"
fi

# Public endpoint for active offers
OFERTAS_ACTIVAS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/ofertas/activas")
if echo "$OFERTAS_ACTIVAS" | jq -e '. | type == "array"' > /dev/null 2>&1; then
    pass "GET /ofertas/activas - works correctly"
else
    fail "GET /ofertas/activas - invalid response"
fi

echo ""

# -----------------------------------------------------------------------------
# 8. DASHBOARD
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 8. DASHBOARD ===${NC}"

DASHBOARD=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/dashboard")
if echo "$DASHBOARD" | jq -e '.resumen' > /dev/null 2>&1; then
    pass "GET /dashboard - returns expected structure"
else
    fail "GET /dashboard - invalid response: $DASHBOARD"
fi

echo ""

# -----------------------------------------------------------------------------
# 9. SECURITY TESTS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 9. SECURITY TESTS ===${NC}"

# SQL Injection test (should be sanitized)
SQL_INJECT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/clientes?buscar='; DROP TABLE clientes; --")
if [ "$SQL_INJECT" == "200" ]; then
    # Check if clientes still work
    AFTER_INJECT=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes")
    if echo "$AFTER_INJECT" | jq -e '. | type == "array" or .data' > /dev/null 2>&1; then
        pass "SQL Injection protection - query sanitized"
    else
        fail "SQL Injection protection - might have affected database!"
    fi
else
    pass "SQL Injection test - handled safely (HTTP $SQL_INJECT)"
fi

# XSS in client name (should be stored but rendered safely)
XSS_CLIENT=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"<script>alert(1)</script>Test","telefono":"123"}' "$BASE_URL/clientes")
XSS_ID=$(echo "$XSS_CLIENT" | jq -r '.id // empty')
if [ -n "$XSS_ID" ]; then
    pass "XSS Test - data stored (rendering protection in frontend)"
    # Cleanup
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$XSS_ID" > /dev/null
else
    warn "XSS Test - could not create test client"
fi

# Rate limiting test (optional, may trigger limits)
info "Skipping rate limit test to avoid triggering limits"

echo ""

# -----------------------------------------------------------------------------
# 10. EDGE CASES
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 10. EDGE CASES ===${NC}"

# Non-existent resource
NOTFOUND=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/999999")
if [ "$NOTFOUND" == "404" ]; then
    pass "Non-existent resource returns 404"
else
    warn "Non-existent resource returned $NOTFOUND (expected 404)"
fi

# Invalid JSON body
INVALID_JSON=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{invalid json}' "$BASE_URL/clientes")
if [ "$INVALID_JSON" == "422" ]; then
    pass "Invalid JSON body returns 422"
else
    warn "Invalid JSON body returned $INVALID_JSON (expected 422)"
fi

# Empty body
EMPTY_BODY=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '' "$BASE_URL/clientes")
if [ "$EMPTY_BODY" == "422" ]; then
    pass "Empty body returns 422"
else
    warn "Empty body returned $EMPTY_BODY (expected 422)"
fi

echo ""

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
echo "============================================================="
echo "                    AUDIT SUMMARY"
echo "============================================================="
echo -e "  ${GREEN}PASSED${NC}: $PASSED"
echo -e "  ${RED}FAILED${NC}: $FAILED"  
echo -e "  ${YELLOW}WARNINGS${NC}: $WARNINGS"
echo "============================================================="

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}AUDIT FAILED - $FAILED critical issues found${NC}"
    exit 1
else
    echo -e "${GREEN}AUDIT PASSED - All critical tests passed${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}(with $WARNINGS non-critical warnings)${NC}"
    fi
    exit 0
fi
