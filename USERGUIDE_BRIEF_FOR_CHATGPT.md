# BRIEF PARA CHATGPT — Generación de Guía de Usuario FrioSur Pedidos

> **Instrucción para ChatGPT:** Usá este documento para crear una **Guía de Usuario visual, paso a paso**, dirigida a personas que NO saben usar tecnología. Debe ser clara, con lenguaje simple (español argentino/uruguayo), y donde se indique `[SCREENSHOT: ...]` vos generá una imagen ilustrativa mostrando una interfaz de celular/web similar a lo descrito. Generá todas las imágenes que puedas. La guía es para una app de gestión de pedidos de una empresa de alimentos congelados.

---

## DATOS DE LA APP

- **Nombre**: FrioSur Pedidos
- **URL**: www.pedidosfriosur.com
- **Tipo**: App web (PWA) — se puede usar desde el navegador o instalar como app en el celular
- **Usuarios**: Vendedores, personal de oficina y administradores de una distribuidora de alimentos congelados
- **Funciona offline**: Sí, los datos se guardan en el teléfono y se sincronizan cuando hay internet

---

## CÓMO INSTALAR LA APP EN EL CELULAR

### En Android (Chrome)
1. Abrir www.pedidosfriosur.com en Chrome
2. Aparece un cartel azul abajo que dice "Instalá FrioSur" con un botón **"Instalar"**
3. Tocar **Instalar**
4. La app aparece en la pantalla de inicio como un ícono

### En iPhone (Safari)
1. Abrir www.pedidosfriosur.com **en Safari** (NO en Chrome ni otro navegador)
2. Tocar el ícono de **Compartir** ⬆️ (cuadradito con flecha, abajo en la barra de Safari)
   - **IMPORTANTE**: Dice "Compartir" pero NO es para compartir. Es el único lugar donde Apple pone la opción de instalar apps web.
3. Deslizar hacia abajo en el menú y tocar **"Agregar a pantalla de inicio"**
4. Tocar **"Agregar"** arriba a la derecha
5. La app aparece en la pantalla de inicio como un ícono

---

## CÓMO ENTRAR (LOGIN)

1. Abrir la app
2. Escribir el **Usuario** en el primer campo
3. Escribir la **Contraseña** en el segundo campo
4. Tocar **"Ingresar"**
5. Si los datos son correctos, entra al sistema

[SCREENSHOT: Pantalla de login con campos Usuario y Contraseña, botón azul "Ingresar", logo FrioSur arriba]

---

## NAVEGACIÓN — CÓMO MOVERSE POR LA APP

### En celular (barra de abajo)
La app tiene 5 botones fijos en la parte de abajo del celular:

| Ícono | Nombre | Qué hace |
|-------|--------|----------|
| 🛒 | **Pedidos** | Crear un pedido nuevo |
| 📦 | **Productos** | Ver y buscar productos, precios, stock |
| 📋 | **Historial** | Ver pedidos ya creados, generar PDFs |
| 👥 | **Clientes** | Ver y agregar clientes |
| ☰ | **Más** | Ofertas, cerrar sesión, instalar app, y más opciones |

[SCREENSHOT: Barra inferior del celular con los 5 íconos: Pedidos, Productos, Historial, Clientes, Más]

### En computadora (barra de arriba)
En la computadora la navegación está arriba en una barra horizontal con links a cada sección.

---

## MÓDULO 1: CLIENTES 👥

### Para qué sirve
Es donde se guardan todos los clientes de la empresa. Cada cliente tiene: nombre, teléfono, dirección y zona.

### Cómo agregar un cliente nuevo

1. Ir a **Clientes** (tocar 👥 abajo)
2. Aparece un formulario a la izquierda (o arriba en celular)
3. Completar los campos:

| Campo | ¿Obligatorio? | Ejemplo |
|-------|---------------|---------|
| **Nombre** | ✅ SÍ | "Carnicería Don Pedro" |
| **Teléfono** | No | "099 123 456" |
| **Dirección** | No | "Av. Italia 2345" |
| **Zona** | No | "Zona Norte" |
| **Vendedor asignado** | No | Elegir de la lista |

4. Tocar el botón **"➕ Agregar Cliente"**
5. Si todo está bien, aparece un cartel verde: "Cliente creado correctamente"

[SCREENSHOT: Formulario de crear cliente con los campos Nombre, Teléfono, Dirección, Zona y botón verde "Agregar Cliente"]

### Cómo buscar un cliente

1. Ir a **Clientes**
2. En la parte derecha (o abajo en celular) hay un campo de búsqueda: **"🔍 Escribí para buscar..."**
3. Escribir parte del nombre, teléfono o dirección
4. La lista se filtra automáticamente mientras se escribe

[SCREENSHOT: Campo de búsqueda con texto "Pedro" escrito, mostrando 2 resultados filtrados debajo]

### Cómo ver los datos de un cliente

1. Buscar el cliente en la lista
2. Tocar su nombre
3. Aparece un panel con todos sus datos: nombre, teléfono (tocable para llamar), dirección, zona y vendedor asignado

### Cómo editar un cliente

1. Seleccionar el cliente de la lista
2. Tocar el botón **"✏️ Editar"**
3. Los datos se cargan en el formulario de la izquierda
4. Modificar lo que se necesite
5. Tocar **"💾 Guardar cambios"**

### Cómo eliminar un cliente

1. Seleccionar el cliente
2. Tocar **"🗑️ Eliminar"**
3. Aparece un cartel preguntando si estás seguro
4. Tocar **"Eliminar"** para confirmar
5. **Nota**: Solo se puede eliminar si el cliente NO tiene pedidos asociados

### Cómo exportar clientes

- Tocar el botón **"📥 Exportar CSV"** arriba de la lista
- Se descarga un archivo con todos los clientes (se puede abrir en Excel)

### Cómo asignar un vendedor a un cliente

1. En la tarjeta del cliente, tocar donde dice **"Sin asignar ✏️"** (o el nombre del vendedor actual)
2. Se abre un desplegable con todos los vendedores
3. Elegir uno
4. Se guarda automáticamente

---

## MÓDULO 2: PRODUCTOS 📦

### Para qué sirve
Es el catálogo de todos los productos que vende la empresa. Cada producto tiene: nombre, precio, stock, tipo (unidad/kilo/caja/gancho/tira), categoría e imagen.

### Cómo agregar un producto nuevo

1. Ir a **Productos** (tocar 📦 abajo)
2. Completar el formulario de la izquierda:

| Campo | ¿Obligatorio? | Ejemplo |
|-------|---------------|---------|
| **Nombre** | ✅ SÍ | "Milanesa de Pollo x1kg" |
| **Precio** | ✅ SÍ | "890.00" |
| **Stock inicial** | No | "50" |
| **Tipo** | No | Unidad, Kilo, Caja, Gancho o Tira |
| **Stock mínimo** | No | "10" (para alertas de stock bajo) |
| **Categoría** | No | Elegir de la lista |
| **Imagen** | No | Arrastrar una foto o tocar para elegir del celular |

3. Tocar **"➕ Agregar Producto"**
4. Aparece un cartel verde: "Producto creado correctamente"

[SCREENSHOT: Formulario de producto con campos Nombre, Precio, Stock, tipo de unidad, zona para arrastrar imagen con ícono de cámara]

### Cómo subir una imagen del producto

**Opción A — Desde el celular:**
1. Tocar la zona gris que dice **"📷 Arrastra una imagen o haz click para seleccionar"**
2. Se abre la cámara o galería del celular
3. Elegir o tomar la foto
4. La imagen se sube automáticamente

**Opción B — Arrastrando:**
1. Arrastrar la imagen desde otra ventana y soltarla en la zona gris
2. La imagen se sube automáticamente

**Límites:** Máximo 5MB, formatos JPG, PNG, GIF o WEBP.

### Cómo buscar un producto

1. Ir a **Productos**
2. En la parte derecha (o abajo en celular) hay un campo: **"🔍 Buscar productos..."**
3. Escribir parte del nombre
4. La lista se filtra automáticamente

### Filtros avanzados

Además de buscar por nombre, se puede filtrar por:

| Filtro | Qué hace |
|--------|----------|
| **☐ Stock bajo** | Muestra solo productos con poco stock |
| **Tipo** | Filtra por Unidad, Caja, Gancho, Tira |
| **Categoría** | Filtra por categoría (ej: Carnes, Lácteos) |
| **Precio min / max** | Filtra por rango de precio |

[SCREENSHOT: Panel de filtros con checkbox "Stock bajo", selectores de Tipo y Categoría, campos de precio mínimo y máximo]

### Cómo editar un producto

1. Buscar el producto en la lista
2. Tocar el botón **"✏️"** (lápiz) en la tarjeta del producto
3. Se abre un modal con todos los campos editables
4. Modificar lo que se necesite
5. Tocar **"💾 Guardar"**

### Cómo cambiar la imagen de un producto existente

1. Tocar la imagen del producto en la lista
2. Se abre un panel con zona para arrastrar nueva imagen
3. Subir la nueva imagen
4. También se puede tocar **"🗑️ Quitar Imagen"** para borrarla

### Cómo eliminar un producto

1. Tocar el botón **"🗑️"** (basura) en la tarjeta del producto
2. Confirmar en el diálogo que aparece
3. **Nota**: Solo se puede eliminar si el producto NO tiene pedidos asociados

### Gestor de Stock (vista especial)

1. Tocar el botón **"📊 Gestor Stock"** arriba de la lista
2. Se abre una tabla con todos los productos y su stock actual
3. Para editar el stock de un producto: **tocar el número de stock**
4. Escribir el nuevo número
5. Tocar **"✓"** para guardar o **"✕"** para cancelar
6. Los productos con stock bajo aparecen marcados con **"⚠️ Bajo"** en naranja
7. Para volver a la vista normal: tocar **"📋 Volver a Productos"**

[SCREENSHOT: Tabla del Gestor de Stock con columnas Producto, Stock, Mínimo, Estado. Un producto con el stock en modo edición mostrando campo numérico con botones ✓ y ✕]

### Cómo exportar productos

- **CSV**: Tocar **"📥 CSV"** (se abre en Excel como tabla de texto)
- **Excel**: Tocar **"📊 Excel"** (archivo .xlsx nativo de Excel)

### Alerta de stock bajo

- Si hay productos con stock bajo, aparece un cartel naranja arriba: **"⚠️ X productos con stock bajo"**
- Tocar **"Ver"** para filtrar solo esos productos

---

## MÓDULO 3: PEDIDOS (Crear Pedido) 🛒

### Para qué sirve
Es donde se crea un pedido nuevo. Se elige un cliente, se agregan productos con cantidades, y se guarda.

### Cómo crear un pedido paso a paso

#### Paso 1: Elegir el cliente

1. Ir a **Pedidos** (tocar 🛒 abajo)
2. En el campo **"🔍 Escribí para buscar cliente..."** escribir el nombre del cliente
3. Aparece una lista desplegable con las coincidencias
4. Tocar el cliente correcto
5. El cliente queda seleccionado y se muestra su nombre, teléfono y dirección

[SCREENSHOT: Campo de búsqueda de cliente con "Carnicería" escrito, desplegable mostrando 3 clientes con nombre y teléfono]

#### Paso 2: Agregar productos

1. En el panel de la derecha (o abajo en celular) está el **catálogo** de productos
2. Usar el campo **"🔍 Buscar productos..."** para encontrar el producto deseado
3. Tocar **"+ Agregar"** en el producto que se quiere agregar
4. El botón cambia a **"✓ Listo"** (ya está agregado)
5. Repetir para cada producto que se quiera agregar

[SCREENSHOT: Catálogo de productos con cards mostrando imagen, nombre, precio y botón "+ Agregar" azul. Uno de los productos ya tiene botón "✓ Listo" gris]

#### Paso 3: Ajustar cantidades

1. Los productos agregados aparecen en el panel izquierdo bajo **"🧊 Productos (N)"**
2. Para cada producto se puede:
   - Tocar **"+"** para aumentar la cantidad (de a 0.5)
   - Tocar **"−"** para disminuir la cantidad (mínimo 0.5)
   - Escribir la cantidad directamente en el campo numérico
   - Cambiar el tipo de unidad (Unidad, Kilo, Caja, Gancho, Tira)
3. El subtotal de cada producto se calcula automáticamente
4. Para quitar un producto: tocar la **"✕"** roja al lado del producto

[SCREENSHOT: Lista de productos en el pedido con nombre, precio, controles de cantidad (-/número/+), selector de tipo, subtotal, y botón ✕ para eliminar]

#### Paso 4: Ver el total

- Abajo de los productos aparece el **"💰 Total Estimado"** con el monto total
- Si hay ofertas activas, aparece: **"🎉 Ahorrás $XXX con ofertas activas"**
- Los productos con descuento muestran el precio original tachado y el precio con descuento

#### Paso 5: Agregar notas (opcional)

- Hay un campo de texto: **"📝 Notas / Observaciones (opcional)"**
- Ejemplo: "Entregar antes de las 15:00, dejar en portería"

#### Paso 6: Guardar el pedido

1. Tocar **"💾 Guardar Pedido"**
2. Si todo está bien, aparece: "Pedido guardado correctamente"
3. El formulario se limpia para crear otro pedido

**Si falta algo:**
- Sin cliente seleccionado: aparece **"⚠️ Selecciona un cliente para continuar"**
- Sin productos: el botón está deshabilitado

[SCREENSHOT: Panel completo de pedido con cliente seleccionado arriba, 3 productos con cantidades, total de $3,450.00, campo de notas, y botón "💾 Guardar Pedido" azul grande]

### Ordenar productos en el catálogo

- Hay un selector para ordenar:
  - **A → Z** (alfabético)
  - **Z → A** (alfabético invertido)
  - **Menor precio** (más baratos primero)
  - **Mayor precio** (más caros primero)

### El pedido se guarda como borrador

- Si cerrás la app sin guardar, el pedido queda guardado como **borrador**
- Al volver a entrar, se recupera automáticamente el cliente, los productos y las cantidades
- Si intentás cerrar la pestaña con un pedido sin guardar, aparece un aviso: "¿Seguro que querés salir?"

### Productos con stock agotado

- Si un producto tiene stock 0, aparece el botón **"Sin stock"** en rojo y no se puede agregar

### En celular: botón flotante

- Cuando hay productos seleccionados, aparece un botón flotante abajo con:
  - El total del pedido
  - La cantidad de productos
  - Botón **"💾 Guardar"**

[SCREENSHOT: Botón flotante azul en la parte inferior del celular mostrando "$2,340.00 | 3 producto(s) | 💾 Guardar"]

---

## MÓDULO 4: HISTORIAL DE PEDIDOS 📋

### Para qué sirve
Es donde se ven todos los pedidos que ya se crearon. Se pueden revisar, editar, generar PDFs para imprimir, y eliminar.

### Cómo entrar

Tocar **📋 Historial** en la barra de abajo del celular.

### Las dos pestañas

El historial tiene dos pestañas (botones arriba):

| Pestaña | Significado |
|---------|-------------|
| **⏳ Pendientes (N)** | Pedidos creados pero que NO tienen PDF generado todavía |
| **✅ Generados (N)** | Pedidos que YA tienen PDF generado, listos para imprimir |

[SCREENSHOT: Dos botones de pestaña arriba - "⏳ Pendientes (12)" en amarillo y "✅ Generados (45)" en verde, con el de Pendientes seleccionado]

### Cómo se ve cada pedido

Cada pedido aparece como una tarjeta con:
- **Pedido #123** (número de pedido)
- Estado: ⏳ **Pendiente** (amarillo) o ✅ **Generado** (verde)
- **Cliente**: nombre del cliente
- **Fecha** y **cantidad de productos**
- Lista de productos con cantidades y precios
- Si tiene notas, aparecen abajo con ícono 📝

[SCREENSHOT: Tarjeta de un pedido mostrando "Pedido #245", badge "⏳ Pendiente" amarillo, "Cliente: Carnicería Don Pedro", "Fecha: 12/02/2026", lista de 3 productos con cantidades]

### Cómo buscar un pedido

1. Arriba hay un campo: **"🔍 Cliente o producto..."**
2. Escribir el nombre del cliente o un producto
3. La lista se filtra automáticamente

### Cómo filtrar por fecha

1. Usar los campos **"📅 Desde"** y **"📅 Hasta"**
2. Elegir las fechas
3. Solo se muestran pedidos dentro de ese rango

### Filtrar por vendedor/usuario (solo administradores)

- Los administradores ven un selector extra: **"👤 Todos los usuarios"**
- Pueden elegir ver solo los pedidos creados por un vendedor específico

### Cómo generar un PDF de un pedido

1. Estar en la pestaña **⏳ Pendientes**
2. Marcar el checkbox (☐) de los pedidos que se quieren generar
3. Tocar el botón **"📄 Generar PDFs (N)"** (aparece cuando hay selección)
4. Si hay problemas de stock, aparece un resumen:
   - Muestra qué productos se van a restar del stock
   - Advertencias si algún producto no tiene suficiente stock
   - Botones: **"Cancelar"** o **"Continuar con PDFs"**
5. Se genera y descarga el PDF automáticamente
6. El pedido pasa a la pestaña **✅ Generados**

[SCREENSHOT: 3 pedidos con checkboxes marcados, botón verde "📄 Generar PDFs (3)" visible arriba]

### Verificar stock antes de generar

1. Seleccionar pedidos con los checkboxes
2. Tocar **"📊 Verificar Stock"**
3. Se abre un modal con una tabla que muestra:
   - Nombre del producto
   - Stock actual
   - Cantidad a restar
   - Stock nuevo resultante
4. Los productos que quedarían en 0 se marcan en naranja

### Seleccionar todos los pedidos de la página

- Tocar **"✓ Seleccionar página"** para marcar todos los pedidos visibles
- Tocar **"✕ Limpiar"** para desmarcar todos

### Cómo editar los productos de un pedido (solo pendientes)

1. En un pedido pendiente, tocar **"✏️ Editar productos"**
2. Se abren los controles de edición:
   - Cambiar la **cantidad** de cada producto
   - Cambiar el **tipo** (Unidad, Kilo, Caja, etc.)
   - **Eliminar** un producto del pedido (botón ✕)
   - **Agregar** un producto nuevo con el selector "+ Producto..."
3. Tocar **"Listo"** cuando se termina de editar

[SCREENSHOT: Pedido en modo edición mostrando productos con campos de cantidad editables, selectores de tipo, botones ✕ para eliminar, y un selector "+ Producto..." para agregar nuevo]

### Cómo editar las notas de un pedido

1. Tocar el ícono **"✏️"** al lado de la nota (o donde dice "📝 Sin notas")
2. Escribir o modificar la nota
3. Tocar **"💾"** para guardar o **"✕"** para cancelar

### Cómo asignar un cliente a un pedido sin cliente

1. Si un pedido dice **"⚠️ Sin cliente"**, tocar **"👤 Asignar cliente"**
2. Se abre un desplegable con todos los clientes
3. Elegir el cliente correcto

### Cómo eliminar un pedido

1. Tocar **"🗑️ Eliminar"** en la tarjeta del pedido
2. Confirmar en el diálogo
3. El pedido se elimina
4. Aparece una barra roja abajo: **"Pedido eliminado"** con botón **"↶ Deshacer"**
5. Tenés **10 segundos** para tocar "Deshacer" si te equivocaste

[SCREENSHOT: Barra roja flotante en la parte inferior mostrando "Pedido eliminado" con botón "↶ Deshacer"]

### Cómo exportar el historial

- Tocar **"📥 Exportar CSV"** arriba
- Se descarga un archivo con todos los pedidos filtrados (respeta los filtros de fecha activos)

### Cuántos pedidos se ven por página

- Abajo hay un selector: **10, 25, 50, 100 o Todos** pedidos por página
- Por defecto muestra 25
- Se puede navegar con los botones **"← Anterior"** y **"Siguiente →"**

### Pedidos viejos sin generar

- Los pedidos pendientes de más de 24 horas aparecen con un borde rojo y un aviso:
  **"⚠️ Creado el XX/XX — Sin generar PDF"**

---

## TIPS GENERALES

### Si no hay internet
- La app funciona sin internet para **consultar** datos (clientes, productos, historial)
- Si creás un pedido sin internet, se guarda en una **cola offline** y se envía automáticamente cuando vuelve la conexión
- Aparece un indicador **"📡 Sin conexión"** arriba cuando no hay internet
- Cuando vuelve la conexión: **"✅ Conexión restablecida"**

### Temas (modo claro / oscuro)
- Tocar **"🌞 Light"** o **"🌙 Dark"** arriba para cambiar entre modo claro y modo oscuro

### Cambiar contraseña
- Tocar el ícono **"🔐"** arriba al lado del nombre de usuario
- Se abre un formulario para cambiar la contraseña

### Cerrar sesión
- **En celular**: Tocar **☰ Más** → **🚪 Cerrar sesión**
- **En computadora**: Tocar **🚪 Salir** arriba a la derecha

---

## INFORMACIÓN TÉCNICA PARA LAS IMÁGENES

La app tiene estos colores principales:
- **Azul primario**: #3b82f6
- **Verde éxito**: #22c55e (para botones de confirmar, badges de generado)
- **Amarillo/naranja advertencia**: #f59e0b (para pendientes, stock bajo)
- **Rojo peligro**: #ef4444 (para eliminar, errores)
- **Fondo modo claro**: blanco (#ffffff)
- **Fondo modo oscuro**: azul muy oscuro (#0a1628)
- **Logo**: "FRIOSUR" con un copo de nieve sobre fondo blanco/amarillo

La barra inferior del celular tiene fondo oscuro con íconos en gris claro, y el ícono activo se resalta en azul.

Las tarjetas tienen bordes redondeados, sombras sutiles y padding generoso.

Los botones principales son redondeados con gradientes.
