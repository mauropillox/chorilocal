# 🚀 ROADMAP DE MEJORAS - Chorizaurio

> Última actualización: 3 de Enero 2026

---

## 📊 Estado Actual

| Métrica | Valor |
|---------|-------|
| Tests Backend | 37/37 ✅ |
| Tests Frontend | 71/71 ✅ |
| Tests E2E | 31/31 ✅ |
| Performance | 6-11ms |
| Bundle JS | 198KB |
| Bundle CSS | 46KB |

---

## ✅ IMPLEMENTAR AHORA

### 1. 📦 Categorías de Productos
**Estado:** ✅ COMPLETADO  
**Esfuerzo:** Bajo  
**Impacto:** Alto  

- [x] Crear tabla `categorias` en DB
- [x] CRUD de categorías en backend
- [x] Agregar `categoria_id` a productos
- [x] UI para gestionar categorías (Categorias.jsx)
- [x] Filtrar productos por categoría
- [x] 8 categorías por defecto (Carnes, Cerdo, Pollo, Embutidos, Lácteos, Otros, Congelados, Mayorista)

### 2. 📝 Audit Log
**Estado:** ✅ COMPLETADO  
**Esfuerzo:** Bajo  
**Impacto:** Alto  

- [x] Crear tabla `audit_log` (usuario, acción, tabla, registro_id, datos_antes, datos_despues, timestamp, ip_address)
- [x] Función audit_log() para capturar acciones
- [x] Endpoints /admin/audit-logs y /admin/audit-summary
- [x] Filtros por usuario, acción, tabla
- [x] Logging en todas las operaciones de categorías

### 3. ⌨️ Atajos de Teclado
**Estado:** ✅ COMPLETADO  
**Esfuerzo:** Bajo  
**Impacto:** Medio  

- [x] `Ctrl+N` - Nuevo elemento en sección actual
- [x] `Ctrl+K` / `/` - Buscar (focus en búsqueda global)
- [x] `Escape` - Cerrar modales/dialogs
- [x] `Ctrl+1-6` - Navegación rápida entre secciones
- [x] `Ctrl+?` / `F1` - Modal de ayuda de atajos (KeyboardShortcutsModal.jsx)

### 4. 📊 Exportar a Excel (.xlsx)
**Estado:** ✅ COMPLETADO  
**Esfuerzo:** Bajo  
**Impacto:** Medio  

- [x] Instalar `openpyxl` en backend
- [x] Endpoint `/productos/export/xlsx` con formato profesional
- [x] Headers con colores, bordes, anchos de columna
- [x] Incluye categoría de cada producto
- [x] Botón "Excel" junto a CSV en Productos

---

## 🔜 PRÓXIMA FASE

### 5. 💳 Control de Crédito/Deudas
**Estado:** ⏳ Pendiente  
**Esfuerzo:** Medio  
**Impacto:** 🔥 Crítico  

- [ ] Agregar `saldo` a clientes
- [ ] Tabla `movimientos` (pagos, cargos)
- [ ] UI para registrar pagos
- [ ] Alerta de clientes morosos
- [ ] Límite de crédito por cliente
- [ ] Reporte de deudas

### 6. 📊 Dashboard de Ventas (Gráficos)
**Estado:** ⏳ Pendiente  
**Esfuerzo:** Medio  
**Impacto:** Alto  

- [ ] Gráfico de ventas diarias/semanales
- [ ] Top 10 productos más vendidos
- [ ] Top 10 clientes por volumen
- [ ] Comparativa mes actual vs anterior
- [ ] Usar Chart.js o Recharts

### 7. 📅 Pedidos Programados/Recurrentes
**Estado:** ⏳ Pendiente  
**Esfuerzo:** Medio  
**Impacto:** Alto  

- [ ] Tabla `pedidos_programados`
- [ ] Frecuencia: diaria, semanal, mensual
- [ ] Días específicos (L-M-V, etc.)
- [ ] Generación automática de pedidos
- [ ] UI para configurar recurrencia

### 8. 👥 Multi-usuario con Roles
**Estado:** ⏳ Pendiente  
**Esfuerzo:** Medio  
**Impacto:** Alto  

- [ ] Roles: Admin, Vendedor, Repartidor
- [ ] Permisos por rol
- [ ] UI para gestionar usuarios
- [ ] Asociar pedidos a vendedor

---

## 🔮 FUTURO

### 📱 PWA + Modo Offline
- Service Worker para cache
- Sincronización cuando vuelva conexión
- Install prompt en móvil

### 🗺️ Rutas de Entrega
- Organizar pedidos por zona
- Optimización de ruta
- Estado de entrega en tiempo real

### 🏷️ Códigos de Barra/QR
- Escanear para agregar productos
- Generar QR para pedidos

### 📋 Inventario con Lotes
- Control de vencimientos
- Trazabilidad por lote
- Alertas de próximos a vencer

### 🔔 Notificaciones Push
- Stock bajo
- Pedidos nuevos
- Pagos recibidos

---

## 📈 Métricas de Éxito

| Mejora | KPI | Objetivo |
|--------|-----|----------|
| Categorías | Tiempo buscar producto | -50% |
| Audit Log | Incidentes sin resolver | 0 |
| Atajos | Tiempo crear pedido | -30% |
| Excel | Reportes generados/mes | +100% |
| Crédito | Deudas cobradas | +20% |
| Dashboard | Decisiones basadas en datos | +50% |

---

## 🛠️ Notas Técnicas

### Stack Actual
- **Backend:** FastAPI + SQLite
- **Frontend:** React + Vite
- **Deploy:** Render.com
- **DB Prod:** /data/ventas.db (10GB disk)

### Dependencias a Agregar
```
# Backend
openpyxl>=3.1.0  # Excel export

# Frontend (ya incluidos)
# Chart.js o Recharts para gráficos
```

---

*Documento generado automáticamente - Actualizar conforme se implementen mejoras*
