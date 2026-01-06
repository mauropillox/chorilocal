# 📋 LISTA COMPLETA DE MEJORAS UI/UX

## 🔴 CRÍTICOS (P0) - ANTES DE PROCEDER

### 1. **Layout desprolijo en Productos**
- ❌ **PROBLEMA**: Inputs (Nombre, Precio, U.E. imagen) arriba, lista abajo
- ✅ **SOLUCIÓN**: 2-column layout:
  - LEFT: Formulario (nombre, precio, upload) en tarjeta/panel
  - RIGHT: Listado de productos
  - En mobile: Stack vertical (form arriba, lista abajo)
- 📍 **Archivo**: `frontend/src/components/Productos.jsx`

### 2. **Layout desprolijo en Pedidos**
- ❌ **PROBLEMA**: Mismo issue - selector cliente arriba, lista abajo sin relación visual
- ✅ **SOLUCIÓN**: 2-column layout:
  - LEFT: Panel para crear pedido (cliente selector + tabla de productos seleccionados)
  - RIGHT: Catálogo de productos disponibles
  - En mobile: Stack vertical
- 📍 **Archivo**: `frontend/src/components/Pedidos.jsx`

### 3. **Imágenes/iconos demasiado pequeños**
- ❌ **PROBLEMA**: Emojis 🍂 son diminutos (casi invisibles)
- ✅ **SOLUCIÓN**:
  - Aumentar tamaño: 40px × 40px (actualmente ~16-24px)
  - Hacer más visible en cards
  - En Productos: imagen + nombre debajo
  - En Pedidos/Historial: imagen + info en card horizontal
- 📍 **Archivos**: 
  - `Productos.jsx` - grid de productos
  - `Pedidos.jsx` - listado de productos
  - `HistorialPedidos.jsx` - n/a (no tiene imágenes)

### 4. **Cards/Items sin separación visual**
- ❌ **PROBLEMA**: Todo es gris plano, sin bordes/sombras, items pegados
- ✅ **SOLUCIÓN**:
  - Padding interno: 16px (actualmente ~8px)
  - Border: 1px solid #e5e7eb o box-shadow
  - Margin-bottom: 12px entre items
  - Hover effect: cambiar background color levemente
  - `border-radius: 8px`
- 📍 **Archivos**: Todos los componentes con listas

### 5. **Contraste de texto débil**
- ❌ **PROBLEMA**: Nombres productos en gris claro (#6b7280), difícil leer
- ✅ **SOLUCIÓN**:
  - Nombres: usar `--color-text` (#1f2937) bold
  - Precios: más oscuro, destacado
  - Cliente: bold
  - Verificar contraste ≥ 4.5:1
- 📍 **Archivos**: All components

### 6. **Checkboxes en Historial invisibles**
- ❌ **PROBLEMA**: Checkboxes muy pequeños, poco visibles, sin focus ring
- ✅ **SOLUCIÓN**:
  - Aumentar tamaño: 20px × 20px (actualmente ~16px)
  - Mejorar focus-visible (outline azul 2px)
  - Agregar `accent-color: var(--color-primary)`
  - Usar `cursor: pointer`
- 📍 **Archivo**: `HistorialPedidos.jsx`

### 7. **"Cliente sin nombre" en Historial - problema de datos**
- ❌ **PROBLEMA**: Muchos pedidos muestran "Cliente sin nombre"
- ✅ **SOLUCIÓN**:
  - Backend: validar que cliente_id siempre existe y tenga nombre
  - Frontend: cuando creas pedido, siempre require cliente
  - Mostrar nombre real o fallback "Sin cliente asignado" con aviso
  - Si es null, hacer que sea editable después
- 📍 **Archivos**: 
  - Backend: `main.py` (validación POST /pedidos)
  - Frontend: `Pedidos.jsx` (no permitir sin cliente)

---

## 🟡 IMPORTANTES (P1) - Accesibilidad & Responsive

### 8. **Responsive en mobile (375px) roto**
- ❌ **PROBLEMA**: Inputs en línea se cortan, layout no se adapta
- ✅ **SOLUCIÓN**:
  - Breakpoints: 
    - mobile: <640px → 1 column
    - tablet: 640-768px → 1-2 columns
    - desktop: >768px → 2 columns
  - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
  - Inputs: `w-full` no porcentajes fijos
- 📍 **Archivos**: Todos

### 9. **Inputs en Productos muy apretados**
- ❌ **PROBLEMA**: Nombre, Precio, U.E. en línea horizontal (no caben bien)
- ✅ **SOLUCIÓN**:
  - Stack vertical en mobile/tablet
  - Horizontal solo en desktop (lg:flex)
  - Label arriba input (no inline)
  - Padding: 8-12px
  - Full width en mobile
- 📍 **Archivo**: `Productos.jsx`

### 10. **Botones muy pequeños - accesibilidad**
- ❌ **PROBLEMA**: Minheight <44px (recomendación mobile)
- ✅ **SOLUCIÓN**:
  - Min-height: 44px (clickeable comodo)
  - Padding: 10px 16px mínimo
  - Font-size: 14-16px
  - Spacing entre botones: 8px
- 📍 **Archivos**: Todos

### 11. **Espaciado general comprimido**
- ❌ **PROBLEMA**: gap, padding, margin muy pequeños (4-6px)
- ✅ **SOLUCIÓN**: 
  - Cards: padding 16px
  - Grid gap: 12px
  - Margin-bottom: 16px entre secciones
  - Vertical spacing: 24px entre form y lista
- 📍 **Archivos**: Todos

### 12. **Responsive para Clientes**
- ❌ **PROBLEMA**: Inputs (Nombre, Teléfono, Dirección) en línea apretada
- ✅ **SOLUCIÓN**:
  - Stack vertical en mobile
  - 2-column en tablet
  - Inputs full-width
  - Dropdowns/Selects: full-width también
- 📍 **Archivo**: `Clientes.jsx`

### 13. **Tab navigation & focus rings**
- ❌ **PROBLEMA**: Focus rings no visibles en algunos elementos (inputs, select)
- ✅ **SOLUCIÓN**:
  - Verificar `focus-visible` en: input, button, select, checkbox
  - Outline: 2px solid #2563eb
  - Outline-offset: 2px
- 📍 **Archivo**: `index.css`

---

## 🔵 MENORES (P2) - Polish & UX

### 14. **Producto listado sin hover effect**
- ❌ **PROBLEMA**: No hay feedback visual al pasar mouse
- ✅ **SOLUCIÓN**:
  - `hover:bg-blue-50` o `hover:bg-gray-50`
  - `transition: background-color 0.2s`
  - Cambiar cursor a `pointer`
- 📍 **Archivos**: `Productos.jsx`, `Pedidos.jsx`, `HistorialPedidos.jsx`

### 15. **"Seleccionar archivo" confuso**
- ❌ **PROBLEMA**: En Productos, no es claro si es para subir nueva imagen
- ✅ **SOLUCIÓN**:
  - Cambiar label: "📤 Subir imagen del producto"
  - Agregar preview de imagen antes de guardar
  - Mostrar nombre del archivo seleccionado
- 📍 **Archivo**: `Productos.jsx`

### 16. **Contador de items no claro**
- ❌ **PROBLEMA**: En Historial dice "Pendientes (13)" pero no es visualmente destacado
- ✅ **SOLUCIÓN**:
  - Hacer badges más visibles
  - Formato: badge azul con número blanco
  - `bg-blue-600 text-white px-2 py-1 rounded-full`
- 📍 **Archivo**: `HistorialPedidos.jsx`

### 17. **Falta de validación visual en formularios**
- ❌ **PROBLEMA**: Campos requeridos no marcados, sin error messages
- ✅ **SOLUCIÓN**:
  - Agregar asterisco rojo (*) en campos requeridos
  - Mostrar error debajo si validation falla
  - Border rojo si hay error
- 📍 **Archivos**: `Productos.jsx`, `Clientes.jsx`

### 18. **Seleccionar todo/Limpiar no muy visible**
- ❌ **PROBLEMA**: Botones muy sutiles, pequeños links
- ✅ **SOLUCIÓN**:
  - Hacer botones pequeños pero visibles
  - Agregar ícono: ✓ Seleccionar todo | ✕ Limpiar
  - Fondo color, no text-only
- 📍 **Archivos**: `HistorialPedidos.jsx`, `Pedidos.jsx`

### 19. **Jerarquía de botones inexistente**
- ❌ **PROBLEMA**: Todos los botones se ven igual (Clientes, Productos, Agregar, Eliminar, etc)
- ✅ **SOLUCIÓN**: 4 tipos de botones con estilos diferenciados:

#### Tipo 1: BOTONES NAVEGAR (Clientes, Productos, Pedidos, Historial)
```jsx
// Estilos:
- Tamaño: 16px font, 48px height, 16px padding horizontal
- Fondo: AZUL OSCURO (#1e40af) si ACTIVE, gris (#f3f4f6) si inactive
- Color texto: BLANCO si active, gris oscuro si inactive
- Font: bold
- Transición: background-color 0.3s
- Sin borde o borde sutil
```

#### Tipo 2: BOTONES PRIMARIOS (Agregar, Guardar, Crear)
```jsx
// Estilos:
- Tamaño: 14-16px font, 44px height, 12-16px padding horizontal
- Fondo: VERDE (#10b981) o AZUL (#2563eb) (según contexto)
- Color texto: BLANCO
- Font: bold/semibold
- Icon + text (ej: "+ Agregar", "✓ Guardar")
- Hover: 10% más oscuro
```

#### Tipo 3: BOTONES SECUNDARIOS (Editar, Cancelar, Limpiar)
```jsx
// Estilos:
- Tamaño: 14px font, 40px height, 10-12px padding horizontal
- Fondo: Gris claro (#f3f4f6)
- Color texto: Gris oscuro (#4b5563)
- Border: 1px solid #e5e7eb
- Font: regular
- Hover: background gris más oscuro (#e5e7eb)
```

#### Tipo 4: BOTONES PELIGRO (Eliminar, Cancelar cuando destructivo)
```jsx
// Estilos:
- Tamaño: 14px font, 40px height, 10-12px padding horizontal
- Fondo: ROJO (#ef4444)
- Color texto: BLANCO
- Font: semibold
- Icon + text (ej: "🗑️ Eliminar")
- Hover: más oscuro (#dc2626)
```

- 📍 **Archivos**: `index.css` (estilos), todos los componentes (uso)

### 20. **Mostrar todos los productos por defecto - MALA PRÁCTICA**
- ❌ **PROBLEMA**: Cargar 500+ productos al iniciar Productos es:
  - Lento en mobile
  - Abruma al usuario (choice overload)
  - No es profesional (Amazon, MercadoLibre no hacen esto)
  - Difícil de navegar
- ✅ **SOLUCIÓN**: Cambiar a BÚSQUEDA VACÍA por defecto:

#### En Productos.jsx:
```jsx
// Estado inicial:
- Input buscar VACÍO
- Listado VACÍO con mensaje: "🔍 Escribe para buscar productos"
- Botón opcional: "Ver todos los productos"

// Cuando usuario escribe:
- Mostrar resultados en tiempo real
- Paginar si hay muchos resultados

Ventajas:
✅ Rápido (no carga 500 registros)
✅ Usuario intencional ("¿qué busco?")
✅ Professional
✅ Mobile friendly
✅ Mejor UX
```

#### En Pedidos.jsx:
```jsx
// Misma lógica:
- Input buscar VACÍO
- Mensaje: "🔍 Busca productos para agregar al pedido"
- NO mostrar catálogo por defecto

// Cuando usuario selecciona cliente y empieza a buscar:
- Mostrar resultados
```

#### En HistorialPedidos.jsx:
```jsx
// MANTENER como está:
- SÍ mostrar todos los pedidos
- Es un historial, no un catálogo
- Usuario QUIERE ver todo lo que pasó
- OK cargar histórico
```

- 📍 **Archivos**: `Productos.jsx`, `Pedidos.jsx`

---

## 📊 RESUMEN POR ARCHIVO

### `Productos.jsx` - CAMBIOS MAYORES
1. Layout 2-column (form LEFT, lista RIGHT)
2. Aumentar imágenes 40×40px
3. Cards con padding/border/shadow
4. Contraste de texto mejorado
5. Responsive mobile (stack vertical)
6. Hover effects
7. Input labels arriba (no inline)
8. **BÚSQUEDA VACÍA POR DEFECTO** (no cargar todos los productos)
9. Botones: Agregar (verde/azul), Cancelar (gris)

### `Pedidos.jsx` - CAMBIOS MAYORES
1. Layout 2-column (cliente+seleccionados LEFT, catálogo RIGHT)
2. Aumentar imágenes 40×40px
3. Cards con padding/border/shadow
4. Validación: require cliente antes de agregar
5. Responsive mobile
6. Hover effects
7. **BÚSQUEDA VACÍA POR DEFECTO** (no cargar todos los productos)
8. Botones: Agregar (verde/azul), Cancelar (gris)

### `Clientes.jsx` - CAMBIOS MODERADOS
1. Responsive mobile (inputs stack vertical)
2. Input spacing (full-width)
3. Focus rings en select/inputs
4. Hover effects
5. Botones: Agregar (verde/azul), Cancelar (gris)

### `HistorialPedidos.jsx` - CAMBIOS MODERADOS
1. Checkboxes 20×20px
2. Focus rings mejorados
3. Badges más visibles
4. Mostrar nombre cliente (validar backend)
5. Cards con mejor spacing
6. Botones seleccionar/limpiar más visibles
7. **MANTENER**: Mostrar todos los pedidos (es historial, está bien)
8. Botones: Eliminar (rojo), Generar PDF (verde/azul)

### `LayoutApp.jsx` - CAMBIOS IMPORTANTES
1. Botones navegación: Tipo 1 (Clientes, Productos, Pedidos, Historial)
   - ACTIVE: AZUL OSCURO (#1e40af), texto BLANCO, 48px height
   - INACTIVE: Gris (#f3f4f6), texto gris, 48px height
2. Transición suave 0.3s

### `index.css` - CAMBIOS IMPORTANTES
1. Agregar 4 clases de botones: `.btn-nav`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
2. Verificar/mejorar focus-visible en inputs/select
3. Agregar hover states globales
4. Mejorar contraste variables si es necesario

### Backend `main.py` - CAMBIOS PEQUEÑOS
1. Validación: POST /pedidos require cliente
2. Asegurar que cliente siempre tiene nombre

---

## 🎨 ESPECIFICACIONES DE DISEÑO

### Colores (Ya definidos, verificar contraste)
- Text principal: `#1f2937` (--color-text)
- Text muted: `#6b7280` → CAMBIAR a más oscuro
- Backgrounds: `#ffffff` (--color-bg)
- Borders: `#e5e7eb`
- Primary: `#2563eb`

### Espaciado
- Card padding: `16px`
- Grid gap: `12px`
- Margin bottom items: `12px`
- Input padding: `8-12px`
- Button padding: `10px 16px`

### Tamaños
- Imagen: `40px × 40px`
- Checkbox: `20px × 20px`
- Button min-height: `44px`
- Input height: `40px`
- Font: `14px` body, `16px` labels

### Bordes & Shadows
- Border radius: `8px`
- Box shadow: `0 1px 2px rgba(0,0,0,0.05)` (ligero)
- Hover shadow: `0 4px 6px rgba(0,0,0,0.1)` (más notable)

---

## ✅ ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. **Fase 1 (CRÍTICA)**: Layout 2-column en Productos & Pedidos
2. **Fase 2 (CRÍTICA)**: Tamaños imágenes (40px) y checkboxes (20px)
3. **Fase 3 (CRÍTICA)**: Cards styling (padding, border, shadow)
4. **Fase 4 (CRÍTICA)**: Contraste texto mejorado
5. **Fase 5 (CRÍTICA)**: Búsqueda vacía por defecto (Productos & Pedidos)
6. **Fase 6 (CRÍTICA)**: Validación cliente en Pedidos (backend + frontend)
7. **Fase 7 (IMPORTANTE)**: Jerarquía de botones (4 tipos, estilos en CSS)
8. **Fase 8 (IMPORTANTE)**: Responsive mobile en todos
9. **Fase 9 (IMPORTANTE)**: Focus rings mejorados
10. **Fase 10 (IMPORTANTE)**: Hover effects
11. **Fase 11 (MINOR)**: Input labels reorganizados
12. **Fase 12 (MINOR)**: Error messages & validation visual

---

**Total estimado: 4-5 horas de refactor (más trabajo que antes)**

---

## 📊 CAMBIOS ADICIONALES INCLUIDOS (últimos prompts)

✅ **Punto 19**: Jerarquía de botones (4 tipos con estilos específicos)  
✅ **Punto 20**: Búsqueda vacía por defecto en Productos & Pedidos (mantener Historial)

---

## 🎉 MEJORAS IMPLEMENTADAS - 31 DICIEMBRE 2025

### 🔧 UX/UI FIXES

#### Dark Mode Completo
- ✅ **Templates.jsx (Pedidos Recurrentes)**: Todos los inline styles convertidos a clases CSS con soporte dark mode
- ✅ **ListasPrecios.jsx**: Todos los inline styles convertidos a clases CSS
- ✅ **Modales de confirmación**: Background #1f2937, border #374151, color #f9fafb en dark mode
- ✅ **Clases CSS nuevas agregadas**:
  - `.panel-light` - contenedor con fondo claro
  - `.product-pill` / `.product-pill.selected` - pills de productos en templates
  - `.template-item` - card de template
  - `.lista-item` / `.lista-item.active` - card de lista de precios
  - `.badge-discount`, `.badge-surcharge`, `.badge-neutral` - badges de ajuste
  - `.table-header-light` - encabezado de tabla
  - `.table-row-bordered` - filas de tabla
  - `.custom-checkbox` - checkbox personalizado (arregla el cuadrado negro)

#### Footer Mejorado
- ✅ **Keyboard shortcuts más visibles**: Badges más grandes, padding aumentado
- ✅ **Agregado Ctrl+4 Historial** que faltaba
- ✅ **Badge de Ayuda (Ctrl+?) en naranja** para destacar
- ✅ **Fondo gradient sutil** para el footer
- ✅ **Dark mode completo** en footer shortcuts

#### Navegación
- ✅ **Barra en una sola línea** con overflow-x scroll
- ✅ **Links más compactos** para que quepan todos

### 👥 GESTIÓN DE USUARIOS (NUEVA FEATURE)

#### Backend (main.py + db.py)
- ✅ `GET /usuarios` - Lista todos los usuarios (admin only)
- ✅ `PUT /usuarios/{id}/activar` - Activa un usuario
- ✅ `PUT /usuarios/{id}/desactivar` - Desactiva un usuario  
- ✅ `PUT /usuarios/{id}/rol` - Cambia rol (admin/vendedor/usuario)
- ✅ `DELETE /usuarios/{id}` - Elimina un usuario

#### Frontend (Usuarios.jsx - NUEVO)
- ✅ Componente completo con tabla de usuarios
- ✅ Muestra: nombre, rol, estado (activo/inactivo), último login
- ✅ Acciones: activar/desactivar, cambiar rol, eliminar
- ✅ Solo visible para admin
- ✅ Ruta `/usuarios` en LayoutApp.jsx

### 📊 NUEVOS REPORTES (6 TOTAL)

#### Backend (main.py)
- ✅ `GET /reportes/productos` - Productos más vendidos, por categoría, sin ventas
- ✅ `GET /reportes/rendimiento` - Métricas operativas, pedidos por día/hora, usuarios activos
- ✅ `GET /reportes/comparativo` - Este mes vs anterior, evolución 7 días y 6 meses

#### Frontend (Reportes.jsx - AMPLIADO)
- ✅ **💰 Ventas**: Resumen, facturación, top productos
- ✅ **🏆 Productos**: Top 20 más vendidos, ventas por categoría, sin ventas en período
- ✅ **📦 Inventario**: Stock bajo, sin movimiento
- ✅ **👥 Clientes**: Ranking top 20, inactivos +60 días
- ✅ **⚡ Rendimiento**: Por día de semana, por hora, usuarios más activos
- ✅ **📈 Comparativo**: Este mes vs anterior, variación %, últimos 7 días, últimos 6 meses

### 🔧 OTROS FIXES

- ✅ **Checkbox en Historial**: Ya no aparece como cuadrado negro, usa `.custom-checkbox`
- ✅ **Listas sin nombre**: Fallback "(Sin nombre)" cuando lista.nombre está vacío
- ✅ **Reporte de inventario**: Tablas correctas para bajo_stock y sin_movimiento
- ✅ **Clientes inactivos**: Formato de tabla correcto (antes era texto plano)

---

## 🚀 IDEAS PARA FUTURAS MEJORAS

- 📧 **Notificaciones/Alertas**: Email cuando stock bajo, cuando cliente inactivo hace pedido
- 📱 **PWA**: Hacer la app instalable en el celular
- 🔔 **Recordatorios automáticos**: Para clientes que no compraron en X días
- 💳 **Gestión de pagos**: Marcar pedidos como pagados/pendientes
- 🚚 **Estados de entrega**: Preparando → En camino → Entregado
- 📊 **Gráficos visuales**: Barras/líneas para los reportes (Chart.js)
- 🏷️ **Promociones/Ofertas**: Descuentos por cantidad o temporada
- 📤 **Exportar a Excel**: Los reportes y listas
- 🔍 **Búsqueda global**: Buscar en toda la app con Ctrl+K
- 🌐 **Internacionalización**: Soporte multi-idioma

---

**¿Empezamos a codear todas las fases?**
