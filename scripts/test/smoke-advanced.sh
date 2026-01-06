#!/usr/bin/env bash
set -euo pipefail

API_URL=${API_URL:-"http://localhost:8000"}
USERNAME=${USERNAME:-"testui"}
PASSWORD=${PASSWORD:-"testui123"}

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }
}

require curl
require jq

ts() { date +"%H:%M:%S"; }
log() { echo "[$(ts)] $*"; }

urlencode() { jq -rn --arg v "$1" '$v|@uri'; }

request() {
  local method=$1 url=$2 body=${3-}
  local tmp; tmp=$(mktemp)
  local args=(-s -o "$tmp" -w "%{http_code}" -X "$method" -H "Authorization: Bearer $TOKEN")
  if [[ -n $body ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi
  local code
  code=$(curl "${args[@]}" "$url")
  local out
  out=$(cat "$tmp")
  rm -f "$tmp"
  if [[ ${code:0:1} != 2 ]]; then
    echo "Request failed [$method $url] -> $code" >&2
    echo "$out" >&2
    exit 1
  fi
  echo "$out"
}

log "=== ADVANCED SMOKE TESTS ==="

log "Login as $USERNAME"
login_tmp=$(mktemp)
login_code=$(curl -s -o "$login_tmp" -w "%{http_code}" -X POST "$API_URL/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$USERNAME&password=$PASSWORD")
if [[ ${login_code:0:1} != 2 ]]; then
  echo "Login failed ($login_code):" >&2
  cat "$login_tmp" >&2
  rm -f "$login_tmp"
  exit 1
fi
TOKEN=$(jq -r '.access_token' "$login_tmp")
rm -f "$login_tmp"
if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "No access_token returned" >&2
  exit 1
fi
log "Token acquired"

# === TEST: Stock Low Warning ===
log "Testing preview_stock with low-stock product"

# First, find or create a product with low stock
productos_json=$(request GET "$API_URL/productos")
low_stock_product=$(echo "$productos_json" | jq -r 'map(select((.stock // 0) <= 2)) | first')
low_stock_id=$(echo "$low_stock_product" | jq -r '.id // empty')

if [[ -z "$low_stock_id" ]]; then
  log "No existing low-stock product; creating test product with stock=2"
  prod_payload=$(jq -n '{nombre:"Test Low Stock",precio:99.99,stock:2,stock_tipo:"unidad",stock_minimo:10}')
  prod_resp=$(request POST "$API_URL/productos" "$prod_payload")
  low_stock_id=$(echo "$prod_resp" | jq -r '.id // empty')
  if [[ -z "$low_stock_id" ]]; then
    echo "Failed to create low-stock test product" >&2
    exit 1
  fi
  log "Created test product #$low_stock_id with stock=2"
  actual_stock=2
else
  actual_stock=$(echo "$low_stock_product" | jq '.stock // 0')
  log "Found low-stock product #$low_stock_id with stock=$actual_stock"
fi

# Create a client for low-stock test
ts_suffix=$(date +%s)
CLIENT_NAME="Smoke Low Stock $ts_suffix"
client_payload=$(jq -n --arg n "$CLIENT_NAME" --arg t "555-LOW" --arg d "Test St" '{nombre:$n,telefono:$t,direccion:$d}')
request POST "$API_URL/clientes" "$client_payload" >/dev/null

q_name=$(urlencode "$CLIENT_NAME")
client_lookup=$(request GET "$API_URL/clientes?search=$q_name")
CLIENT_ID=$(echo "$client_lookup" | jq -r --arg name "$CLIENT_NAME" '(if type=="object" and has("data") then .data else . end) | map(select(.nombre==$name)) | first | .id // empty')

# Attempt pedido with qty greater than stock (should fail gracefully)
qty_to_request=$((actual_stock + 1))
pedido_payload=$(jq -n \
  --argjson cid "$CLIENT_ID" \
  --arg cname "$CLIENT_NAME" \
  --argjson pid "$low_stock_id" \
  --arg pname "Low Stock Prod" \
  --argjson pprecio 99.99 \
  --argjson qty "$qty_to_request" \
  '{cliente:{id:$cid,nombre:$cname,telefono:"555-LOW",direccion:"Test St"},productos:[{id:$pid,nombre:$pname,precio:$pprecio,cantidad:$qty,tipo:"unidad"}]}')

# Expect 400 with stock error
pedido_tmp=$(mktemp)
pedido_code=$(curl -s -o "$pedido_tmp" -w "%{http_code}" -X POST "$API_URL/pedidos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$pedido_payload")
if [[ "$pedido_code" == "400" ]]; then
  log "✓ Stock validation: pedido qty $qty_to_request rejected (stock=$actual_stock)"
elif [[ ${pedido_code:0:1} == 2 ]]; then
  PEDIDO_ID=$(jq -r '.id // empty' "$pedido_tmp")
  if [[ -n "$PEDIDO_ID" ]]; then
    log "⚠ Pedido created despite qty=$qty_to_request > stock=$actual_stock (id=$PEDIDO_ID)"
    request DELETE "$API_URL/pedidos/$PEDIDO_ID" >/dev/null
  fi
else
  log "⚠ Unexpected response code: $pedido_code"
fi
rm -f "$pedido_tmp"

# Cleanup
request DELETE "$API_URL/clientes/$CLIENT_ID" >/dev/null
log "Cleaned up low-stock test"

# === TEST: Invalid Token 401 ===
log "Testing invalid token (should return 401)"
invalid_tmp=$(mktemp)
invalid_code=$(curl -s -o "$invalid_tmp" -w "%{http_code}" -X GET "$API_URL/clientes" \
  -H "Authorization: Bearer INVALID_TOKEN_XYZ")
if [[ "$invalid_code" == "401" ]]; then
  log "✓ Invalid token correctly returns 401"
else
  log "⚠ Expected 401, got $invalid_code"
fi
rm -f "$invalid_tmp"

log "Advanced smoke tests completed"
