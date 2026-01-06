## 🧪 TESTING GUIDE - GUI (PASO A PASO)

### Resumen de CLI Tests ✅
```
✅ Login: successful
✅ Image upload: works (HTTP 200)
✅ Product with imagen_url: created and returned
✅ Client creation: works
✅ Pedido creation: works
✅ 401 without token: correctly enforced
```

---

## GUI Testing (Manual en Navegador)

### 1️⃣ Preparación
- Abre `http://localhost` en navegador **nuevo/incognito**
- Abre **DevTools** con F12
- Ve a **Console** para ver errores en tiempo real

---

### 2️⃣ Test: Login & Auth

**Paso 1: Debería ver formulario de login**
- [ ] Página muestra "Iniciar Sesión"
- [ ] Inputs visibles: Usuario, Contraseña
- [ ] Botón "Ingresar"
- [ ] Link "Regístrate"

**Paso 2: Tab to inputs (keyboard navigation)**
- Presiona **Tab** repetidamente desde inicio
- [ ] Cada input/botón debe mostrar **outline azul** (2px) al enfocar
- [ ] Sin errores en Console

**Paso 3: Login con credenciales válidas**
- Usuario: `testuser`
- Contraseña: `secret`
- [ ] Click "Ingresar"
- [ ] Redirecciona a **Clientes** tab
- [ ] Navbars visibles: Clientes | Productos | Pedidos | Historial | Logout

**Paso 4: Token saved**
- DevTools → **Application → Local Storage → http://localhost**
- [ ] Campo `token` presente con JWT (comienza con `eyJ...`)

**Paso 5: Logout**
- Click botón rojo **"Logout"**
- [ ] Vuelve a página de Login
- [ ] Token eliminado de localStorage

---

### 3️⃣ Test: Productos (CRUD + Images)

**Paso 1: Navigate to Productos**
- Click tab **"Productos"**
- [ ] Page loads sin errores
- [ ] Grid de productos visible

**Paso 2: Crear producto con imagen**
```
Nombre: "Test GUI Product"
Precio: 150
Upload: selecciona una imagen local (JPG/PNG)
```
- [ ] Después de select, preview thumbnail visible
- [ ] Click "Agregar"
- [ ] Botón muestra "Creando..." (loading state)
- [ ] Después de 2-3 segundos, vuelve a "Agregar"
- [ ] **Sin errores en Console**

**Paso 3: Verificar en listado**
- [ ] Nuevo producto aparece en grid
- [ ] Thumbnail de imagen visible
- [ ] Nombre y precio mostrados
- [ ] Logo 📦 es placeholder (si no hay imagen)

**Paso 4: CSS Variables Check**
- DevTools → **Console**, pega:
```js
const styles = getComputedStyle(document.documentElement);
console.log('--color-primary:', styles.getPropertyValue('--color-primary'));
console.log('--color-text:', styles.getPropertyValue('--color-text'));
console.log('color-scheme:', getComputedStyle(document.documentElement).colorScheme);
```
- [ ] Debería salir algo como:
  - `--color-primary: #2563eb`
  - `--color-text: #1f2937`
  - `color-scheme: light`

**Paso 5: Responsive check**
- DevTools → **Ctrl+Shift+M** (Toggle device toolbar)
- [ ] **Mobile (375px)**: Grid 1 columna, inputs apilados
- [ ] **Tablet (768px)**: Grid 2 columnas
- [ ] **Desktop (1920px)**: Grid legible

---

### 4️⃣ Test: Clientes (CRUD)

**Paso 1: Navigate**
- Click **"Clientes"** tab
- [ ] Form visible: Nombre, Teléfono, Dirección
- [ ] Select dropdown con "Seleccionar cliente..."

**Paso 2: Crear cliente**
```
Nombre: "Test GUI Client"
Teléfono: "555-1234"
Dirección: "Main St 123"
```
- Click **"Agregar"**
- [ ] Alert: "Cliente guardado"
- [ ] Inputs se limpian

**Paso 3: Verificar en dropdown**
- Click dropdown "Seleccionar cliente..."
- [ ] "Test GUI Client" aparece en lista
- [ ] Click → se popula form con datos

**Paso 4: Focus-visible on Select**
- Tab hasta el Select dropdown
- [ ] Debe mostrar **outline azul**

---

### 5️⃣ Test: Pedidos + "Seleccionar todo"

**Paso 1: Navigate**
- Click **"Pedidos"** tab
- [ ] Form "Crear Pedido" visible
- [ ] Cliente selector vacio

**Paso 2: Selecciona cliente**
- Click dropdown "Seleccionar cliente:"
- Elige el cliente que creaste
- [ ] Dropdown se actualiza

**Paso 3: Búsqueda de productos**
- En campo de búsqueda, escribe "test"
- [ ] Productos filtrados por nombre
- [ ] Grid mostrando solo coincidencias

**Paso 4: Test "Seleccionar todo"**
- Debería ver dos botones arriba del grid:
  - [ ] "✓ Seleccionar todo"
  - [ ] "✕ Limpiar selección"
- Click "✓ Seleccionar todo"
- [ ] **TODOS los productos visibles están checkboxed**
- Click "✕ Limpiar selección"
- [ ] **TODOS los checkboxes están deschecked**

**Paso 5: Agregar producto manual**
- Click el botón **"+"** en un producto
- [ ] Aparece en sección azul "🧊 Productos seleccionados (X)"
- [ ] Contador se actualiza

**Paso 6: Modificar cantidad**
- En el producto seleccionado, modifica **Cantidad**: 3
- Cambia **Tipo**: Caja
- [ ] Se actualiza en UI

**Paso 7: Limpiar seleccionados**
- Busca botón "✕ Limpiar" en sección azul
- [ ] Click → todos se removerán
- [ ] Sección azul desaparece si vacía

**Paso 8: Guardar pedido**
- Agrega al menos 1 producto + cliente
- Click **"Guardar Pedido"**
- [ ] Alert: "Pedido guardado"
- [ ] Form se resetea

---

### 6️⃣ Test: Historial de Pedidos

**Paso 1: Navigate**
- Click **"Historial"** tab
- [ ] Dos tabs visibles: "Pendientes (X)" y "Generados (X)"

**Paso 2: Tab Pendientes**
- Click **"Pendientes"**
- [ ] Lista de órdenes sin generar
- [ ] Checkboxes visible
- [ ] Dos botones arriba:
  - [ ] "✓ Seleccionar todo"
  - [ ] "✕ Limpiar selección"

**Paso 3: Test "Seleccionar todo"**
- Click "✓ Seleccionar todo"
- [ ] **TODOS los pedidos pendientes marcados**
- [ ] Botón **"Generar PDF (X pedidos)"** aparece abajo
- Click "✕ Limpiar selección"
- [ ] Todos desmarcados
- [ ] Botón PDF desaparece

**Paso 4: Generar PDF**
- Select 1-2 órdenes (checkbox manual)
- [ ] Botón "Generar PDF (2 pedidos)" aparece
- Click
- [ ] Descarga archivo PDF
- [ ] Órdenes se mueven a tab **"Generados"**

**Paso 5: Verificar Generados**
- Click tab **"Generados"**
- [ ] Órdenes que generaste están aquí
- [ ] **Sin checkboxes** (no es editable)
- [ ] **Sin botones** "Seleccionar todo" (tab está read-only)

---

### 7️⃣ Test: Dark Mode Resistance

**Si tienes extensión de Dark Mode instalada:**

1. Abre **Dark Reader** o **Night Eye**
2. Enable
3. Refresh `http://localhost`
4. Verifica:
   - [ ] Fondo **sigue siendo blanco** (no inverted)
   - [ ] Textos **siguen siendo oscuros** (no negativo)
   - [ ] Botones **siguen siendo legibles**
   - [ ] Sin artefactos visuales

5. Disable extensión → debe verse igual

---

### 8️⃣ Test: Contraste & Legibilidad

**En DevTools Console:**
```js
// Check text color on inputs
const input = document.querySelector('input');
console.log('Input text color:', getComputedStyle(input).color);

// Check button colors
const btn = document.querySelector('.btn-primary');
console.log('Button background:', getComputedStyle(btn).backgroundColor);
console.log('Button text:', getComputedStyle(btn).color);
```

Verificar que salgan colores que contrasten (no gris muy claro sobre blanco):
- [ ] Texto: `rgb(31, 41, 55)` o similar (oscuro)
- [ ] Fondo botón: `rgb(37, 99, 235)` o similar (azul)

---

### 9️⃣ Test: Error Handling

**Test 1: Credenciales inválidas**
- Logout
- Intenta login con contraseña incorrecta
- [ ] Error message aparece

**Test 2: Crear producto sin nombre**
- Productos tab
- Precio: 100
- Click "Agregar" sin nombre
- [ ] Alert o mensaje de error

**Test 3: Network error (simula)**
- DevTools → Network → Offline
- Intenta agregar producto
- [ ] Error message, no crash
- Vuelve a Online

---

### 🔟 Test: Cross-Tab Sync

**Paso 1: Abre 2 tabs**
- Tab 1: `http://localhost`
- Tab 2: `http://localhost`

**Paso 2: Login en Tab 1**
- Login con testuser/secret

**Paso 3: Verifica Tab 2**
- Refresh Tab 2 (F5)
- [ ] Debería mostrar Clientes (authenticated UI)
- [ ] Token compartido vía localStorage

**Paso 4: Logout en Tab 1**
- Click Logout en Tab 1

**Paso 5: Verifica Tab 2**
- Refresh Tab 2
- [ ] Debería mostrar Login form (no authenticated)

---

## Checklist Final ✅

| Test | Resultado |
|------|-----------|
| CLI: Login | ✅ |
| CLI: Upload | ✅ |
| CLI: Producto con imagen | ✅ |
| CLI: 401 sin token | ✅ |
| GUI: Login/Logout | [ ] |
| GUI: Productos CRUD | [ ] |
| GUI: Clientes CRUD | [ ] |
| GUI: Pedidos + "Seleccionar todo" | [ ] |
| GUI: Historial + PDF | [ ] |
| GUI: Focus-visible (Tab) | [ ] |
| GUI: CSS Variables | [ ] |
| GUI: Dark mode compatible | [ ] |
| GUI: Responsive (mobile/tablet/desktop) | [ ] |
| GUI: Contraste legible | [ ] |
| GUI: Cross-tab sync | [ ] |
| GUI: Sin errores en Console | [ ] |

---

## Si encuentras problemas:

1. **Error 401 en Productos**
   - Logout → Login de nuevo
   - Limpia localStorage (DevTools → Application → Local Storage → DELETE token)

2. **Imagen no carga**
   - Abre DevTools → Network
   - Verifica que GET `/media/uploads/...` retorne 200

3. **Botones no enfocan**
   - Verifica que `index.css` tenga:
     ```css
     button:focus-visible {
       outline: 2px solid var(--color-primary);
     }
     ```

4. **Colores muy oscuros/claros**
   - Console: `getComputedStyle(document.documentElement).getPropertyValue('--color-text')`
   - Debería ser `#1f2937` (no blanco)

5. **PDF no genera**
   - Abre Console → Network
   - Verifica que PATCH `/pedidos/{id}` sea 200
   - Verifica descarga en carpeta Downloads

---

**¡Buena suerte! 🚀**
