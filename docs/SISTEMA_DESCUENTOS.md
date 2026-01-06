# 🎉 Sistema de Descuentos - Ofertas

## Resumen

El sistema de descuentos permite crear ofertas con porcentaje de descuento que se aplican **automáticamente** a los pedidos cuando se agregan productos que están en ofertas activas.

## Características

### 1. **Gestión de Ofertas** (Sección Ofertas)

- ✅ Crear/editar ofertas con título, descripción y rango de fechas
- ✅ Configurar **porcentaje de descuento** (1-100%)
- ✅ Seleccionar múltiples productos para la oferta
- ✅ Activar/desactivar ofertas manualmente
- ✅ Búsqueda de productos con chips visuales
- ✅ Vista de todas las ofertas con estado (VIGENTE/ACTIVA/INACTIVA)

### 2. **Aplicación Automática en Pedidos**

Cuando creas un pedido:

1. **El sistema carga automáticamente** todas las ofertas activas y vigentes
2. **Verifica cada producto** agregado al carrito
3. **Si el producto está en una oferta activa**, aplica el descuento automáticamente
4. **Muestra visualmente**:
   - Badge "🎉 -X%" junto al nombre del producto
   - Precio original tachado
   - Precio con descuento en verde y negrita
   - Ahorro total en el panel de total estimado

### 3. **Cálculo de Descuentos**

```javascript
// Ejemplo: Producto con precio $100 y oferta de 15%
Precio Original: $100
Descuento: 15%
Precio Final: $100 * (1 - 15/100) = $85
Ahorro: $15
```

## Cómo Usar

### Crear una Oferta

1. Ir a **Ofertas** en el menú
2. Completar el formulario:
   - **Título**: Nombre de la oferta (Ej: "🔥 Oferta de la semana")
   - **Descripción**: Detalle opcional
   - **Desde/Hasta**: Rango de fechas de validez
   - **Descuento (%)**: Porcentaje a aplicar (Ej: 15)
   - **Productos**: Buscar y seleccionar productos (aparecerán como chips)
3. Click en "➕ Crear Oferta"
4. La oferta estará **ACTIVA** por defecto

### Aplicar Descuentos en Pedidos

**¡No hay que hacer nada!** Los descuentos se aplican automáticamente:

1. Crear un pedido normalmente
2. Seleccionar cliente
3. Agregar productos al carrito
4. Si un producto tiene oferta activa:
   - Verás el badge "🎉 -X%"
   - El precio mostrará: ~~$100~~ → **$85** c/u
   - El subtotal usará el precio con descuento
5. En el panel de total verás: "🎉 Ahorrás $XXX con ofertas activas"

### Activar/Desactivar Ofertas

- En la lista de ofertas, click en "🟢 Activar / ⭕ Desactivar"
- Solo las ofertas **ACTIVAS** y **VIGENTES** (dentro de las fechas) aplican descuento

## Validaciones

### Backend (`/backend/main.py` y `/backend/db.py`)

- ✅ Descuento entre 1-100%
- ✅ Fechas válidas (desde <= hasta)
- ✅ Al menos un producto seleccionado
- ✅ Campo `descuento_porcentaje` en tabla `ofertas` (default: 10)

### Frontend (`/frontend/src/components/Pedidos.jsx`)

- ✅ Carga ofertas activas al montar el componente
- ✅ Función `obtenerDescuento(productoId)` busca descuento aplicable
- ✅ Función `calcularPrecioFinal(precio, productoId)` aplica descuento
- ✅ `calcularTotales()` usa precios con descuento
- ✅ Visualización con precios tachados y badges

## Arquitectura Técnica

### Base de Datos

```sql
-- Columna agregada a tabla ofertas
ALTER TABLE ofertas ADD COLUMN descuento_porcentaje REAL DEFAULT 10;
```

### Endpoints API

```python
# Obtener ofertas activas (vigentes y activadas)
GET /ofertas/activas
Response: [{
  id, titulo, descripcion, desde, hasta, 
  descuento_porcentaje, productos_ids: [1,2,3]
}]

# Crear oferta con descuento
POST /ofertas
Body: titulo, descripcion, desde, hasta, 
      descuento_porcentaje, productos_ids
```

### Flujo de Datos

```
1. Usuario crea oferta con descuento → Backend guarda en DB
2. Usuario abre Pedidos → Frontend carga ofertas activas
3. Usuario agrega producto → Frontend verifica si tiene oferta
4. Si tiene oferta → Calcula precio con descuento
5. Muestra precio original tachado + precio final
6. Total del pedido usa precios con descuento
```

## Ejemplos Visuales

### En el Carrito de Pedidos

```
📦 Chorizo Parrillero  🎉 -15%
   $100 → $85 c/u
```

### Panel de Total

```
💰 Total Estimado                    3 producto(s)
   $255.00
   🎉 Ahorrás $45.00 con ofertas activas
```

### Lista de Ofertas

```
🟢 VIGENTE  ✓ ACTIVA

🔥 Oferta de la semana
Especial para productos seleccionados

📅 Desde: 2024-01-15    📅 Hasta: 2024-01-22    💰 15% OFF

📦 Productos (3):
[Chorizo] [Hamburguesa] [Panchos]

[✏️ Editar] [⭕ Desactivar] [🗑️ Eliminar]
```

## Testing

Para probar el sistema:

1. **Crear una oferta de prueba**:
   - Título: "Test Descuento 20%"
   - Descuento: 20%
   - Productos: Seleccionar 2-3 productos
   - Desde: Hoy
   - Hasta: Mañana

2. **Ir a Pedidos**:
   - Seleccionar un cliente
   - Agregar uno de los productos de la oferta
   - Verificar que aparezca el badge "🎉 -20%"
   - Verificar precio tachado y precio con descuento
   - Agregar otro producto sin oferta (no tendrá badge)
   - Verificar ahorro total en el panel

3. **Desactivar la oferta**:
   - Volver a Ofertas
   - Desactivar la oferta
   - Volver a Pedidos (refresh)
   - Agregar el mismo producto
   - Verificar que **no** tenga descuento

## Notas Importantes

- ⚠️ Si un producto está en **múltiples ofertas activas**, se aplica la **primera** encontrada
- ⚠️ Las ofertas **INACTIVAS** no aplican, aunque estén vigentes por fecha
- ⚠️ Las ofertas fuera de fecha no aplican, aunque estén activas
- ✅ Los descuentos solo aplican en **nuevos pedidos**, no afectan pedidos existentes
- ✅ El descuento se calcula en tiempo real al agregar productos al carrito

## Archivos Modificados

- `/backend/main.py` - Endpoints de ofertas con campo descuento
- `/backend/db.py` - Funciones CRUD con descuento_porcentaje
- `/frontend/src/components/Ofertas.jsx` - Form con input de descuento
- `/frontend/src/components/Pedidos.jsx` - Lógica de aplicación automática
- Database: Columna `descuento_porcentaje` en tabla `ofertas`
