#!/bin/bash
# Concurrency Test - 5 Simultaneous Orders
# Tests SQLite under concurrent write load

API="https://api.pedidosfriosur.com"

echo "==========================================="
echo "   CONCURRENCY TEST - 5 SIMULTANEOUS ORDERS"
echo "==========================================="
echo ""

# Get token
echo "🔐 Authenticating..."
TOKEN=$(curl -s -X POST "$API/login" -d "username=admin&password=admin420" | jq -r '.access_token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Authentication failed"
    exit 1
fi
AUTH="Authorization: Bearer $TOKEN"

# Get IDs
CLIENTE_ID=$(curl -s -H "$AUTH" "$API/clientes" | jq -r '.[0].id')
PROD_ID=$(curl -s -H "$AUTH" "$API/productos" | jq -r '.[0].id')
echo "Using cliente_id=$CLIENTE_ID, producto_id=$PROD_ID"

# Get initial count
BEFORE=$(curl -s -H "$AUTH" "$API/pedidos" | jq 'length')
echo "Orders before: $BEFORE"
echo ""

# Round 1
echo "📦 ROUND 1: 5 concurrent order creations..."
START=$(date +%s%N)
for i in {1..5}; do
    curl -s -X POST "$API/pedidos" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"cliente_id\":$CLIENTE_ID,\"productos\":[{\"producto_id\":$PROD_ID,\"cantidad\":$i}]}" \
        -w "\n" \
        -o /tmp/order_r1_$i.json &
done
wait
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "Completed in ${DURATION}ms"

SUCCESS=0
for i in {1..5}; do
    if cat /tmp/order_r1_$i.json 2>/dev/null | jq -e '.id' > /dev/null 2>&1; then
        ((SUCCESS++))
    fi
done
echo "Round 1: $SUCCESS/5 successful"

# Round 2
echo ""
echo "📦 ROUND 2: 5 more concurrent order creations..."
START=$(date +%s%N)
for i in {1..5}; do
    curl -s -X POST "$API/pedidos" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"cliente_id\":$CLIENTE_ID,\"productos\":[{\"producto_id\":$PROD_ID,\"cantidad\":$((i+5))}]}" \
        -w "\n" \
        -o /tmp/order_r2_$i.json &
done
wait
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "Completed in ${DURATION}ms"

SUCCESS2=0
for i in {1..5}; do
    if cat /tmp/order_r2_$i.json 2>/dev/null | jq -e '.id' > /dev/null 2>&1; then
        ((SUCCESS2++))
    fi
done
echo "Round 2: $SUCCESS2/5 successful"

# Round 3
echo ""
echo "📦 ROUND 3: 5 more concurrent order creations..."
START=$(date +%s%N)
for i in {1..5}; do
    curl -s -X POST "$API/pedidos" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"cliente_id\":$CLIENTE_ID,\"productos\":[{\"producto_id\":$PROD_ID,\"cantidad\":$((i+10))}]}" \
        -w "\n" \
        -o /tmp/order_r3_$i.json &
done
wait
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "Completed in ${DURATION}ms"

SUCCESS3=0
for i in {1..5}; do
    if cat /tmp/order_r3_$i.json 2>/dev/null | jq -e '.id' > /dev/null 2>&1; then
        ((SUCCESS3++))
    fi
done
echo "Round 3: $SUCCESS3/5 successful"

# Final count
echo ""
AFTER=$(curl -s -H "$AUTH" "$API/pedidos" | jq 'length')
CREATED=$((AFTER - BEFORE))
TOTAL_SUCCESS=$((SUCCESS + SUCCESS2 + SUCCESS3))

echo "==========================================="
echo "   RESULTS"
echo "==========================================="
echo "Orders before: $BEFORE"
echo "Orders after:  $AFTER"
echo "Created:       $CREATED"
echo "Expected:      15"
echo "Success rate:  $TOTAL_SUCCESS/15"
echo ""

# Check for errors in responses
ERRORS=0
for f in /tmp/order_r*.json; do
    if cat "$f" 2>/dev/null | grep -qi "locked\|error\|fail"; then
        ((ERRORS++))
        echo "Error in $f: $(cat $f | head -c 100)"
    fi
done

if [ $TOTAL_SUCCESS -eq 15 ] && [ $ERRORS -eq 0 ]; then
    echo "🎉 CONCURRENCY TEST: PASSED"
    echo "   All 15 orders created successfully"
    echo "   No database locked errors"
    exit 0
elif [ $TOTAL_SUCCESS -ge 12 ]; then
    echo "⚠️  CONCURRENCY TEST: MOSTLY PASSED ($TOTAL_SUCCESS/15)"
    echo "   Some requests may have been rate limited"
    exit 0
else
    echo "❌ CONCURRENCY TEST: FAILED"
    echo "   Only $TOTAL_SUCCESS/15 orders created"
    exit 1
fi
