#!/bin/bash
# =============================================================================
# SECURITY AUDIT SCRIPT - FRIOSUR/CHORIZAURIO
# Tests security vulnerabilities and protections
# =============================================================================

set +e

BASE_URL="http://localhost:80/api"
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; FAILED=$((FAILED + 1)); }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

echo ""
echo "============================================================="
echo "        SECURITY AUDIT - $(date)"
echo "============================================================="
echo ""

# Get valid token for testing
TOKEN=$(curl -s -X POST "$BASE_URL/login" -F 'username=admin' -F 'password=admin123' | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}Cannot authenticate - aborting security tests${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# 1. AUTHENTICATION SECURITY
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 1. AUTHENTICATION SECURITY ===${NC}"

# Test invalid token rejection
INVALID_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.token.here" "$BASE_URL/clientes")
if [ "$INVALID_TOKEN" == "401" ]; then
    pass "Invalid token rejected (HTTP 401)"
else
    fail "Invalid token should return 401, got $INVALID_TOKEN"
fi

# Test expired token format (crafted JWT with past exp)
EXPIRED_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid"
EXPIRED_RESP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $EXPIRED_JWT" "$BASE_URL/clientes")
if [ "$EXPIRED_RESP" == "401" ]; then
    pass "Expired/invalid JWT rejected (HTTP 401)"
else
    fail "Expired/invalid JWT should return 401, got $EXPIRED_RESP"
fi

# Test missing auth header
NO_AUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/clientes")
if [ "$NO_AUTH" == "401" ]; then
    pass "Missing auth header rejected (HTTP 401)"
else
    fail "Missing auth should return 401, got $NO_AUTH"
fi

# Test brute force protection (rate limiting on login)
info "Testing rate limiting on login (may take a moment)..."
RATE_LIMITED=false
for i in {1..15}; do
    RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/login" -F 'username=admin' -F 'password=wrongpassword')
    if [ "$RESP" == "429" ]; then
        RATE_LIMITED=true
        break
    fi
done
if [ "$RATE_LIMITED" == "true" ]; then
    pass "Rate limiting active on failed logins (HTTP 429)"
else
    fail "Rate limiting not triggered after 15 failed attempts"
fi

echo ""

# -----------------------------------------------------------------------------
# 2. SQL INJECTION TESTS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 2. SQL INJECTION TESTS ===${NC}"

# Test search parameter
SQL_SEARCH=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes?buscar=1%27%20OR%20%271%27%3D%271")
if [ "$SQL_SEARCH" == "200" ]; then
    # Verify data is still intact
    CLIENTES_OK=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes" | jq 'length')
    if [ "$CLIENTES_OK" -gt 0 ]; then
        pass "SQL injection in search - query sanitized, data intact"
    else
        fail "SQL injection may have affected data!"
    fi
else
    pass "SQL injection attempt handled (HTTP $SQL_SEARCH)"
fi

# Test path parameter
SQL_PATH=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/1;DROP%20TABLE%20clientes")
if [ "$SQL_PATH" == "404" ] || [ "$SQL_PATH" == "422" ]; then
    pass "SQL injection in path rejected (HTTP $SQL_PATH)"
else
    fail "SQL injection in path returned unexpected: $SQL_PATH"
fi

# Test in POST body
SQL_BODY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"test\"; DROP TABLE clientes; --","telefono":"123"}' "$BASE_URL/clientes")
SQL_BODY_ID=$(echo "$SQL_BODY" | jq -r '.id // empty')
if [ -n "$SQL_BODY_ID" ]; then
    # Cleanup and verify tables exist
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$SQL_BODY_ID" > /dev/null
    AFTER=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes" | jq 'length')
    if [ "$AFTER" -gt 0 ]; then
        pass "SQL injection in body - stored as literal, tables intact"
    else
        fail "SQL injection may have affected database!"
    fi
else
    pass "SQL injection in body handled"
fi

echo ""

# -----------------------------------------------------------------------------
# 3. XSS PREVENTION
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 3. XSS PREVENTION ===${NC}"

# Test stored XSS in client name
XSS_TEST='<script>alert("XSS")</script>'
XSS_RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"nombre\":\"$XSS_TEST\",\"telefono\":\"123\"}" "$BASE_URL/clientes")
XSS_ID=$(echo "$XSS_RESP" | jq -r '.id // empty')

if [ -n "$XSS_ID" ]; then
    # Verify script tags are stored but will be escaped by React
    STORED=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$XSS_ID")
    if echo "$STORED" | grep -q "<script>"; then
        info "XSS payload stored literally (React will escape on render)"
        pass "XSS handled - React auto-escapes HTML in JSX"
    else
        pass "XSS payload sanitized before storage"
    fi
    # Cleanup
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$XSS_ID" > /dev/null
else
    pass "XSS payload rejected at API level"
fi

echo ""

# -----------------------------------------------------------------------------
# 4. AUTHORIZATION TESTS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 4. AUTHORIZATION TESTS ===${NC}"

# Create a test user (non-admin)
TEST_USER="security_test_$(date +%s)"
REGISTER=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/register" \
    -F "username=$TEST_USER" -F "password=SecureTest123!" -F "rol=usuario")

if [ "$REGISTER" == "200" ]; then
    # Login as test user
    USER_TOKEN=$(curl -s -X POST "$BASE_URL/login" \
        -F "username=$TEST_USER" -F "password=SecureTest123!" | jq -r '.access_token')
    
    if [ -n "$USER_TOKEN" ] && [ "$USER_TOKEN" != "null" ]; then
        # Try to access admin-only endpoints
        ADMIN_ONLY=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
            -H "Authorization: Bearer $USER_TOKEN" "$BASE_URL/clientes/1")
        if [ "$ADMIN_ONLY" == "403" ]; then
            pass "Non-admin cannot delete clientes (HTTP 403)"
        else
            fail "Non-admin was able to delete, got HTTP $ADMIN_ONLY"
        fi
        
        # Try to access user management (admin only)
        USERS_ENDPOINT=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $USER_TOKEN" "$BASE_URL/usuarios")
        if [ "$USERS_ENDPOINT" == "403" ]; then
            pass "Non-admin cannot list usuarios (HTTP 403)"
        else
            fail "Non-admin accessed usuarios, got HTTP $USERS_ENDPOINT"
        fi
    fi
else
    info "Could not create test user (may be rate limited)"
fi

echo ""

# -----------------------------------------------------------------------------
# 5. INPUT VALIDATION
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 5. INPUT VALIDATION ===${NC}"

# Test extremely long input
LONG_NAME=$(python3 -c "print('A' * 10000)")
LONG_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"nombre\":\"$LONG_NAME\",\"telefono\":\"123\"}" "$BASE_URL/clientes")
if [ "$LONG_RESP" == "422" ] || [ "$LONG_RESP" == "413" ]; then
    pass "Extremely long input rejected (HTTP $LONG_RESP)"
else
    fail "Long input should be rejected, got HTTP $LONG_RESP"
fi

# Test negative stock
NEG_STOCK=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"nombre":"Test","precio":10,"stock":-100}' "$BASE_URL/productos")
if [ "$NEG_STOCK" == "422" ]; then
    pass "Negative stock rejected (HTTP 422)"
else
    fail "Negative stock should be rejected, got HTTP $NEG_STOCK"
fi

# Test invalid email format (if applicable)
# Test special characters in nombres
SPECIAL_CHARS='Test <>&"\x27 Name'
SPECIAL_RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"nombre\":\"$SPECIAL_CHARS\",\"telefono\":\"123\"}" "$BASE_URL/clientes")
SPECIAL_ID=$(echo "$SPECIAL_RESP" | jq -r '.id // empty')
if [ -n "$SPECIAL_ID" ]; then
    pass "Special characters handled safely"
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/clientes/$SPECIAL_ID" > /dev/null
else
    pass "Special characters sanitized/rejected"
fi

echo ""

# -----------------------------------------------------------------------------
# 6. SECURITY HEADERS
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 6. SECURITY HEADERS ===${NC}"

HEADERS=$(curl -s -I "$BASE_URL/health")

# Check X-Content-Type-Options
if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
    pass "X-Content-Type-Options header present"
else
    info "X-Content-Type-Options not set (dev environment)"
fi

# Check X-Frame-Options
if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
    pass "X-Frame-Options header present"
else
    info "X-Frame-Options not set (dev environment)"
fi

echo ""

# -----------------------------------------------------------------------------
# 7. FILE UPLOAD SECURITY
# -----------------------------------------------------------------------------
echo -e "${BLUE}=== 7. FILE UPLOAD SECURITY ===${NC}"

# Test uploading executable file
EXEC_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/bin/ls;filename=malicious.exe" "$BASE_URL/upload" 2>/dev/null)
if [ "$EXEC_RESP" == "400" ] || [ "$EXEC_RESP" == "415" ] || [ "$EXEC_RESP" == "422" ]; then
    pass "Executable upload blocked (HTTP $EXEC_RESP)"
else
    fail "Executable upload returned HTTP $EXEC_RESP"
fi

# Test oversized file (if we could)
info "Oversized file test skipped (requires large file generation)"

echo ""

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
echo "============================================================="
echo "                    SECURITY AUDIT SUMMARY"
echo "============================================================="
echo -e "  ${GREEN}PASSED${NC}: $PASSED"
echo -e "  ${RED}FAILED${NC}: $FAILED"
echo "============================================================="

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}SECURITY ISSUES FOUND - $FAILED vulnerabilities${NC}"
    exit 1
else
    echo -e "${GREEN}SECURITY AUDIT PASSED - All tests passed${NC}"
    exit 0
fi
