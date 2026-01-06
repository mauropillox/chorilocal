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

log "GET /clientes (sanity)"
request GET "$API_URL/clientes?limit=1" >/dev/null

ts_suffix=$(date +%s)
CLIENT_NAME="Smoke Client $ts_suffix"
CLIENT_TEL="555-SMOKE"
CLIENT_DIR="Smoke Street"
client_payload=$(jq -n --arg n "$CLIENT_NAME" --arg t "$CLIENT_TEL" --arg d "$CLIENT_DIR" '{nombre:$n, telefono:$t, direccion:$d}')

log "POST /clientes -> $CLIENT_NAME"
request POST "$API_URL/clientes" "$client_payload" >/dev/null

q_name=$(urlencode "$CLIENT_NAME")
client_lookup=$(request GET "$API_URL/clientes?search=$q_name")
CLIENT_ID=$(echo "$client_lookup" | jq -r --arg name "$CLIENT_NAME" '
  (if type=="object" and has("data") then .data else . end)
  | map(select(.nombre==$name))
  | first
  | .id // empty')
if [[ -z "$CLIENT_ID" ]]; then
  echo "Could not resolve client id for $CLIENT_NAME" >&2
  exit 1
fi
log "Client id: $CLIENT_ID"

log "GET /productos"
productos_json=$(request GET "$API_URL/productos")

# Parse productos field by field to avoid issues with tabs/special chars in names
PROD_ID=$(echo "$productos_json" | jq -r 'map(select((.stock // 0) > 0))[0].id // empty')
if [[ -z "$PROD_ID" || "$PROD_ID" == "null" ]]; then
  echo "No product with stock available" >&2
  exit 1
fi

PROD_NAME=$(echo "$productos_json" | jq -r --argjson id "$PROD_ID" 'map(select(.id == $id))[0].nombre // empty')
PROD_PRECIO=$(echo "$productos_json" | jq -r --argjson id "$PROD_ID" 'map(select(.id == $id))[0].precio // empty')
PROD_TIPO="unidad"

log "Using product #$PROD_ID ($PROD_NAME)"

# Ensure PROD_PRECIO is a valid number
if [[ -z "$PROD_PRECIO" || "$PROD_PRECIO" == "null" ]]; then
  PROD_PRECIO="100.0"
fi

pedido_payload=$(jq -n \
  --argjson cid "$CLIENT_ID" \
  --arg cname "$CLIENT_NAME" \
  --arg ctel "$CLIENT_TEL" \
  --arg cdir "$CLIENT_DIR" \
  --argjson pid "$PROD_ID" \
  --arg pname "$PROD_NAME" \
  --arg pprecio "$PROD_PRECIO" \
  --arg ptipo "$PROD_TIPO" \
  '{cliente:{id:$cid,nombre:$cname,telefono:$ctel,direccion:$cdir}, productos:[{id:$pid,nombre:$pname,precio:$pprecio,cantidad:1,tipo:$ptipo}]}')

log "POST /pedidos (crear pedido de prueba)"
pedido_resp=$(request POST "$API_URL/pedidos" "$pedido_payload")
PEDIDO_ID=$(echo "$pedido_resp" | jq -r '.id // .pedido_id // .data?.id // empty')
if [[ -z "$PEDIDO_ID" ]]; then
  echo "No pedido id returned" >&2
  echo "$pedido_resp" >&2
  exit 1
fi
log "Pedido id: $PEDIDO_ID"

log "POST /pedidos/preview_stock"
request POST "$API_URL/pedidos/preview_stock" "$(jq -n --argjson pid "$PEDIDO_ID" '{pedido_ids: [$pid]}')" >/dev/null

log "DELETE /pedidos/$PEDIDO_ID"
request DELETE "$API_URL/pedidos/$PEDIDO_ID" >/dev/null

log "DELETE /pedidos/$PEDIDO_ID"
request DELETE "$API_URL/pedidos/$PEDIDO_ID" >/dev/null

log "DELETE /clientes/$CLIENT_ID"
request DELETE "$API_URL/clientes/$CLIENT_ID" >/dev/null

log "GET /clientes/export/csv"
csv_cli=$(request GET "$API_URL/clientes/export/csv")
csv_cli_size=${#csv_cli}
if [[ $csv_cli_size -lt 10 ]]; then
  echo "CSV clientes too small ($csv_cli_size bytes)" >&2
  exit 1
fi

log "GET /productos/export/csv"
csv_prod=$(request GET "$API_URL/productos/export/csv")
csv_prod_size=${#csv_prod}
if [[ $csv_prod_size -lt 10 ]]; then
  echo "CSV productos too small ($csv_prod_size bytes)" >&2
  exit 1
fi

log "GET /pedidos/export/csv"
csv_ped=$(request GET "$API_URL/pedidos/export/csv")
csv_ped_size=${#csv_ped}
if [[ $csv_ped_size -lt 10 ]]; then
  echo "CSV pedidos too small ($csv_ped_size bytes)" >&2
  exit 1
fi

log "Smoke tests OK"
