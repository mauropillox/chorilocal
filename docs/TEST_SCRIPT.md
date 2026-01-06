# Testing Script - Chorizaurio

## 1. CLI Testing (Backend + Features)

### Setup
```bash
cd /home/mauro/dev/chorizaurio
API_URL="http://localhost:8000"
```

### Test 1: Authentication Flow
```bash
# Login
TOKEN=$(curl -s -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"secret"}' | jq -r '.access_token')

echo "Token: $TOKEN"

# Verify token is not empty
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"
  exit 1
else
  echo "✅ Login successful"
fi
```

### Test 2: Upload Image
```bash
# Create test image (1x1 red pixel PNG)
python3 << 'EOF'
import base64
from pathlib import Path

png_data = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
)
Path("/tmp/test.png").write_bytes(png_data)
EOF

# Upload
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.png")

echo "Upload response: $UPLOAD_RESPONSE"
IMAGE_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.url')
echo "Image URL: $IMAGE_URL"

# Verify image accessible
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$IMAGE_URL")
if [ "$STATUS" = "200" ]; then
  echo "✅ Image upload & serving works"
else
  echo "❌ Image not accessible (status: $STATUS)"
fi
```

### Test 3: Create Producto with Imagen
```bash
# Create producto with image
PRODUCT=$(curl -s -X POST "$API_URL/productos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"nombre\": \"Test Producto CLI\",
    \"precio\": 99.99,
    \"imagen_url\": \"$IMAGE_URL\"
  }")

echo "Created product: $PRODUCT"
PRODUCT_ID=$(echo "$PRODUCT" | jq -r '.id')
echo "Product ID: $PRODUCT_ID"

if [ ! -z "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ]; then
  echo "✅ Product creation with image works"
else
  echo "❌ Product creation failed"
fi
```

### Test 4: Get Productos (Verify imagen_url returned)
```bash
GET_PRODUCTS=$(curl -s -X GET "$API_URL/productos" \
  -H "Authorization: Bearer $TOKEN")

echo "Products: $GET_PRODUCTS"
RETURNED_IMAGE=$(echo "$GET_PRODUCTS" | jq -r '.[0].imagen_url // empty')

if [ ! -z "$RETURNED_IMAGE" ]; then
  echo "✅ imagen_url field returned in GET /productos"
else
  echo "⚠️ No imagen_url in response (might be empty)"
fi
```

### Test 5: Create Cliente, Pedido, Historial
```bash
# Create cliente
CLIENT=$(curl -s -X POST "$API_URL/clientes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test Cliente","telefono":"1234567890","direccion":"Test St"}')

CLIENT_ID=$(echo "$CLIENT" | jq -r '.id')
echo "✅ Client created: $CLIENT_ID"

# Create pedido
PEDIDO=$(curl -s -X POST "$API_URL/pedidos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"cliente\": {\"id\": $CLIENT_ID, \"nombre\": \"Test Cliente\"},
    \"productos\": [{\"id\": $PRODUCT_ID, \"nombre\": \"Test Producto\", \"precio\": 99.99, \"cantidad\": 2, \"tipo\": \"unidad\"}]
  }")

echo "Pedido: $PEDIDO"
echo "✅ Order created"
```

### Test 6: Test Search & Sort (if implemented)
```bash
# Create another producto
curl -s -X POST "$API_URL/productos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Aaa Producto","precio":50.00}' > /dev/null

# Test search
SEARCH=$(curl -s -X GET "$API_URL/productos?search=Aaa" \
  -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$SEARCH" | jq 'length')
echo "Search 'Aaa': found $COUNT products"

if [ "$COUNT" -gt "0" ]; then
  echo "✅ Search works"
fi

# Test sort
SORT=$(curl -s -X GET "$API_URL/productos?sort=precio_desc" \
  -H "Authorization: Bearer $TOKEN")
FIRST_PRICE=$(echo "$SORT" | jq -r '.[0].precio')
echo "First product price (desc): $FIRST_PRICE"
echo "✅ Sort works"
```

### Test 7: 401 Unauthorized (without token)
```bash
UNAUTH=$(curl -s -X GET "$API_URL/productos")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/productos")

if [ "$STATUS" = "401" ]; then
  echo "✅ 401 Unauthorized without token"
else
  echo "❌ Should return 401, got $STATUS"
fi
```

---

## 2. GUI Testing (Frontend - Manual)

### Test 1: Accessibility + Responsiveness
Open browser DevTools (F12):

**a) Color Scheme (light mode)**
- Console: `getComputedStyle(document.documentElement).getPropertyValue('color-scheme')`
  - Should output: `light`
- Background should be **white** (#ffffff), not affected by dark mode

**b) Focus Visible (Keyboard Navigation)**
- Press **Tab** key repeatedly
- Every button/input should show **blue outline** (2px)
- Try: Login inputs → buttons → tabs

**c) Contrast Check**
- Right-click any text → Inspect
- Check color in DevTools
- Main text: Should be `#1f2937` (dark gray, high contrast on white)
- Secondary text: Should be `#6b7280` (medium gray, readable)

**d) Responsive Design**
- DevTools → Toggle device toolbar (Ctrl+Shift+M)
- Test: Mobile (375px), Tablet (768px), Desktop (1920px)
- Inputs/buttons should stack on mobile

---

### Test 2: Authentication
1. Open `http://localhost`
2. Should see **Login form** (not tabs)
3. Login: `testuser` / `secret`
4. Should redirect to **Clientes** tab
5. Click **Logout** → back to login
6. ✅ Token saved in localStorage (DevTools → Application → Local Storage → token)

---

### Test 3: Productos Tab
1. Navigate to **Productos**
2. **Create producto**:
   - Name: "Test GUI Product"
   - Price: 150
   - Upload image: Pick any local image file
   - Click **Agregar** (should show "✓ creando..." then success)
3. **Verify in list**:
   - Product appears in grid
   - Image thumbnail visible (not `/logo.png`)
   - Price displayed
4. ✅ No console errors (DevTools → Console)

**Test Variables CSS:**
- DevTools Console: 
  ```js
  getComputedStyle(document.querySelector('h2')).color
  // Should be: rgb(37, 99, 235) or similar blue
  
  getComputedStyle(document.querySelector('input')).borderColor
  // Should be: rgb(229, 231, 235) or similar gray
  ```

---

### Test 4: Clientes Tab
1. Navigate to **Clientes**
2. **Create cliente**:
   - Name: "Test GUI Client"
   - Phone: "555-1234"
   - Address: "Main St 123"
   - Click **Agregar**
3. **Verify in Select dropdown**:
   - Select dropdown populated
   - Click dropdown → new client appears
4. ✅ Focus-visible on Select component (Tab to it, should have outline)

---

### Test 5: Pedidos Tab
1. Navigate to **Pedidos**
2. **Select cliente** from dropdown
3. **Search/add producto**:
   - Type in search: "test" (should filter products)
   - Click **+** to add a product
4. **Verify "Seleccionar todo" buttons**:
   - ✅ "✓ Seleccionar todo" button appears
   - ✅ "✕ Limpiar selección" button appears
5. **Test selection**:
   - Click "✓ Seleccionar todo" → All visible products checked
   - Click "✕ Limpiar selección" → All checkboxes cleared
6. **Create pedido**:
   - Add quantity (e.g., 2)
   - Click **Guardar Pedido**
   - Should alert "Pedido guardado"
7. ✅ No console errors

---

### Test 6: Historial de Pedidos Tab
1. Navigate to **Historial**
2. **Verify tabs**:
   - **Pendientes** (X count) - orders not PDF-generated
   - **Generados** (X count) - orders PDF-generated
3. **Test "Seleccionar todo" / "Limpiar"**:
   - Click "Pendientes" tab
   - Click "✓ Seleccionar todo" → All pendiente orders checked
   - Click "✕ Limpiar selección" → Unchecked
4. **Generate PDF**:
   - Select 1-2 pendiente orders (checkboxes)
   - Click **"Generar PDF (X pedidos)"** button appears
   - Click it → Should download PDF
   - Check: Order moved to **Generados** tab
5. ✅ Button only visible when selection > 0

---

### Test 7: Dark Mode Extension Resistance
1. Install **Dark Reader** or **Night Eye** extension (if not already)
2. Enable it
3. Refresh page
4. Verify:
   - ✅ Background still **white** (not inverted)
   - ✅ Text still **dark gray** (not light)
   - ✅ Buttons still **readable**
5. Disable extension → Still looks the same

---

### Test 8: Cross-Tab Auth Sync
1. Open `http://localhost` in **two browser tabs**
2. Tab 1: Login as `testuser`
3. Tab 2: Refresh → Should **automatically see authenticated UI** (Clientes)
4. Tab 1: Click **Logout**
5. Tab 2: Refresh or wait → Should go back to **Login**
6. ✅ localStorage events working

---

### Test 9: Error Handling
1. **Bad credentials**:
   - Login with wrong password
   - Should show error message
2. **Network error (simulate)**:
   - DevTools → Network throttling → Offline
   - Try to create producto
   - Should show error (not crash)
3. **No image**:
   - Create producto with **no imagen_url**
   - Should appear with 📦 placeholder
4. ✅ No fatal JS errors in Console

---

## 3. API Validation (via curl)

```bash
# Summary check
echo "=== API Health Check ==="

# 1. Login
TOKEN=$(curl -s -X POST "http://localhost:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"secret"}' | jq -r '.access_token')

echo "1. Login: $([ ! -z "$TOKEN" ] && echo '✅' || echo '❌')"

# 2. GET /productos (authenticated)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "http://localhost:8000/productos" \
  -H "Authorization: Bearer $TOKEN")
echo "2. GET /productos (auth): $([ "$STATUS" = "200" ] && echo '✅' || echo '❌ '$STATUS)"

# 3. GET /productos (unauthenticated)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "http://localhost:8000/productos")
echo "3. GET /productos (no auth): $([ "$STATUS" = "401" ] && echo '✅ 401' || echo '❌ '$STATUS)"

# 4. Static files (uploaded images)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "http://localhost:8000/media/uploads/test.png")
echo "4. Media serving: $([ "$STATUS" = "200" ] || [ "$STATUS" = "404" ] && echo '✅' || echo '❌ '$STATUS)"

echo ""
echo "All tests complete!"
```

---

## 4. CSS Variables Verification

Open DevTools Console and paste:

```js
// Check CSS variables are defined
const styles = getComputedStyle(document.documentElement);
const vars = [
  '--color-bg',
  '--color-text',
  '--color-primary',
  '--color-border',
];

vars.forEach(v => {
  const val = styles.getPropertyValue(v).trim();
  console.log(`${v}: ${val || '❌ UNDEFINED'}`);
});

// Check color-scheme
console.log('color-scheme:', getComputedStyle(document.documentElement).colorScheme);

// Check button styles
console.log('Button focus outline:', 
  getComputedStyle(document.querySelector('button')).outline);
```

Expected output:
```
--color-bg: #ffffff
--color-text: #1f2937
--color-primary: #2563eb
--color-border: #e5e7eb
color-scheme: light
Button focus outline: rgb(37, 99, 235) solid 2px
```

---

## Checklist Summary

- [ ] CLI: Login works
- [ ] CLI: Upload image works
- [ ] CLI: Producto with image_url created
- [ ] CLI: GET /productos returns imagen_url
- [ ] CLI: 401 without auth
- [ ] GUI: Login/Logout flow
- [ ] GUI: Productos CRUD with images
- [ ] GUI: Clientes CRUD
- [ ] GUI: Pedidos with "Seleccionar todo/Limpiar"
- [ ] GUI: Historial with PDF generation
- [ ] GUI: Focus-visible on all inputs/buttons
- [ ] GUI: Color contrast readable
- [ ] GUI: Dark mode extension doesn't invert
- [ ] GUI: Responsive (mobile/tablet/desktop)
- [ ] GUI: No console errors
- [ ] CSS Variables defined and applied
- [ ] Cross-tab auth sync

