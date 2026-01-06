# 🚀 CHORIZAURIO - Complete Testing Documentation

## Overview

Este documento cubre **toda** la prueba (CLI + GUI) para el proyecto Chorizaurio con:
- Imágenes de productos
- Autenticación con JWT
- Descarga de archivos
- Estilos accesibles con CSS variables
- Dark mode compatible

---

## ✅ CLI Tests Passed

```bash
cd /home/mauro/dev/chorizaurio
```

Ejecuta este script para verificar backend:

```bash
# Test 1: Login → get JWT token
curl -X POST "http://localhost:8000/login" \
  -d "username=testuser&password=secret"

# Test 2: Upload image
curl -X POST "http://localhost:8000/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.png"

# Test 3: Create producto with imagen_url
curl -X POST "http://localhost:8000/productos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","precio":99.99,"imagen_url":"/media/uploads/..."}'

# Test 4: GET productos (verify imagen_url in response)
curl -X GET "http://localhost:8000/productos" \
  -H "Authorization: Bearer $TOKEN"
```

**Resultados:**
- ✅ Login: JWT token generated
- ✅ Upload: Image saved & accessible at `/media/uploads/[uuid].ext`
- ✅ Producto: Created with `imagen_url` field
- ✅ 401: Unauthenticated requests correctly rejected

---

## 🎯 GUI Tests (Manual Verification)

### Quick Start
1. Open: `http://localhost`
2. Open DevTools: `F12`
3. Follow steps in `GUI_TEST_GUIDE.md`

### Key Areas to Test

#### 1. Authentication
- [ ] Login with `testuser`/`secret`
- [ ] Token saved in localStorage
- [ ] Logout removes token
- [ ] Cross-tab sync (open 2 tabs)

#### 2. Productos
- [ ] Upload image file
- [ ] Image thumbnail visible in list
- [ ] `imagen_url` stored & returned
- [ ] 📦 placeholder if no image

#### 3. Clientes
- [ ] Create, edit, delete
- [ ] Dropdown population
- [ ] Focus-visible on inputs (Tab key)

#### 4. Pedidos
- [ ] Select cliente
- [ ] Filter productos (search)
- [ ] ✅ "Seleccionar todo" button works
- [ ] ✕ "Limpiar" button works
- [ ] Products marked persist

#### 5. Historial
- [ ] Pendientes vs Generados tabs
- [ ] "Seleccionar todo" / "Limpiar"
- [ ] Generate PDF button
- [ ] PDF downloads correctly
- [ ] Order moves to Generados after PDF

#### 6. Accessibility
- [ ] **Tab Navigation**: Every input/button has blue outline (2px)
- [ ] **Color Contrast**: Text readable (dark gray on white)
- [ ] **Responsive**: Works on mobile (375px), tablet (768px), desktop
- [ ] **Dark Mode**: Extension doesn't invert colors (use Dark Reader)

---

## 📊 CSS Variables & Styling

**All CSS variables defined in** `frontend/src/index.css`:

```css
--color-bg: #ffffff;
--color-bg-secondary: #f9fafb;
--color-bg-accent: #eff6ff;
--color-text: #1f2937;           /* Main text - high contrast */
--color-text-muted: #6b7280;     /* Secondary text */
--color-border: #e5e7eb;
--color-primary: #2563eb;        /* Blue - buttons */
--color-primary-hover: #1d4ed8;
--color-danger: #dc2626;         /* Red */
--color-success: #16a34a;        /* Green */
```

**Check in browser Console:**
```js
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
// Output: #2563eb (or rgb(37, 99, 235))
```

---

## 🔍 What's New (All Changes)

### Backend (`main.py`)
- ✅ POST `/upload` endpoint with file storage
- ✅ StaticFiles mount at `/media` → `/data`
- ✅ `imagen_url` field in Producto model
- ✅ PUT `/productos/{id}` for editing
- ✅ Image URL validation (`_is_valid_image_url`)

### Frontend (React)

**Refactors:**
1. **CSS Variables**: Replaced all hardcoded colors with CSS tokens
2. **Focus-visible**: All buttons/inputs have outline on Tab
3. **Contrast**: High contrast text (#1f2937 on white)
4. **Dark Mode**: `color-scheme: light` prevents inversion

**New Features:**
1. **Seleccionar todo / Limpiar**: 
   - Historial: Select all pending orders
   - Pedidos: Select all visible products
2. **Dark Mode Compatible**: Works with Dark Reader extension
3. **Responsive**: Mobile/tablet/desktop optimized

**Files Changed:**
- `frontend/src/index.css`: Global CSS variables + focus states
- `frontend/src/LayoutApp.jsx`: Use CSS variables
- `frontend/src/components/*.jsx`: All components updated

---

## 🧪 Test Files Reference

| File | Purpose |
|------|---------|
| `TEST_SCRIPT.md` | Full CLI testing guide with curl commands |
| `GUI_TEST_GUIDE.md` | Step-by-step GUI testing checklist |
| `THIS FILE` | Overview & quick reference |

---

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Token invalid" after login | Clear localStorage, log in again |
| Image not showing | Check Network tab: `/media/uploads/...` should be 200 |
| Focus outline not visible | Verify `index.css` has `button:focus-visible { outline: 2px... }` |
| Dark mode inverts colors | Check `color-scheme: light` in root CSS |
| Responsive looks wrong | DevTools → Ctrl+Shift+M → test 375px, 768px, 1920px |

---

## ✅ Deployment Checklist

Before going live:

- [ ] CLI tests pass (login, upload, CRUD)
- [ ] GUI: All tabs work (Clientes, Productos, Pedidos, Historial)
- [ ] Tab navigation works (Tab key shows blue outline)
- [ ] Responsive on mobile (375px) / tablet (768px) / desktop
- [ ] Dark mode doesn't invert (test with Dark Reader)
- [ ] No console errors (DevTools → F12 → Console)
- [ ] PDF generation works (Historial → Generar PDF)
- [ ] Cross-tab sync works (2 tabs, login in one)

---

## 📞 Quick Reference

**Backend API Base URL:** `http://localhost:8000`

**Frontend Base URL:** `http://localhost`

**Test Credentials:**
- Username: `testuser`
- Password: `secret`

**Main Database:** `/data/ventas.db`

**Upload Directory:** `/data/uploads`

---

**Last Updated:** Dec 28, 2025
**Status:** ✅ Ready for Testing
