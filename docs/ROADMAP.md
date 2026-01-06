# 🚀 Casa de Congelados - Roadmap de Mejoras

## 📊 Estado Actual
- ✅ Sistema base funcionando (Clientes, Productos, Pedidos, Historial)
- ✅ Autenticación JWT
- ✅ Generación de PDFs
- ✅ UI moderna con diseño responsivo
- ✅ Drag & Drop para imágenes
- ✅ Editar imágenes de productos
- ✅ Asignar cliente a pedidos huérfanos
- ✅ Eliminar pedidos

---

## 🎯 PRIORIDAD CRÍTICA (Hacer YA)

### 1. 📦 Sistema de Inventario/Stock
**Problema**: No hay control de stock, podrías vender productos sin tener.

**Implementación**:
- [ ] Agregar columna `stock` a tabla productos (INTEGER, default 0)
- [ ] Input de stock al crear/editar producto
- [ ] Mostrar stock actual en lista de productos
- [ ] Al crear pedido: validar que `stock >= cantidad_pedida`
- [ ] Al generar PDF: restar stock automáticamente
- [ ] Badge de alerta si stock < 10
- [ ] Página de reporte: "Productos con stock bajo"
- [ ] Historial de movimientos de stock (opcional)

**Tiempo estimado**: 3-4 horas

---

### 2. 📄 Paginación en Clientes
**Problema**: 404 clientes es mucho para renderizar. La app se puede poner lenta.

**Implementación**:
- [ ] Backend: Agregar parámetros `?page=1&limit=50` a `/clientes`
- [ ] Frontend: Botones "Anterior" / "Siguiente"
- [ ] Mostrar "Página 1 de 9" (404 clientes / 50 por página)
- [ ] Mantener búsqueda funcionando con paginación
- [ ] Opción "Ver todos" si necesario

**Tiempo estimado**: 2 horas

---

### 3. 📊 Exportar a Excel/CSV
**Problema**: No hay forma de compartir/analizar datos fuera de la app.

**Implementación**:
- [ ] Backend: Endpoint `/clientes/export?format=csv`
- [ ] Backend: Endpoint `/pedidos/export?format=csv&desde=2025-01-01&hasta=2025-12-31`
- [ ] Frontend: Botón "📥 Exportar" en cada módulo
- [ ] Incluir filtros aplicados en export
- [ ] Usar biblioteca `pandas` o `csv` en backend

**Tiempo estimado**: 2-3 horas

---

## ⚡ PRIORIDAD ALTA (Próximas 2 semanas)

### 4. 🔍 Búsqueda y Filtros Avanzados
- [ ] Historial: Filtrar por cliente, fecha (desde/hasta), estado
- [ ] Clientes: Buscar por teléfono, dirección, barrio
- [ ] Productos: Filtrar por rango de precio, con/sin imagen
- [ ] Ordenar por: nombre, fecha, precio (ASC/DESC)
- [ ] Guardar filtros preferidos en localStorage

**Tiempo estimado**: 4 horas

---

### 5. ✏️ Editar Pedidos Pendientes
**Problema**: Si te equivocás en un pedido, hay que eliminarlo y crearlo de nuevo.

**Implementación**:
- [ ] Botón "✏️ Editar" en pedidos pendientes (no generados)
- [ ] Modal o vista para cambiar cantidad de productos
- [ ] Agregar más productos al pedido
- [ ] Eliminar productos del pedido
- [ ] Cambiar cliente asignado (ya existe endpoint)
- [ ] Deshabilitar edición para pedidos generados

**Tiempo estimado**: 3 horas

---

### 6. 🚫 Validaciones y Duplicados
- [ ] Evitar productos con el mismo nombre (mostrar alerta)
- [ ] Evitar clientes duplicados (buscar por nombre antes de crear)
- [ ] Validar formato de teléfono argentino (opcional: +54 9 11...)
- [ ] Dropdown de barrios existentes (autocompletar)
- [ ] Validar que precio > 0

**Tiempo estimado**: 2 horas

---

## 🎨 PRIORIDAD MEDIA (Próximo mes)

### 7. 📱 Notificaciones Toast
**Problema**: Los `alert()` son feos y blockeantes.

**Implementación**:
- [ ] Instalar `react-toastify` o similar
- [ ] Reemplazar todos los `alert()` con toasts
- [ ] Tipos: success (verde), error (rojo), info (azul)
- [ ] Auto-dismiss después de 3-5 segundos
- [ ] Posición: top-right

**Tiempo estimado**: 1 hora

---

### 8. 📈 Dashboard / Resumen de Ventas
- [ ] Página principal con estadísticas:
  - Total de pedidos este mes
  - Productos más vendidos (top 10)
  - Clientes más activos (top 10)
  - Ingresos totales por período
- [ ] Gráficos simples (barras, líneas)
- [ ] Usar `recharts` o `chart.js`

**Tiempo estimado**: 5 horas

---

### 9. 🎨 Personalización de PDFs
- [ ] Configuración: Logo de la empresa
- [ ] Configuración: Información de contacto (teléfono, email, dirección)
- [ ] Configuración: Texto de agradecimiento al final
- [ ] Configuración: Color primario
- [ ] Vista previa del PDF antes de generar

**Tiempo estimado**: 3 horas

---

### 10. 🗑️ Papelera / Soft Delete
**Problema**: Si eliminás algo por error, se pierde para siempre.

**Implementación**:
- [ ] Agregar columna `deleted_at` (nullable) a todas las tablas
- [ ] Al "eliminar", solo setear `deleted_at = NOW()`
- [ ] Filtrar registros borrados en consultas normales
- [ ] Nueva vista "🗑️ Papelera" para recuperar
- [ ] Botón "Restaurar" en papelera
- [ ] Botón "Eliminar definitivamente" después de 30 días

**Tiempo estimado**: 4 horas

---

## 🌟 PRIORIDAD BAJA (Futuro)

### 11. 👥 Roles y Permisos
- [ ] Tabla `usuarios` con `role` (admin, vendedor, readonly)
- [ ] Admin: puede todo
- [ ] Vendedor: crear pedidos, ver clientes
- [ ] ReadOnly: solo consultar
- [ ] Middleware de autorización en backend

**Tiempo estimado**: 6 horas

---

### 12. 🔔 Sistema de Notificaciones
- [ ] Notificaciones en app: "Nuevo pedido", "Stock bajo"
- [ ] Email: enviar PDF al cliente después de generar
- [ ] WhatsApp: integración con API para enviar link de seguimiento
- [ ] Panel de notificaciones no leídas

**Tiempo estimado**: 8 horas

---

### 13. 📱 App Mobile (PWA)
- [ ] Configurar `manifest.json` para PWA
- [ ] Service Worker para funcionar offline
- [ ] Instalar en Android/iOS como app nativa
- [ ] Optimizar para táctil (botones más grandes)
- [ ] Sincronización automática cuando vuelve conexión

**Tiempo estimado**: 6 horas

---

### 14. 🌙 Modo Oscuro
- [ ] Toggle en header "🌙 / ☀️"
- [ ] Crear variables CSS para dark mode
- [ ] Guardar preferencia en localStorage
- [ ] Aplicar automáticamente según OS

**Tiempo estimado**: 2 horas

---

### 15. 🔐 Seguridad Avanzada
- [ ] Rate limiting (evitar ataques brute force)
- [ ] Logs de auditoría (quién hizo qué y cuándo)
- [ ] Backup automático diario de la DB
- [ ] Cifrado de datos sensibles
- [ ] 2FA (autenticación de dos factores)

**Tiempo estimado**: 10 horas

---

### 16. 🚀 Performance
- [ ] Agregar índices a columnas frecuentes (cliente_id, fecha)
- [ ] Caché en Redis para consultas pesadas
- [ ] Lazy loading de imágenes grandes
- [ ] Virtualización de listas largas (react-window)
- [ ] CDN para assets estáticos

**Tiempo estimado**: 8 horas

---

### 17. 🧪 Testing
- [ ] Tests unitarios para funciones críticas
- [ ] Tests de integración para endpoints
- [ ] Tests E2E con Playwright (ya tenés el archivo)
- [ ] CI/CD con GitHub Actions
- [ ] Cobertura mínima 70%

**Tiempo estimado**: 12 horas

---

### 18. 📊 Reportes Avanzados
- [ ] Ventas por barrio (mapa de calor)
- [ ] Análisis de rentabilidad por producto
- [ ] Predicción de demanda (ML básico)
- [ ] Comparativa mes vs mes
- [ ] Export automático semanal por email

**Tiempo estimado**: 10 horas

---

## 🛠️ MEJORAS TÉCNICAS (Deuda Técnica)

### 19. 🏗️ Arquitectura
- [ ] Separar lógica de negocio de endpoints (service layer)
- [ ] Usar TypeScript en backend también
- [ ] Migraciones de DB automáticas con Alembic
- [ ] Variables de entorno en archivo `.env`
- [ ] Docker multi-stage builds más eficientes

**Tiempo estimado**: 8 horas

---

### 20. 📝 Documentación
- [ ] Swagger/OpenAPI para backend
- [ ] README actualizado con screenshots
- [ ] Guía de instalación paso a paso
- [ ] Guía de uso para usuarios finales
- [ ] Video tutorial de 5 minutos

**Tiempo estimado**: 4 horas

---

## 📅 Plan de Implementación Sugerido

### **Semana 1-2**
- Stock/Inventario
- Paginación Clientes
- Exportar Excel

### **Semana 3-4**
- Búsqueda Avanzada
- Editar Pedidos
- Validaciones

### **Mes 2**
- Notificaciones Toast
- Dashboard
- Personalización PDFs
- Papelera

### **Mes 3+**
- Roles
- Notificaciones externas
- PWA
- Performance

---

## 💡 Próximos Pasos Inmediatos

Si tenés **2 horas hoy**, hacé:
1. **Stock** (básico): columna + input + validación simple

Si tenés **1 día**, hacé:
1. Stock completo
2. Paginación clientes
3. Export CSV básico

Si tenés **1 semana**, hacé:
1. Todo lo de "Prioridad Crítica"
2. Búsqueda avanzada
3. Editar pedidos

---

## 🎯 Resumen de Impacto

| Mejora | Impacto Usuario | Complejidad | Prioridad |
|--------|----------------|-------------|-----------|
| Stock | 🔥🔥🔥🔥🔥 | ⭐⭐⭐ | CRÍTICO |
| Paginación | 🔥🔥🔥🔥 | ⭐⭐ | CRÍTICO |
| Export Excel | 🔥🔥🔥🔥 | ⭐⭐ | CRÍTICO |
| Búsqueda | 🔥🔥🔥🔥 | ⭐⭐⭐ | ALTA |
| Editar Pedidos | 🔥🔥🔥 | ⭐⭐⭐ | ALTA |
| Toast | 🔥🔥 | ⭐ | MEDIA |
| Dashboard | 🔥🔥🔥 | ⭐⭐⭐⭐ | MEDIA |
| PWA | 🔥🔥 | ⭐⭐⭐⭐ | BAJA |

---

**Última actualización**: 28/12/2025
