# 🎯 Frontend Pre-Production Review - Chorizaurio/Chorilocal

**Date**: January 7, 2026  
**Review Team**: Senior FE Lead + QA FE  
**Scope**: Full frontend validation with deep focus on images

---

## 🚦 GO / NO-GO DECISION

# **GO** ✅

### Why GO:
1. ✅ **Build passes** - `npm run build` completes successfully with optimized chunks
2. ✅ **Image pipeline is complete** - Upload, preview, storage, and rendering are all implemented
3. ✅ **Role-based access is enforced** - Admin/oficina/ventas properly gated in LayoutApp

### Caveats for GO:
- ⚠️ 3 MUST-FIX items before production traffic (see below)
- ⚠️ Zero products currently have images in DB - test with real images before launch

---

## 📍 1. FRONTEND INVENTORY (App Map)

### Routes & Screens

| Route | Component | Purpose | Role Access |
|-------|-----------|---------|-------------|
| `/` | Login | Authentication | Public |
| `/registro` | Register | User registration | Public |
| `/clientes` | Clientes | Customer management (CRUD) | All roles |
| `/productos` | Productos | Product management + images | All roles |
| `/pedidos` | Pedidos | Create new orders | All roles |
| `/historial` | HistorialPedidos | Order history, edit, cancel | All roles |
| `/ofertas` | Ofertas | Active promotions | All (ventas: read-only) |
| `/hoja-ruta` | HojaRuta | Delivery route PDF gen | Admin only |
| `/dashboard` | Dashboard | Analytics & metrics | Admin only |
| `/reportes` | Reportes | Sales reports | Admin only |
| `/listas-precios` | ListasPrecios | Price list management | Admin only |
| `/templates` | Templates | Recurring order templates | Admin only |
| `/usuarios` | Usuarios | User management | Admin only |
| `/categorias` | Categorias | Product categories | Admin only |
| `/cambiar-password` | CambiarPassword | Password change modal | All roles |

### Image Display Locations

| Location | Component | File | Lines | Image Source |
|----------|-----------|------|-------|--------------|
| Product catalog | Productos.jsx | Productos.jsx | 985-988 | `p.imagen_url` |
| Product edit inline | Productos.jsx | Productos.jsx | 1128-1190 | File upload |
| Create product form | Productos.jsx | Productos.jsx | 660-675 | Drag/drop + URL |
| Order creation - catalog | Pedidos.jsx | Pedidos.jsx | 545-548 | `p.imagen_url` |
| Order creation - selected | Pedidos.jsx | Pedidos.jsx | 321-325 | `p.imagen_url` |
| Header logo | LayoutApp.jsx | LayoutApp.jsx | 224 | `/logo-friosur.png` (static) |

### Image Pipeline

```
[User] → file picker / drag-drop / URL input
    ↓
[FormData] POST /upload (auth required)
    ↓
[Backend] Validates extension/MIME/size (5MB max)
    ↓  
[Backend] Saves to /data/uploads/{uuid}.{ext}
    ↓
[Backend] Returns { url: "/media/uploads/{name}" }
    ↓
[Frontend] Updates producto.imagen_url via PUT /productos/{id}
    ↓
[Rendering] <img src={imagen_url} loading="lazy" />
    ↓
[Static] FastAPI StaticFiles at /media → /data
```

---

## 📸 2. IMAGE FUNCTIONALITY VALIDATION (Deep Dive)

### Test Matrix

| Feature | Where | Expected | How to Test | Failure Symptoms | Fix Suggestion |
|---------|-------|----------|-------------|------------------|----------------|
| **File picker** | Productos.jsx:665 | Opens native file dialog | Click 📤 zone | Nothing happens | Check `fileInputRef` binding |
| **Drag & drop** | Productos.jsx:660-664 | Highlights zone, accepts file | Drag image over zone | No visual feedback | `dragActive` state not toggling |
| **Allowed types** | Backend main.py:193-196 | jpg/png/gif/webp/pdf only | Upload .exe | Should reject | Backend validation working |
| **Max size 5MB** | Backend main.py:192 | Reject >5MB with error | Upload 10MB image | Should show toast error | Chunked read enforces limit |
| **Upload progress** | Productos.jsx:669 | Shows "⏳ Subiendo..." | Slow network | Stuck spinner | Add abort timeout |
| **Preview before save** | Productos.jsx:672 | Shows blob URL preview | Select file | No preview appears | Check `filePreview` state |
| **Preview after save** | Productos.jsx:986 | Shows actual URL from API | Refresh page | Broken image | Check `/media` mount |
| **Broken link fallback** | Productos.jsx:987-988 | Shows 📦 placeholder | Set invalid URL | Shows broken img icon | **NO onError handler - ISSUE** |
| **Lazy loading** | Productos.jsx:986 | `loading="lazy"` | Scroll fast list | Images load on scroll | Working |
| **Memory leak** | Productos.jsx:84-88 | Revokes blob URLs | Check DevTools memory | Growing heap | useEffect cleanup exists |
| **After refresh** | All | Images persist | F5 | Images disappear | Check API returns `imagen_url` |
| **After logout/login** | All | Images persist | Logout, login | Images missing | Static files don't need auth |
| **404 image** | N/A | Should show placeholder | Delete file from server | Broken icon | **ADD onError fallback** |
| **Replace image** | Productos.jsx:1128+ | New upload replaces old | Click existing image | Old image stays | State update issue |
| **Delete image** | N/A | Remove imagen_url | N/A | **NOT IMPLEMENTED** | Add clear button |
| **URL input validation** | Productos.jsx:417-423 | Validates http(s) only | Enter `ftp://...` | Shows error | Working |
| **Aspect ratio** | index.css:740-752 | `object-fit: cover` | Upload tall image | Distorted | Working (cover) |
| **Responsive sizing** | index.css:789-813 | Different sizes per breakpoint | Resize window | Fixed size | Working (media queries) |

### Critical Image Issues Found

| Severity | Issue | File | Fix |
|----------|-------|------|-----|
| 🔴 HIGH | **No `onError` handler** - Broken images show browser default | Productos.jsx:986, Pedidos.jsx:322,546 | Add `onError={(e) => { e.target.style.display='none'; }}` or swap to placeholder |
| 🟡 MEDIUM | **No delete image button** - Can only replace, not remove | Productos.jsx | Add "✕ Remove image" action |
| 🟡 MEDIUM | **ProductoList.jsx still uses old category endpoint** | ProductoList.jsx:58-66 | Update to use `/categoria` endpoint like Productos.jsx |
| 🟢 LOW | **No upload timeout** - Could hang forever | Productos.jsx:432-451 | Add AbortController with 60s timeout |

---

## 🔍 3. GENERAL FRONTEND QA

### Routing & Role Access

| Check | Status | Notes |
|-------|--------|-------|
| Admin tabs hidden from non-admin | ✅ | LayoutApp.jsx:420-440 checks `isAdmin` |
| Direct URL access to admin routes | ✅ | Routes redirect to `/clientes` |
| Ventas sees own pedidos only | ✅ | Backend filter `user_rol == "ventas"` |
| Token expiry handling | ✅ | `isTokenExpiringSoon()` with refresh |
| Cross-tab logout | ✅ | `storage` event listener in App.jsx |

### Forms Validation

| Form | Required Fields | Double-submit Protection | Error Display |
|------|-----------------|--------------------------|---------------|
| Login | ✅ username, password | ✅ `disabled={loading}` | ✅ Toast |
| Register | ✅ All fields | ✅ `disabled={loading || !valid}` | ✅ Inline + toast |
| Nuevo Cliente | ✅ nombre | ✅ `disabled={creating}` | ✅ Toast |
| Nuevo Producto | ✅ nombre, precio | ✅ `disabled={creating \|\| urlError}` | ✅ Toast |
| Editar Producto | ✅ nombre, precio ≥0 | ✅ `disabled={savingEdit}` | ✅ Toast |
| Nuevo Pedido | ✅ cliente + productos | ✅ `disabled={!clienteId}` | ✅ Toast |
| Cambiar Password | ✅ All fields | ✅ `disabled={loading}` | ✅ Inline |

### Lists & States

| Component | Loading State | Empty State | Error State | Search/Filter |
|-----------|--------------|-------------|-------------|---------------|
| Clientes | ✅ Skeleton | ✅ empty-state | ⚠️ Silent fail | ✅ |
| Productos | ✅ Skeleton | ✅ empty-state | ⚠️ Silent fail | ✅ Multi-filter |
| Historial | ✅ Spinner | ✅ empty-state | ⚠️ Silent fail | ✅ Text + date |
| Ofertas | ✅ Spinner | ✅ empty-state | ⚠️ Silent fail | ❌ None |

### State Management Issues

| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| API errors silent (catch ignores) | 🟡 | Multiple `catch (e) { /* ignore */ }` | Add console.error or toast |
| Draft autosave to localStorage | ✅ | Pedidos.jsx:73-92 | Working |
| Filter persistence | ✅ | Productos.jsx:94-113 | Working |
| Back button behavior | ✅ | Standard routing | Working |

### UX Consistency

| Element | Consistent? | Notes |
|---------|-------------|-------|
| Toasts | ✅ | toastSuccess/Error/Warn everywhere |
| Modals | ✅ | Backdrop click to close |
| Confirmations | ✅ | ConfirmDialog component |
| Loading buttons | ✅ | ⏳ prefix, disabled |
| Keyboard shortcuts | ✅ | Ctrl+K, Ctrl+1-6, Ctrl+S |

### Resilience

| Scenario | Handled? | How |
|----------|----------|-----|
| API down (fetch fails) | ⚠️ Partial | Toast on some, silent on others |
| 500 errors | ✅ | Retry logic in authFetch |
| Network offline | ✅ | OfflineNotifier + IndexedDB queue |
| Token refresh | ✅ | Auto-refresh before expiry |
| Request timeout | ✅ | 30s timeout with AbortController |

### Accessibility

| Check | Status | Notes |
|-------|--------|-------|
| Skip link | ✅ | `.skip-link` to `#main-content` |
| ARIA labels | ⚠️ Partial | Many buttons missing `aria-label` |
| Keyboard nav | ✅ | Tab works, Enter activates |
| Focus trap (modals) | ⚠️ Missing | No focus trap implementation |
| Color contrast | ✅ | CSS variables with good contrast |

### Mobile Responsiveness

| Screen | Mobile Ready? | Issues |
|--------|---------------|--------|
| Login | ✅ | Centered, responsive |
| Productos | ✅ | Grid adapts, images resize |
| Pedidos | ⚠️ | Two-column layout cramped |
| Historial | ✅ | Table scrolls horizontally |
| Dashboard | ✅ | Cards stack vertically |

---

## 📋 4. REGRESSION/SMOKE CHECKLISTS

### 10-Minute Smoke Test (Pre-Deploy)

```markdown
□ 1. Build passes: `npm run build` ✓
□ 2. Login as admin/admin420 → Dashboard visible
□ 3. Navigate: Clientes → Productos → Pedidos → Historial (no console errors)
□ 4. Create product with image URL → Image displays
□ 5. Create order with 2 products → Total calculates correctly
□ 6. Logout → Redirect to login
□ 7. Login as ventas_test/ventas123 → Admin tabs hidden
□ 8. Theme toggle → Persists on refresh
□ 9. Mobile view (DevTools) → Nav hamburger works
□ 10. Offline toggle → Banner appears, queue works
```

### 30-60 Minute Regression Checklist (Priority Order)

```markdown
## CRITICAL PATH (15 min)
□ Login with valid/invalid credentials
□ Create cliente → appears in list
□ Create producto with image → image displays
□ Create pedido → appears in historial
□ Edit pedido (add/remove product) → totals update
□ Generate PDF hoja de ruta
□ Role switch: admin sees all, ventas sees own only

## IMAGE FLOW (10 min)
□ Drag-drop image → preview shows
□ File picker → upload succeeds
□ URL input with invalid URL → error shown
□ Large file (>5MB) → rejected
□ Refresh page → images persist
□ Product in order shows image
□ Image on slow network (throttle to 3G)

## FORMS & VALIDATION (10 min)
□ Empty required fields → prevented
□ Negative precio → rejected
□ Stock below minimum → warning shown
□ Double-click submit → no duplicate
□ Cancel mid-form → data persists (draft)

## EDGE CASES (10 min)
□ 100+ products → list performs well
□ API timeout (block /api) → graceful error
□ Expired token → auto-refresh or redirect
□ Offline create pedido → queued
□ Back button on edit → returns correctly

## BROWSER COMPAT (5 min)
□ Chrome latest
□ Firefox latest
□ Safari (if available)
□ Mobile Chrome
```

### Killer Tests (Often Break in Prod)

1. **Image after deploy**: Upload image → deploy new version → image still accessible?
2. **Token expiry during edit**: Start editing → wait 30min → save → works?
3. **Race condition on pedido**: Two tabs create same order → no duplicate?
4. **Large image list scroll**: 500 products with images → scroll smooth?
5. **PDF with special characters**: Cliente with ñ/ü → PDF renders correctly?

---

## 🔧 5. MUST-FIX BEFORE PROD (Max 10)

| # | Severity | Issue | File | Status |
|---|----------|-------|------|--------|
| 1 | ✅ FIXED | **No broken image fallback** | Productos.jsx:986 | Added `onError` handler to hide broken img and show 📦 |
| 2 | ✅ FIXED | **No broken image fallback** | Pedidos.jsx:322,546 | Added `onError` handler to hide broken img and show 📦 |
| 3 | 🔴 HIGH | **CORS_ORIGINS not set for prod** | Backend env | Set `CORS_ORIGINS=https://yourdomain.com` |

**Note**: Items 1 and 2 were fixed in this review session.

---

## 🟡 SHOULD-FIX SOON (Max 10)

| # | Severity | Issue | File | Fix |
|---|----------|-------|------|-----|
| 1 | 🟡 | Silent API error handling | Multiple | Replace `catch (e) { /* ignore */ }` with toast |
| 2 | 🟡 | ProductoList.jsx uses old endpoint | ProductoList.jsx:58 | Use `/productos/{id}/categoria` endpoint |
| 3 | 🟡 | No delete image button | Productos.jsx | Add clear/remove image action |
| 4 | 🟡 | No focus trap in modals | Multiple | Use `focus-trap-react` or manual |
| 5 | 🟡 | Upload has no timeout | Productos.jsx:432 | Add 60s AbortController timeout |
| 6 | 🟡 | Missing lint script | package.json | Add ESLint config and script |
| 7 | 🟡 | Pedidos two-column cramped on mobile | Pedidos.jsx | Stack columns on <640px |
| 8 | 🟡 | Ofertas has no search/filter | Ofertas.jsx | Add search functionality |
| 9 | 🟡 | Many buttons lack aria-label | Multiple | Add descriptive labels |
| 10 | 🟡 | Service worker caches /media | service-worker.js | Exclude /media from SW cache |

---

## 🟢 NICE-TO-HAVE

1. Add image compression before upload (browser-side)
2. Implement image cropping UI
3. Add skeleton loaders for images specifically
4. Progressive image loading (blurhash)
5. Add retina @2x support

---

## 💻 COMMANDS TO RUN LOCALLY

```bash
# Build check
cd frontend && npm run build

# Start dev server
npm run start

# Run E2E tests (requires backend running)
npx playwright test

# Check bundle size
npx vite-bundle-visualizer

# Quick image upload test
curl -X POST http://localhost:8000/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg"
```

---

## 📊 SUMMARY

| Category | Score | Notes |
|----------|-------|-------|
| Build/Compile | ✅ 10/10 | Clean build |
| Image Pipeline | ⚠️ 7/10 | Missing onError fallback |
| Forms/Validation | ✅ 9/10 | Solid |
| Role Access | ✅ 10/10 | Properly enforced |
| Error Handling | ⚠️ 6/10 | Many silent catches |
| Mobile | ⚠️ 7/10 | Pedidos cramped |
| Accessibility | ⚠️ 6/10 | Missing focus traps |
| Overall | **7.5/10** | GO with 3 must-fixes |

---

**Reviewed by**: Senior FE Lead + QA FE  
**Status**: ✅ **GO** (with 3 MUST-FIX items before production traffic)
