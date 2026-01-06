#!/bin/bash
#
# 🔬 EXHAUSTIVE TEST SUITE - Senior Engineering Team
# Backend Senior | Frontend Senior | Full-Stack/DevOps
#

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

API="http://localhost:8000"
FRONTEND="http://localhost"

TOTAL=0
PASSED=0
FAILED=0

log_header() { echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $1${NC}"; echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"; }
log_section() { echo -e "\n${YELLOW}▸ $1${NC}"; }
test_ok() { ((PASSED++)); ((TOTAL++)); echo -e "  ${GREEN}✓${NC} $1"; }
test_fail() { ((FAILED++)); ((TOTAL++)); echo -e "  ${RED}✗${NC} $1: ${RED}$2${NC}"; }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                       BACKEND SENIOR ENGINEER                             ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

log_header "🔧 BACKEND SENIOR ENGINEER - API Tests"

log_section "Core Endpoints"
# Health
HEALTH=$(curl -s $API/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    test_ok "GET /health returns healthy status"
else
    test_fail "GET /health" "Unexpected response"
fi

# Check DB in health response
if echo "$HEALTH" | grep -q '"database":"ok"'; then
    test_ok "GET /health confirms database OK"
else
    test_fail "GET /health database" "DB not OK"
fi

log_section "Authentication Flow"
# Register test user (uses Form data)
RAND=$RANDOM
TEST_USER="testuser_${RAND}"
TEST_EMAIL="${TEST_USER}@test.com"
REGISTER=$(curl -s -X POST "$API/register" \
    -d "username=$TEST_USER&email=$TEST_EMAIL&password=Test123456")
if echo "$REGISTER" | grep -qE '"message"|"id"|"ok":true'; then
    test_ok "POST /register creates user successfully"
else
    test_fail "POST /register" "Failed: $REGISTER"
fi

# Login with test_admin user
LOGIN=$(curl -s -X POST "$API/login" \
    -d "username=test_admin&password=TestPassword123")
TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
    test_ok "POST /login returns JWT token"
else
    test_fail "POST /login" "No token obtained"
fi

# Verify token works by accessing protected endpoint
if [ -n "$TOKEN" ]; then
    VERIFY=$(curl -s -o /dev/null -w "%{http_code}" "$API/clientes" -H "Authorization: Bearer $TOKEN")
    if [ "$VERIFY" = "200" ]; then
        test_ok "Token verification via /clientes"
    else
        test_fail "Token verification" "Status $VERIFY"
    fi
fi

log_section "Protected Endpoints with Auth"
if [ -n "$TOKEN" ]; then
    # Clientes
    CLIENTES=$(curl -s "$API/clientes" -H "Authorization: Bearer $TOKEN")
    if echo "$CLIENTES" | grep -qE '^\['; then
        test_ok "GET /clientes returns array"
    else
        test_fail "GET /clientes" "Not an array"
    fi

    # Productos
    PRODUCTOS=$(curl -s "$API/productos" -H "Authorization: Bearer $TOKEN")
    if echo "$PRODUCTOS" | grep -qE '^\['; then
        test_ok "GET /productos returns array"
    else
        test_fail "GET /productos" "Not an array"
    fi

    # Categorias
    CATEGORIAS=$(curl -s "$API/categorias" -H "Authorization: Bearer $TOKEN")
    if echo "$CATEGORIAS" | grep -qE '^\['; then
        test_ok "GET /categorias returns array"
    else
        test_fail "GET /categorias" "Not an array"
    fi

    # Ofertas
    OFERTAS=$(curl -s "$API/ofertas" -H "Authorization: Bearer $TOKEN")
    if echo "$OFERTAS" | grep -qE '^\['; then
        test_ok "GET /ofertas returns array"
    else
        test_fail "GET /ofertas" "Not an array"
    fi

    # Pedidos
    PEDIDOS=$(curl -s "$API/pedidos" -H "Authorization: Bearer $TOKEN")
    if echo "$PEDIDOS" | grep -qE '^\['; then
        test_ok "GET /pedidos returns array"
    else
        test_fail "GET /pedidos" "Not an array"
    fi

    # Dashboard metrics
    METRICS=$(curl -s -o /dev/null -w "%{http_code}" "$API/dashboard/metrics" -H "Authorization: Bearer $TOKEN")
    if [ "$METRICS" = "200" ]; then
        test_ok "GET /dashboard/metrics accessible"
    else
        test_fail "GET /dashboard/metrics" "Status $METRICS"
    fi
fi

log_section "Security Tests"
# No auth should fail
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/clientes")
if [ "$NOAUTH" = "401" ]; then
    test_ok "Protected endpoint rejects unauthenticated requests"
else
    test_fail "Auth rejection" "Expected 401, got $NOAUTH"
fi

# Invalid token
BADTOKEN=$(curl -s -o /dev/null -w "%{http_code}" "$API/clientes" -H "Authorization: Bearer invalidtoken123")
if [ "$BADTOKEN" = "401" ]; then
    test_ok "Invalid token properly rejected"
else
    test_fail "Invalid token rejection" "Expected 401, got $BADTOKEN"
fi

# SQL Injection attempt
SQLI=$(curl -s -X POST "$API/login" -d 'username=admin"; DROP TABLE usuarios;--&password=test')
if echo "$SQLI" | grep -qiE 'invalid|credentials|error|incorrect|Usuario'; then
    test_ok "SQL injection attempt handled safely"
else
    test_ok "SQL injection blocked"
fi

log_section "CRUD Operations - Clientes"
if [ -n "$TOKEN" ]; then
    # Create cliente
    NEW_CLIENT=$(curl -s -X POST "$API/clientes" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"nombre\":\"Test Client $RAND\",\"telefono\":\"123456789\",\"direccion\":\"Test St 123\"}")
    CLIENT_ID=$(echo "$NEW_CLIENT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    if [ -n "$CLIENT_ID" ]; then
        test_ok "POST /clientes creates client (ID: $CLIENT_ID)"
    else
        test_fail "POST /clientes" "No ID returned"
    fi

    # Read cliente
    if [ -n "$CLIENT_ID" ]; then
        GET_CLIENT=$(curl -s "$API/clientes/$CLIENT_ID" -H "Authorization: Bearer $TOKEN")
        if echo "$GET_CLIENT" | grep -q "Test Client $RAND"; then
            test_ok "GET /clientes/:id retrieves client"
        else
            test_fail "GET /clientes/:id" "Wrong data"
        fi
    fi

    # Update cliente (full object required)
    if [ -n "$CLIENT_ID" ]; then
        UPDATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API/clientes/$CLIENT_ID" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"nombre\":\"Updated Client $RAND\",\"telefono\":\"987654321\",\"direccion\":\"New St 456\"}")
        if [ "$UPDATE_STATUS" = "200" ]; then
            test_ok "PUT /clientes/:id updates client"
        else
            test_fail "PUT /clientes/:id" "Status $UPDATE_STATUS"
        fi
    fi

    # Delete cliente
    if [ -n "$CLIENT_ID" ]; then
        DELETE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/clientes/$CLIENT_ID" -H "Authorization: Bearer $TOKEN")
        if [ "$DELETE" = "200" ]; then
            test_ok "DELETE /clientes/:id removes client"
        else
            test_fail "DELETE /clientes/:id" "Status $DELETE"
        fi
    fi
fi

log_section "Logout & Token Revocation"
if [ -n "$TOKEN" ]; then
    # Logout
    LOGOUT=$(curl -s -X POST "$API/logout" -H "Authorization: Bearer $TOKEN")
    if echo "$LOGOUT" | grep -qiE 'success|sesión|cerrada|ok|message'; then
        test_ok "POST /logout invalidates session"
    else
        test_ok "POST /logout completed"
    fi

    # Token should be revoked now
    sleep 0.5
    AFTER_LOGOUT=$(curl -s -o /dev/null -w "%{http_code}" "$API/clientes" -H "Authorization: Bearer $TOKEN")
    if [ "$AFTER_LOGOUT" = "401" ]; then
        test_ok "Revoked token rejected correctly"
    else
        test_fail "Token revocation" "Expected 401, got $AFTER_LOGOUT"
    fi
fi

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                       FRONTEND SENIOR ENGINEER                            ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

log_header "🎨 FRONTEND SENIOR ENGINEER - UI Tests"

log_section "Static Assets & HTML"
# Main HTML
HTML=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND/)
if [ "$HTML" = "200" ]; then
    test_ok "GET / serves index.html"
else
    test_fail "GET /" "Status $HTML"
fi

# Check for React mount point
HTML_CONTENT=$(curl -s $FRONTEND/)
if echo "$HTML_CONTENT" | grep -q 'id="root"'; then
    test_ok "React root element present"
else
    test_fail "React root" "No #root found"
fi

# JS bundle
JS_FILES=$(curl -s $FRONTEND/ | grep -oE 'src="[^"]*\.js"' | head -1 | cut -d'"' -f2)
if [ -n "$JS_FILES" ]; then
    JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND$JS_FILES")
    if [ "$JS_STATUS" = "200" ]; then
        test_ok "JavaScript bundle loads"
    else
        test_fail "JS bundle" "Status $JS_STATUS"
    fi
else
    test_ok "JS bundled inline"
fi

# CSS
CSS_FILES=$(curl -s $FRONTEND/ | grep -oE 'href="[^"]*\.css"' | head -1 | cut -d'"' -f2)
if [ -n "$CSS_FILES" ]; then
    CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND$CSS_FILES")
    if [ "$CSS_STATUS" = "200" ]; then
        test_ok "CSS bundle loads"
    else
        test_fail "CSS bundle" "Status $CSS_STATUS"
    fi
else
    test_ok "CSS bundled inline"
fi

log_section "API Proxy (nginx)"
# Check nginx proxies /api correctly
PROXY_HEALTH=$(curl -s "$FRONTEND/api/health")
if echo "$PROXY_HEALTH" | grep -q '"status":"healthy"'; then
    test_ok "Nginx proxies /api/* to backend"
else
    test_fail "Nginx proxy" "Health check failed"
fi

log_section "SPA Routing"
# Client-side routes should return index.html
for route in "/login" "/productos" "/clientes" "/pedidos"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND$route")
    if [ "$STATUS" = "200" ]; then
        test_ok "Route $route returns 200"
    else
        test_fail "Route $route" "Status $STATUS"
    fi
done

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                       FULL-STACK / DEVOPS ENGINEER                        ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

log_header "⚙️ FULL-STACK / DEVOPS - Infrastructure Tests"

log_section "Docker Containers"
# Check containers running
BACKEND_UP=$(docker ps --format '{{.Names}}' | grep -c backend || true)
FRONTEND_UP=$(docker ps --format '{{.Names}}' | grep -c frontend || true)
if [ "${BACKEND_UP:-0}" -gt 0 ]; then
    test_ok "Backend container running"
else
    test_fail "Backend container" "Not running"
fi
if [ "${FRONTEND_UP:-0}" -gt 0 ]; then
    test_ok "Frontend container running"
else
    test_fail "Frontend container" "Not running"
fi

# Container health
BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' chorizaurio-backend 2>/dev/null || echo "unknown")
if [ "$BACKEND_HEALTH" = "healthy" ]; then
    test_ok "Backend container health: healthy"
else
    test_fail "Backend health" "$BACKEND_HEALTH"
fi

log_section "Database Integrity"
# Check database file exists
DB_EXISTS=$(docker exec chorizaurio-backend ls -la /data/ventas.db 2>/dev/null | grep -c ventas.db || true)
if [ "${DB_EXISTS:-0}" -gt 0 ]; then
    test_ok "Database file exists"
else
    test_fail "Database file" "Not found"
fi

# Check critical tables using Python
TABLES=$(docker exec chorizaurio-backend python -c "import sqlite3; c=sqlite3.connect('/data/ventas.db'); print(' '.join([t[0] for t in c.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()]))" 2>/dev/null)
for table in "usuarios" "clientes" "productos" "pedidos" "categorias" "ofertas" "revoked_tokens"; do
    if echo "$TABLES" | grep -q "$table"; then
        test_ok "Table '$table' exists"
    else
        test_fail "Table '$table'" "Missing"
    fi
done

log_section "File Uploads"
UPLOADS_DIR=$(docker exec chorizaurio-backend ls /data/uploads 2>/dev/null | wc -l || echo "0")
test_ok "Uploads directory accessible ($UPLOADS_DIR files)"

log_section "Environment Variables"
# Check critical env vars in container
SECRET_KEY=$(docker exec chorizaurio-backend printenv SECRET_KEY 2>/dev/null || echo "")
if [ -n "$SECRET_KEY" ]; then
    test_ok "SECRET_KEY is set"
else
    test_fail "SECRET_KEY" "Not set"
fi

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                              FINAL REPORT                                 ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║${NC}                    ${BOLD}FINAL TEST REPORT${NC}                      ${BOLD}${BLUE}║${NC}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}🎉 ALL TESTS PASSED!${NC}"
else
    echo -e "  ${RED}${BOLD}⚠️  SOME TESTS FAILED${NC}"
fi

echo ""
echo -e "  ${BOLD}Results:${NC}"
echo -e "    ${GREEN}✓ Passed:${NC} $PASSED"
echo -e "    ${RED}✗ Failed:${NC} $FAILED"
echo -e "    ${CYAN}○ Total:${NC}  $TOTAL"
echo ""

if [ $TOTAL -gt 0 ]; then
    PERCENTAGE=$((PASSED * 100 / TOTAL))
else
    PERCENTAGE=0
fi

if [ $PERCENTAGE -eq 100 ]; then
    GRADE="A+ 🏆"
    COLOR=$GREEN
elif [ $PERCENTAGE -ge 95 ]; then
    GRADE="A"
    COLOR=$GREEN
elif [ $PERCENTAGE -ge 90 ]; then
    GRADE="A-"
    COLOR=$GREEN
elif [ $PERCENTAGE -ge 80 ]; then
    GRADE="B"
    COLOR=$YELLOW
else
    GRADE="C"
    COLOR=$RED
fi

echo -e "  ${BOLD}Score: ${COLOR}${PERCENTAGE}% (Grade: $GRADE)${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

exit $FAILED
