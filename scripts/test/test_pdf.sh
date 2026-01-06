#!/usr/bin/env bash
# Test PDF generation with demo orders
# Creates test pedidos and generates PDF to verify pagination

set -euo pipefail

API_URL=${API_URL:-"http://localhost:8000"}
USERNAME=${USERNAME:-"testui"}
PASSWORD=${PASSWORD:-"testui123"}

echo "=== PDF Generation Test ==="

# Login
echo "Logging in..."
TOKEN=$(curl -s -X POST "$API_URL/login" \
  -d "username=$USERNAME&password=$PASSWORD" | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo "Token acquired"

# Get a client
echo "Getting client..."
CLIENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/clientes" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')")

if [ -z "$CLIENT_ID" ]; then
  echo "No clients found, creating one..."
  CLIENT_ID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Test PDF Client","barrio":"Test"}' \
    "$API_URL/clientes" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
fi
echo "Using client ID: $CLIENT_ID"

# Get products
echo "Getting products..."
PRODUCTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/productos" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(','.join([str(p['id']) for p in d[:10]]))")

echo "Products: $PRODUCTS"

# Create test pedidos (4 with many products, 4 with few)
PEDIDO_IDS=""

create_pedido() {
  local num_products=$1
  local name="$2"
  
  # Build productos array - use products with ID 1-15 (have stock)
  PRODS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/productos" | \
    python3 -c "
import sys,json
d=json.load(sys.stdin)
# Filter products with id 1-15 (have stock=100)
good = [p for p in d if p['id'] <= 15][:$num_products]
items = [{'id':p['id'],'cantidad':2,'tipo':'unidad','precio':p.get('precio',10),'nombre':p['nombre']} for p in good]
print(json.dumps(items))
")
  
  # Debug: show what we're sending
  # echo "Products for $name: $PRODS"
  
  RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"cliente\":{\"id\":$CLIENT_ID},\"productos\":$PRODS}" \
    "$API_URL/pedidos")
  
  PEDIDO_ID=$(echo "$RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || echo "")
  
  if [ -n "$PEDIDO_ID" ] && [ "$PEDIDO_ID" != "" ]; then
    echo "Created pedido $name (#$PEDIDO_ID) with $num_products products"
    if [ -z "$PEDIDO_IDS" ]; then
      PEDIDO_IDS="$PEDIDO_ID"
    else
      PEDIDO_IDS="$PEDIDO_IDS,$PEDIDO_ID"
    fi
  else
    echo "Failed to create pedido $name: $RESPONSE"
  fi
}

echo ""
echo "Creating test pedidos..."
create_pedido 15 "Large-1"
create_pedido 12 "Large-2"
create_pedido 10 "Large-3"
create_pedido 8 "Large-4"
create_pedido 3 "Short-1"
create_pedido 2 "Short-2"
create_pedido 4 "Short-3"
create_pedido 3 "Short-4"

echo ""
echo "Pedido IDs: $PEDIDO_IDS"

# Generate PDF
echo ""
echo "Generating PDF..."
IDS_JSON="[$(echo $PEDIDO_IDS | sed 's/,/, /g')]"

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pedido_ids\":$IDS_JSON}" \
  "$API_URL/pedidos/generar_pdfs" \
  -o test_pedidos.pdf

if [ -f test_pedidos.pdf ]; then
  SIZE=$(stat -c%s test_pedidos.pdf 2>/dev/null || stat -f%z test_pedidos.pdf)
  echo "PDF generated: test_pedidos.pdf ($SIZE bytes)"
  
  # Check if it's a valid PDF
  if head -c 5 test_pedidos.pdf | grep -q "%PDF"; then
    echo "✓ Valid PDF file"
  else
    echo "✗ Invalid PDF file"
    head -c 200 test_pedidos.pdf
  fi
else
  echo "✗ Failed to generate PDF"
fi

echo ""
echo "=== Test Complete ==="
echo "Open test_pedidos.pdf to verify pagination"
