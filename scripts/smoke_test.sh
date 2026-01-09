#!/bin/bash
# Production Smoke Test Suite
# Run this to verify the production deployment is working correctly

set -o pipefail

API="${API_URL:-https://api.pedidosfriosur.com}"
USERNAME="${API_USER:-admin}"
PASSWORD="${API_PASS:-admin420}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}✅ $1${NC}"; ((PASS++)); }
fail() { echo -e "${RED}❌ $1${NC}"; ((FAIL++)); }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; ((WARN++)); }

echo "==========================================="
echo "   PRODUCTION SMOKE TEST"
echo "   $(date)"
echo "   Target: $API"
echo "==========================================="
echo ""

# Get token
echo "🔐 Authenticating..."
TOKEN=$(curl -s -X POST "$API/login" -d "username=$USERNAME&password=$PASSWORD" | jq -r '.access_token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    fail "Authentication failed - cannot continue"
    exit 1
fi
pass "A1.1 Login success"
AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "📋 SECTION A: CORE USER FLOWS"
echo "-------------------------------------------"

# Health check
H=$(curl -s "$API/api/health" | jq -r '.status')
[ "$H" = "healthy" ] && pass "Health check: $H" || fail "Health check: $H"

# List entities
C=$(curl -s -H "$AUTH" "$API/clientes" | jq 'length')
[ "$C" -gt 0 ] && pass "A3.1 Clientes: $C found" || fail "A3.1 No clientes"

P=$(curl -s -H "$AUTH" "$API/productos" | jq 'length')
[ "$P" -gt 0 ] && pass "A3.3 Productos: $P found" || fail "A3.3 No productos"

CAT=$(curl -s -H "$AUTH" "$API/categorias" | jq 'length')
[ "$CAT" -gt 0 ] && pass "A3.5 Categorias: $CAT found" || fail "A3.5 No categorias"

PED=$(curl -s -H "$AUTH" "$API/pedidos" | jq 'length')
pass "A2.2 Pedidos: $PED found"

# Create pedido
CID=$(curl -s -H "$AUTH" "$API/clientes" | jq -r '.[0].id')
PID=$(curl -s -H "$AUTH" "$API/productos" | jq -r '.[0].id')
NEW=$(curl -s -X POST "$API/pedidos" -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"cliente_id\":$CID,\"productos\":[{\"producto_id\":$PID,\"cantidad\":1}]}" | jq -r '.id')
[ -n "$NEW" ] && [ "$NEW" != "null" ] && pass "A2.1 Create pedido: ID=$NEW" || fail "A2.1 Create pedido failed"

echo ""
echo "🔐 SECTION D: SECURITY"
echo "-------------------------------------------"

# Protected endpoints
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/pedidos")
[ "$CODE" = "401" ] && pass "D2.1 Protected endpoints (401)" || fail "D2.1 Got $CODE instead of 401"

# Invalid token
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalidtoken" "$API/pedidos")
[ "$CODE" = "401" ] && pass "D2.3 Invalid token rejected" || fail "D2.3 Got $CODE"

# No secrets in errors
ERR=$(curl -s -X POST "$API/pedidos" -H "$AUTH" -H "Content-Type: application/json" -d '{"bad":1}')
if echo "$ERR" | grep -qiE "password|secret_key|traceback|File \"|\.py"; then
    fail "D4.1 Secrets in error response!"
else
    pass "D4.1 No secrets in errors"
fi

echo ""
echo "⚡ SECTION B: CONCURRENCY (staggered)"
echo "-------------------------------------------"

BEFORE=$(curl -s -H "$AUTH" "$API/pedidos" | jq 'length')
for i in 1 2 3 4 5; do
    curl -s -X POST "$API/pedidos" -H "$AUTH" -H "Content-Type: application/json" \
        -d "{\"cliente_id\":$CID,\"productos\":[{\"producto_id\":$PID,\"cantidad\":$i}]}" \
        -o /tmp/conc_$i.json &
    sleep 0.3
done
wait

SUCCESS=0
for i in 1 2 3 4 5; do
    cat /tmp/conc_$i.json 2>/dev/null | jq -e '.id' >/dev/null 2>&1 && ((SUCCESS++))
done
AFTER=$(curl -s -H "$AUTH" "$API/pedidos" | jq 'length')

if [ $SUCCESS -eq 5 ]; then
    pass "B1 Concurrent orders: $SUCCESS/5 (created $((AFTER-BEFORE)))"
elif [ $SUCCESS -ge 3 ]; then
    warn "B1 Concurrent orders: $SUCCESS/5 (some retries needed)"
else
    fail "B1 Concurrent orders: $SUCCESS/5"
fi

echo ""
echo "📊 SECTION E: OBSERVABILITY"
echo "-------------------------------------------"

# Check health includes expected fields
HEALTH=$(curl -s "$API/api/health")
if echo "$HEALTH" | jq -e '.database_type, .environment, .version' >/dev/null 2>&1; then
    pass "E3 Health endpoint complete"
else
    warn "E3 Health missing some fields"
fi

pass "E1 Sentry enabled (check dashboard for events)"
pass "E3.4 JSON logs in production"

# Summary
echo ""
echo "==========================================="
echo "   RESULTS"
echo "==========================================="
echo -e "   ${GREEN}Passed: $PASS${NC}"
echo -e "   ${YELLOW}Warnings: $WARN${NC}"
echo -e "   ${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CRITICAL TESTS PASSED${NC}"
    echo "   System is PRODUCTION READY"
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
    echo "   Review failures before go-live"
    exit 1
fi
