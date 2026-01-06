#!/usr/bin/env bash
#
# SMOKE CORE TEST - Verifies critical flows:
# 1. DB_PATH accessible
# 2. Login works for active users
# 3. Token authentication works
# 4. Token revocation (logout) works
# 5. Core CRUD endpoints respond
#
set -uo pipefail

API_URL=${API_URL:-"http://localhost:8000"}
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_pass() { ((PASS++)); echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { ((FAIL++)); echo -e "${RED}✗ FAIL${NC}: $1"; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

# ============================================================================
# TEST 1: Health Check + DB Connection
# ============================================================================
log_info "Testing health endpoint..."
HEALTH=$(curl -s "$API_URL/health" 2>/dev/null || echo '{"status":"error"}')
DB_STATUS=$(echo "$HEALTH" | jq -r '.database // "error"')

if [[ "$DB_STATUS" == "ok" ]]; then
  log_pass "Health check - DB connection OK"
else
  log_fail "Health check - DB status: $DB_STATUS"
fi

# ============================================================================
# TEST 2: Count Users (verify DB_PATH is correct)
# ============================================================================
log_info "Checking usuarios count in database..."
USER_COUNT=$(docker compose exec -T backend python3 -c "
import sqlite3, os
conn = sqlite3.connect(os.getenv('DB_PATH', '/data/ventas.db'))
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM usuarios WHERE activo = 1')
print(cur.fetchone()[0])
" 2>/dev/null || echo "0")

if [[ "$USER_COUNT" -gt 0 ]]; then
  log_pass "Database has $USER_COUNT active users"
else
  log_fail "No active users found (count: $USER_COUNT)"
fi

# ============================================================================
# TEST 3: Register New Test User (if not exists)
# ============================================================================
TEST_USER="smoke_test_$(date +%s)"
TEST_PASS="SmokeTEST123!"

log_info "Registering test user: $TEST_USER"
REG_RESP=$(curl -sf -X POST "$API_URL/register" \
  -d "username=$TEST_USER&password=$TEST_PASS" 2>/dev/null || echo '{"ok":false}')

if echo "$REG_RESP" | jq -e '.ok' >/dev/null 2>&1; then
  log_pass "User registration works"
  
  # Activate the user
  docker compose exec -T backend python3 -c "
import sqlite3, os
conn = sqlite3.connect(os.getenv('DB_PATH', '/data/ventas.db'))
cur = conn.cursor()
cur.execute('UPDATE usuarios SET activo = 1 WHERE username = ?', ('$TEST_USER',))
conn.commit()
" 2>/dev/null
  log_info "Activated test user"
else
  log_fail "User registration: $REG_RESP"
fi

# ============================================================================
# TEST 4: Login with Test User
# ============================================================================
log_info "Testing login for $TEST_USER..."
LOGIN_RESP=$(curl -sf -X POST "$API_URL/login" \
  -d "username=$TEST_USER&password=$TEST_PASS" 2>/dev/null || echo '{}')

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.access_token // empty')

if [[ -n "$TOKEN" && "$TOKEN" != "null" ]]; then
  log_pass "Login successful - token acquired (${#TOKEN} chars)"
else
  log_fail "Login failed: $LOGIN_RESP"
  TOKEN=""
fi

# ============================================================================
# TEST 5: Authenticated Endpoint Access
# ============================================================================
if [[ -n "$TOKEN" ]]; then
  log_info "Testing authenticated endpoints..."
  
  # Test /clientes
  CLIENTES=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/clientes?limit=1" 2>/dev/null || echo "ERROR")
  if [[ "$CLIENTES" != "ERROR" ]]; then
    log_pass "GET /clientes - authenticated access works"
  else
    log_fail "GET /clientes - authentication failed"
  fi
  
  # Test /productos
  PRODUCTOS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/productos?limit=1" 2>/dev/null || echo "ERROR")
  if [[ "$PRODUCTOS" != "ERROR" ]]; then
    PROD_COUNT=$(echo "$PRODUCTOS" | jq 'length')
    log_pass "GET /productos - returned $PROD_COUNT products"
  else
    log_fail "GET /productos - authentication failed"
  fi
  
  # Test /ofertas/activas
  OFERTAS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/ofertas/activas" 2>/dev/null || echo "ERROR")
  if [[ "$OFERTAS" != "ERROR" ]]; then
    log_pass "GET /ofertas/activas - endpoint works"
  else
    log_fail "GET /ofertas/activas failed"
  fi
fi

# ============================================================================
# TEST 6: Logout (Token Revocation)
# ============================================================================
if [[ -n "$TOKEN" ]]; then
  log_info "Testing logout (token revocation)..."
  LOGOUT_RESP=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" "$API_URL/logout" 2>/dev/null || echo '{}')
  
  if echo "$LOGOUT_RESP" | grep -q "correctamente"; then
    log_pass "Logout successful"
    
    # Verify token is revoked
    AFTER_LOGOUT=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/clientes" 2>/dev/null)
    if echo "$AFTER_LOGOUT" | grep -q "Sesión cerrada"; then
      log_pass "Token revocation verified - access denied after logout"
    else
      log_fail "Token still works after logout!"
    fi
  else
    log_fail "Logout failed: $LOGOUT_RESP"
  fi
fi

# ============================================================================
# TEST 7: Check Schema Integrity
# ============================================================================
log_info "Verifying database schema..."
SCHEMA_CHECK=$(docker compose exec -T backend python3 -c "
import sqlite3, os
conn = sqlite3.connect(os.getenv('DB_PATH', '/data/ventas.db'))
cur = conn.cursor()

# Check usuarios has required columns
cur.execute('PRAGMA table_info(usuarios)')
cols = {r[1] for r in cur.fetchall()}
required = {'username', 'password_hash', 'rol', 'activo'}
missing = required - cols
if missing:
    print(f'MISSING: {missing}')
else:
    print('OK')
" 2>/dev/null || echo "ERROR")

if [[ "$SCHEMA_CHECK" == "OK" ]]; then
  log_pass "Schema integrity - usuarios table has all required columns"
else
  log_fail "Schema check: $SCHEMA_CHECK"
fi

# ============================================================================
# CLEANUP: Remove test user
# ============================================================================
log_info "Cleaning up test user..."
docker compose exec -T backend python3 -c "
import sqlite3, os
conn = sqlite3.connect(os.getenv('DB_PATH', '/data/ventas.db'))
cur = conn.cursor()
cur.execute('DELETE FROM usuarios WHERE username = ?', ('$TEST_USER',))
conn.commit()
" 2>/dev/null

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "============================================"
echo -e "  SMOKE TEST RESULTS: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "============================================"

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}All core flows working correctly!${NC}"
  true  # Explicit success
else
  echo -e "${RED}Some tests failed - review above${NC}"
  false  # Explicit failure
fi
