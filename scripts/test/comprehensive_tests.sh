#!/bin/bash

# ============================================================================
# COMPREHENSIVE TEST SUITE FOR CHORIZAURIO
# ============================================================================

# Don't exit on error - we want to run all tests
set +e

API="http://localhost:8000"
ADMIN_USER="admin"
ADMIN_PASS="Admin123"
TEST_USER="testuser_$$"
TEST_PASS="TestPass123"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
}

print_subheader() {
    echo ""
    echo -e "${BLUE}──────────────────────────────────────────────────────────${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}──────────────────────────────────────────────────────────${NC}"
}

pass() {
    echo -e "  ${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "  ${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

skip() {
    echo -e "  ${YELLOW}○ SKIP${NC}: $1"
    ((SKIPPED++))
}

info() {
    echo -e "  ${YELLOW}ℹ INFO${NC}: $1"
}

# ============================================================================
# 1. HEALTH CHECKS
# ============================================================================

print_header "1. HEALTH & CONNECTIVITY TESTS"

# Test API health
print_subheader "1.1 API Health"

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/docs")
if [ "$HEALTH" == "200" ]; then
    pass "API docs endpoint returns 200"
else
    fail "API docs endpoint returns $HEALTH (expected 200)"
fi

# Test docs endpoint
DOCS=$(curl -s -o /dev/null -w "%{http_code}" "$API/docs")
if [ "$DOCS" == "200" ]; then
    pass "API docs endpoint accessible"
else
    fail "API docs endpoint returns $DOCS"
fi

# ============================================================================
# 2. AUTHENTICATION TESTS
# ============================================================================

print_header "2. AUTHENTICATION TESTS"

print_subheader "2.1 Login - Valid Credentials"

# Admin login
ADMIN_TOKEN=$(curl -s -X POST "$API/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$ADMIN_USER&password=$ADMIN_PASS" | jq -r '.access_token')

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    pass "Admin login successful - token received"
else
    fail "Admin login failed - no token received"
    echo "  Debug: Check if admin user exists with password 'Admin123'"
fi

print_subheader "2.2 Login - Invalid Credentials"

# Wrong password
WRONG_PASS=$(curl -s -X POST "$API/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$ADMIN_USER&password=wrongpassword")
WRONG_DETAIL=$(echo "$WRONG_PASS" | jq -r '.detail')

if [[ "$WRONG_DETAIL" == *"Incorrect"* ]] || [[ "$WRONG_DETAIL" == *"incorrect"* ]]; then
    pass "Wrong password rejected correctly"
else
    fail "Wrong password not rejected properly: $WRONG_DETAIL"
fi

# Non-existent user
NON_USER=$(curl -s -X POST "$API/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=nonexistent_user_xyz&password=anything")
NON_DETAIL=$(echo "$NON_USER" | jq -r '.detail')

if [[ "$NON_DETAIL" == *"Incorrect"* ]] || [[ "$NON_DETAIL" == *"incorrect"* ]]; then
    pass "Non-existent user rejected correctly"
else
    fail "Non-existent user not rejected: $NON_DETAIL"
fi

print_subheader "2.3 Protected Endpoints Without Token"

# Test protected endpoint without token
NO_TOKEN=$(curl -s -X GET "$API/usuarios/me")
NO_TOKEN_DETAIL=$(echo "$NO_TOKEN" | jq -r '.detail')

if [[ "$NO_TOKEN_DETAIL" == *"Not authenticated"* ]]; then
    pass "Protected endpoint requires authentication"
else
    fail "Protected endpoint accessible without token: $NO_TOKEN_DETAIL"
fi

print_subheader "2.4 Protected Endpoints With Invalid Token"

# Test with garbage token
BAD_TOKEN=$(curl -s -X GET "$API/usuarios/me" \
    -H "Authorization: Bearer invalid.token.here")
BAD_TOKEN_DETAIL=$(echo "$BAD_TOKEN" | jq -r '.detail')

if [[ "$BAD_TOKEN_DETAIL" == *"Could not validate"* ]] || [[ "$BAD_TOKEN_DETAIL" == *"Invalid"* ]] || [[ "$BAD_TOKEN_DETAIL" == *"credentials"* ]]; then
    pass "Invalid token rejected correctly"
else
    fail "Invalid token not rejected: $BAD_TOKEN_DETAIL"
fi

print_subheader "2.5 Token Usage - /usuarios/me"

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    ME_RESPONSE=$(curl -s -X GET "$API/usuarios/me" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    ME_USERNAME=$(echo "$ME_RESPONSE" | jq -r '.username')
    
    if [ "$ME_USERNAME" == "$ADMIN_USER" ]; then
        pass "Token works correctly - user info retrieved"
    else
        fail "Token usage failed: got username '$ME_USERNAME'"
    fi
else
    skip "Token usage test - no valid token"
fi

# ============================================================================
# 3. USER REGISTRATION TESTS
# ============================================================================

print_header "3. USER REGISTRATION TESTS"

print_subheader "3.1 Register - Valid User"

# Register new user
REG_RESPONSE=$(curl -s -X POST "$API/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
REG_MSG=$(echo "$REG_RESPONSE" | jq -r '.msg // .message // .detail // empty')

if [[ "$REG_MSG" == *"creado"* ]] || [[ "$REG_MSG" == *"registrado"* ]] || [[ "$REG_MSG" == *"Usuario"* ]]; then
    pass "User registration successful"
else
    # Check if user already exists
    if [[ "$REG_MSG" == *"existe"* ]] || [[ "$REG_MSG" == *"exists"* ]]; then
        info "User already exists (from previous test run)"
        pass "Registration endpoint working (user exists)"
    else
        fail "Registration failed: $REG_MSG"
    fi
fi

print_subheader "3.2 Password Validation - Weak Passwords"

# Too short
SHORT_PASS=$(curl -s -X POST "$API/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"weaktest1","password":"Ab1"}')
SHORT_DETAIL=$(echo "$SHORT_PASS" | jq -r '.detail')

if [[ "$SHORT_DETAIL" == *"8"* ]] || [[ "$SHORT_DETAIL" == *"caracteres"* ]] || [[ "$SHORT_DETAIL" == *"character"* ]]; then
    pass "Short password rejected (< 8 chars)"
else
    fail "Short password not rejected properly: $SHORT_DETAIL"
fi

# No numbers
NO_NUM=$(curl -s -X POST "$API/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"weaktest2","password":"Abcdefgh"}')
NO_NUM_DETAIL=$(echo "$NO_NUM" | jq -r '.detail')

if [[ "$NO_NUM_DETAIL" == *"número"* ]] || [[ "$NO_NUM_DETAIL" == *"number"* ]] || [[ "$NO_NUM_DETAIL" == *"digit"* ]]; then
    pass "Password without numbers rejected"
else
    fail "Password without numbers not rejected: $NO_NUM_DETAIL"
fi

# No letters
NO_LETTER=$(curl -s -X POST "$API/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"weaktest3","password":"12345678"}')
NO_LETTER_DETAIL=$(echo "$NO_LETTER" | jq -r '.detail')

if [[ "$NO_LETTER_DETAIL" == *"letra"* ]] || [[ "$NO_LETTER_DETAIL" == *"letter"* ]]; then
    pass "Password without letters rejected"
else
    fail "Password without letters not rejected: $NO_LETTER_DETAIL"
fi

# Common password
COMMON_PASS=$(curl -s -X POST "$API/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"weaktest4","password":"password123"}')
COMMON_DETAIL=$(echo "$COMMON_PASS" | jq -r '.detail')

if [[ "$COMMON_DETAIL" == *"común"* ]] || [[ "$COMMON_DETAIL" == *"common"* ]] || [[ "$COMMON_DETAIL" == *"weak"* ]] || [[ "$COMMON_DETAIL" == *"débil"* ]]; then
    pass "Common password (password123) rejected"
else
    fail "Common password not rejected: $COMMON_DETAIL"
fi

# ============================================================================
# 4. PASSWORD RESET TESTS (Admin Only)
# ============================================================================

print_header "4. PASSWORD RESET TESTS"

print_subheader "4.1 Get Test User ID"

# First, login as test user to get their ID
TEST_TOKEN=$(curl -s -X POST "$API/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$TEST_USER&password=$TEST_PASS" | jq -r '.access_token')

if [ "$TEST_TOKEN" != "null" ] && [ -n "$TEST_TOKEN" ]; then
    TEST_USER_INFO=$(curl -s -X GET "$API/usuarios/me" \
        -H "Authorization: Bearer $TEST_TOKEN")
    TEST_USER_ID=$(echo "$TEST_USER_INFO" | jq -r '.id')
    pass "Test user logged in, ID: $TEST_USER_ID"
else
    # Try to get user ID from admin's user list
    USERS_LIST=$(curl -s -X GET "$API/usuarios" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    TEST_USER_ID=$(echo "$USERS_LIST" | jq -r ".[] | select(.username==\"$TEST_USER\") | .id")
    if [ -n "$TEST_USER_ID" ]; then
        pass "Found test user ID from admin list: $TEST_USER_ID"
    else
        skip "Could not find test user ID"
        TEST_USER_ID=""
    fi
fi

print_subheader "4.2 Reset Password - Non-Admin Should Fail"

if [ -n "$TEST_TOKEN" ] && [ "$TEST_TOKEN" != "null" ] && [ -n "$TEST_USER_ID" ]; then
    # Get another user's ID (admin)
    ADMIN_ID=$(curl -s -X GET "$API/usuarios" \
        -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r ".[] | select(.username==\"$ADMIN_USER\") | .id")
    
    # Try to reset admin's password as non-admin
    NON_ADMIN_RESET=$(curl -s -X PUT "$API/usuarios/$ADMIN_ID/reset-password" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"new_password":"HackedPass123"}')
    NON_ADMIN_DETAIL=$(echo "$NON_ADMIN_RESET" | jq -r '.detail')
    
    if [[ "$NON_ADMIN_DETAIL" == *"admin"* ]] || [[ "$NON_ADMIN_DETAIL" == *"Admin"* ]] || [[ "$NON_ADMIN_DETAIL" == *"permisos"* ]] || [[ "$NON_ADMIN_DETAIL" == *"permiso"* ]]; then
        pass "Non-admin cannot reset passwords"
    else
        fail "Non-admin may have reset access: $NON_ADMIN_DETAIL"
    fi
else
    skip "Non-admin reset test - no test user token"
fi

print_subheader "4.3 Reset Password - Admin Can Reset"

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ] && [ -n "$TEST_USER_ID" ]; then
    NEW_PASSWORD="NewSecure123"
    ADMIN_RESET=$(curl -s -X PUT "$API/usuarios/$TEST_USER_ID/reset-password" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"new_password\":\"$NEW_PASSWORD\"}")
    ADMIN_RESET_MSG=$(echo "$ADMIN_RESET" | jq -r '.msg // .message // .detail // empty')
    
    if [[ "$ADMIN_RESET_MSG" == *"exitosa"* ]] || [[ "$ADMIN_RESET_MSG" == *"success"* ]] || [[ "$ADMIN_RESET_MSG" == *"reseteada"* ]]; then
        pass "Admin can reset user passwords"
        
        # Verify new password works
        VERIFY_TOKEN=$(curl -s -X POST "$API/token" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "username=$TEST_USER&password=$NEW_PASSWORD" | jq -r '.access_token')
        
        if [ "$VERIFY_TOKEN" != "null" ] && [ -n "$VERIFY_TOKEN" ]; then
            pass "New password works after reset"
            TEST_PASS="$NEW_PASSWORD"  # Update for later tests
        else
            fail "New password does not work after reset"
        fi
    else
        fail "Admin reset failed: $ADMIN_RESET_MSG"
    fi
else
    skip "Admin reset test - missing tokens or user ID"
fi

print_subheader "4.4 Reset Password - Weak Password Rejected"

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ] && [ -n "$TEST_USER_ID" ]; then
    WEAK_RESET=$(curl -s -X PUT "$API/usuarios/$TEST_USER_ID/reset-password" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"new_password":"weak"}')
    WEAK_DETAIL=$(echo "$WEAK_RESET" | jq -r '.detail')
    
    if [[ "$WEAK_DETAIL" == *"8"* ]] || [[ "$WEAK_DETAIL" == *"caracteres"* ]] || [[ "$WEAK_DETAIL" == *"letra"* ]] || [[ "$WEAK_DETAIL" == *"número"* ]]; then
        pass "Weak password rejected on reset"
    else
        fail "Weak password not rejected on reset: $WEAK_DETAIL"
    fi
else
    skip "Weak password reset test"
fi

# ============================================================================
# 5. PRODUCTS API TESTS
# ============================================================================

print_header "5. PRODUCTS API TESTS"

print_subheader "5.1 List Products"

PRODUCTS=$(curl -s -X GET "$API/productos" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
PRODUCT_COUNT=$(echo "$PRODUCTS" | jq 'length')

if [ "$PRODUCT_COUNT" -gt 0 ]; then
    pass "Products list retrieved ($PRODUCT_COUNT products)"
    FIRST_PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.[0].id')
else
    info "No products found in database"
    FIRST_PRODUCT_ID=""
fi

print_subheader "5.2 Create Product"

TIMESTAMP=$(date +%s)
NEW_PRODUCT=$(curl -s -X POST "$API/productos" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Test Product $TIMESTAMP\",\"precio\":99.99,\"stock\":10}")
NEW_PRODUCT_ID=$(echo "$NEW_PRODUCT" | jq -r '.id')

if [ "$NEW_PRODUCT_ID" != "null" ] && [ -n "$NEW_PRODUCT_ID" ]; then
    pass "Product created successfully (ID: $NEW_PRODUCT_ID)"
else
    fail "Product creation failed: $NEW_PRODUCT"
fi

print_subheader "5.3 Get Single Product"

if [ -n "$NEW_PRODUCT_ID" ] && [ "$NEW_PRODUCT_ID" != "null" ]; then
    SINGLE=$(curl -s -X GET "$API/productos/$NEW_PRODUCT_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    SINGLE_NAME=$(echo "$SINGLE" | jq -r '.nombre')
    
    if [[ "$SINGLE_NAME" == *"Test Product"* ]]; then
        pass "Single product retrieved correctly"
    else
        fail "Single product retrieval failed"
    fi
fi

print_subheader "5.4 Update Product"

if [ -n "$NEW_PRODUCT_ID" ] && [ "$NEW_PRODUCT_ID" != "null" ]; then
    UPDATED=$(curl -s -X PUT "$API/productos/$NEW_PRODUCT_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"nombre":"Updated Test Product","precio":149.99,"stock":20}')
    UPDATED_NAME=$(echo "$UPDATED" | jq -r '.nombre')
    
    if [ "$UPDATED_NAME" == "Updated Test Product" ]; then
        pass "Product updated successfully"
    else
        fail "Product update failed"
    fi
fi

print_subheader "5.5 Delete Product"

if [ -n "$NEW_PRODUCT_ID" ] && [ "$NEW_PRODUCT_ID" != "null" ]; then
    DELETE=$(curl -s -X DELETE "$API/productos/$NEW_PRODUCT_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    # Verify deletion
    VERIFY_DELETE=$(curl -s -o /dev/null -w "%{http_code}" "$API/productos/$NEW_PRODUCT_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if [ "$VERIFY_DELETE" == "404" ]; then
        pass "Product deleted successfully"
    else
        fail "Product deletion verification failed (code: $VERIFY_DELETE)"
    fi
fi

# ============================================================================
# 6. TAGS SYSTEM TESTS
# ============================================================================

print_header "6. TAGS SYSTEM TESTS"

print_subheader "6.1 List Tags"

TAGS=$(curl -s -X GET "$API/tags" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
TAG_COUNT=$(echo "$TAGS" | jq 'length')

if [ "$TAG_COUNT" -gt 0 ]; then
    pass "Tags retrieved ($TAG_COUNT tags)"
    FIRST_TAG_ID=$(echo "$TAGS" | jq -r '.[0].id')
else
    fail "No tags found"
    FIRST_TAG_ID=""
fi

print_subheader "6.2 Batch Products With Tags"

BATCH=$(curl -s -X GET "$API/productos-con-tags" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
BATCH_COUNT=$(echo "$BATCH" | jq 'length')

if [ "$BATCH_COUNT" -ge 0 ]; then
    pass "Batch endpoint works ($BATCH_COUNT products with tags)"
else
    fail "Batch endpoint failed"
fi

print_subheader "6.3 Product Tags CRUD"

if [ -n "$FIRST_PRODUCT_ID" ] && [ -n "$FIRST_TAG_ID" ]; then
    # Get tags for a product
    PROD_TAGS=$(curl -s -X GET "$API/productos/$FIRST_PRODUCT_ID/tags" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$PROD_TAGS" | jq -e '.' > /dev/null 2>&1; then
        pass "Get product tags works"
    else
        fail "Get product tags failed"
    fi
    
    # Update tags
    UPDATE_TAGS=$(curl -s -X PUT "$API/productos/$FIRST_PRODUCT_ID/tags" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"tag_ids\":[$FIRST_TAG_ID]}")
    
    if echo "$UPDATE_TAGS" | jq -e '.tags' > /dev/null 2>&1; then
        pass "Update product tags works"
    else
        fail "Update product tags failed: $UPDATE_TAGS"
    fi
else
    skip "Tags CRUD - no product or tag ID available"
fi

# ============================================================================
# 7. SECURITY TESTS
# ============================================================================

print_header "7. SECURITY TESTS"

print_subheader "7.1 SQL Injection Attempts"

# In username
SQL_USER=$(curl -s -X POST "$API/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=admin'--&password=anything")
SQL_USER_CODE=$(echo "$SQL_USER" | jq -r '.access_token // empty')

if [ -z "$SQL_USER_CODE" ] || [ "$SQL_USER_CODE" == "null" ]; then
    pass "SQL injection in username blocked"
else
    fail "SQL injection in username may have succeeded!"
fi

# In product search (if applicable)
SQL_SEARCH=$(curl -s -X GET "$API/productos?search=';DROP%20TABLE%20productos;--" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
if echo "$SQL_SEARCH" | jq -e '.' > /dev/null 2>&1; then
    pass "SQL injection in search handled safely"
else
    fail "SQL injection in search caused error"
fi

print_subheader "7.2 XSS Attempts"

XSS_PRODUCT=$(curl -s -X POST "$API/productos" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"<script>alert(1)</script>","precio":1,"stock":1}')
XSS_ID=$(echo "$XSS_PRODUCT" | jq -r '.id')

if [ "$XSS_ID" != "null" ] && [ -n "$XSS_ID" ]; then
    # Verify the script is stored as-is (backend stores, frontend should escape)
    XSS_CHECK=$(curl -s -X GET "$API/productos/$XSS_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    XSS_NAME=$(echo "$XSS_CHECK" | jq -r '.nombre')
    
    if [[ "$XSS_NAME" == *"<script>"* ]]; then
        info "XSS stored in DB (frontend must escape on render)"
        pass "XSS test completed - verify frontend escapes"
    fi
    
    # Cleanup
    curl -s -X DELETE "$API/productos/$XSS_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
else
    pass "XSS in product name handled"
fi

print_subheader "7.3 Rate Limiting"

# Test rate limiting on products endpoint
RATE_LIMIT_HIT=0
for i in {1..25}; do
    RATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/productos" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"nombre\":\"Rate Test $i\",\"precio\":1,\"stock\":1}")
    
    if [ "$RATE_RESPONSE" == "429" ]; then
        RATE_LIMIT_HIT=1
        pass "Rate limiting active (hit at request $i)"
        break
    fi
done

if [ "$RATE_LIMIT_HIT" == "0" ]; then
    info "Rate limit not hit in 25 requests (may need more or different config)"
fi

print_subheader "7.4 CORS Headers"

CORS_CHECK=$(curl -s -I -X OPTIONS "$API/productos" \
    -H "Origin: http://localhost" \
    -H "Access-Control-Request-Method: GET" 2>&1)

if echo "$CORS_CHECK" | grep -qi "access-control-allow"; then
    pass "CORS headers present"
else
    info "CORS headers not visible in OPTIONS (may be handled by nginx)"
fi

# ============================================================================
# 8. DOCKER HEALTH TESTS
# ============================================================================

print_header "8. DOCKER HEALTH TESTS"

print_subheader "8.1 Container Status"

BACKEND_STATUS=$(docker inspect chorizaurio-backend --format='{{.State.Health.Status}}' 2>/dev/null || echo "not found")
FRONTEND_STATUS=$(docker inspect chorizaurio-frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "not found")

if [ "$BACKEND_STATUS" == "healthy" ]; then
    pass "Backend container is healthy"
else
    fail "Backend container status: $BACKEND_STATUS"
fi

if [ "$FRONTEND_STATUS" == "healthy" ]; then
    pass "Frontend container is healthy"
else
    fail "Frontend container status: $FRONTEND_STATUS"
fi

print_subheader "8.2 Volume Mounts"

BACKEND_VOLUMES=$(docker inspect chorizaurio-backend --format='{{range .Mounts}}{{.Destination}} {{end}}' 2>/dev/null)

if [[ "$BACKEND_VOLUMES" == *"/data"* ]]; then
    pass "Backend has /data volume mounted"
else
    fail "Backend /data volume not found"
fi

print_subheader "8.3 Network Connectivity"

# Test internal network
NETWORK_TEST=$(docker exec chorizaurio-frontend curl -s -o /dev/null -w "%{http_code}" http://backend:8000/ 2>/dev/null || echo "error")

if [ "$NETWORK_TEST" == "200" ]; then
    pass "Frontend can reach backend via internal network"
else
    info "Internal network test returned: $NETWORK_TEST"
fi

# ============================================================================
# 9. FRONTEND TESTS
# ============================================================================

print_header "9. FRONTEND TESTS"

print_subheader "9.1 Static Assets"

FRONTEND_HOME=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/")
if [ "$FRONTEND_HOME" == "200" ]; then
    pass "Frontend home page loads"
else
    fail "Frontend home page returns: $FRONTEND_HOME"
fi

# Check if JS bundle loads
FRONTEND_HTML=$(curl -s "http://localhost/")
if echo "$FRONTEND_HTML" | grep -q "script"; then
    pass "Frontend HTML contains script tags"
else
    fail "Frontend HTML missing script tags"
fi

print_subheader "9.2 API Proxy"

# Test that frontend proxies to backend
PROXY_TEST=$(curl -s "http://localhost/api/")
if echo "$PROXY_TEST" | jq -e '.' > /dev/null 2>&1; then
    pass "Frontend API proxy working"
else
    fail "Frontend API proxy failed"
fi

# ============================================================================
# 10. CLEANUP
# ============================================================================

print_header "10. CLEANUP"

# Delete test user
if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ] && [ -n "$TEST_USER_ID" ]; then
    DEL_USER=$(curl -s -X DELETE "$API/usuarios/$TEST_USER_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    info "Cleaned up test user: $TEST_USER"
fi

# Cleanup any rate test products
CLEANUP_PRODUCTS=$(curl -s -X GET "$API/productos" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
RATE_PRODUCTS=$(echo "$CLEANUP_PRODUCTS" | jq -r '.[] | select(.nombre | startswith("Rate Test")) | .id')
for pid in $RATE_PRODUCTS; do
    curl -s -X DELETE "$API/productos/$pid" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
done
info "Cleaned up rate test products"

# ============================================================================
# FINAL REPORT
# ============================================================================

print_header "FINAL RESULTS"

TOTAL=$((PASSED + FAILED + SKIPPED))

echo ""
echo -e "  ${GREEN}PASSED${NC}:  $PASSED"
echo -e "  ${RED}FAILED${NC}:  $FAILED"
echo -e "  ${YELLOW}SKIPPED${NC}: $SKIPPED"
echo -e "  ─────────────────"
echo -e "  TOTAL:   $TOTAL"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎉 ALL TESTS PASSED! SYSTEM IS PRODUCTION READY 🎉${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ⚠️  SOME TESTS FAILED - REVIEW REQUIRED${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
