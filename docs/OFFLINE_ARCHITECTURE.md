# 🌐 Arquitectura Offline-First

## ¿Cómo funciona?

La aplicación ahora soporta **offline-first**, lo que significa que puede seguir funcionando (parcialmente) sin conexión a internet.

## Componentes

### 1. Service Worker (`/public/service-worker.js`)
- **Cachea automáticamente** todas las peticiones GET (HTML, CSS, JS, imágenes)
- Cuando estás online: descarga y guarda en caché
- Cuando estás offline: sirve desde la caché

**¿Qué pasa cuando cae internet?**
- ✅ La interfaz sigue funcionando (HTML/CSS/JS cargados)
- ✅ Puedes navegar entre páginas
- ✅ Ver datos previamente cargados (clientes, productos, pedidos)

### 2. IndexedDB Queue (`/src/offline/sync.js`)
- **Cola de peticiones pendientes** para mutaciones (POST, PUT, DELETE)
- Almacena requests que fallan por falta de conexión
- Las reintenta automáticamente cuando vuelve internet

**¿Qué pasa cuando haces un cambio offline?**
1. La petición falla (sin internet)
2. Se guarda en IndexedDB con timestamp y datos
3. UI muestra notificación: "Sin conexión - cambios guardados"
4. Cuando vuelve internet: se reenvían automáticamente
5. UI actualiza: "Cambios sincronizados"

### 3. AuthFetch Wrapper (`/src/authFetch.js`)
- Detecta cuando una petición falla por falta de red
- Automáticamente encola mutaciones (POST/PUT/DELETE/PATCH)
- Las peticiones GET fallan silenciosamente (Service Worker las cachea)

### 4. UI Components
- **OfflineNotifier**: Banner rojo "Sin conexión a internet"
- **OfflineQueue**: Panel que muestra requests pendientes de sincronizar

## Flujos de Usuario

### Escenario 1: Internet cae mientras trabajas
1. Usuario edita un cliente → POST `/api/clientes`
2. Request falla (ERR_INTERNET_DISCONNECTED)
3. authFetch detecta: "sin red, es mutación" → encola en IndexedDB
4. UI muestra: "⚠️ Sin conexión - Cambios guardados localmente"
5. Usuario sigue trabajando, viendo datos cacheados
6. Internet vuelve → `navigator.onLine === true`
7. `processQueue()` se ejecuta automáticamente
8. Requests pendientes se reenvían → Success
9. UI muestra: "✅ 3 cambios sincronizados"

### Escenario 2: Navegación offline
1. Usuario visita `/dashboard` sin internet
2. Service Worker intercepta GET `/dashboard`
3. Sirve desde caché (versión anterior)
4. Usuario puede ver métricas, clientes, productos (cached)
5. **No puede crear/editar** (botones disabled? o fallan y encolan)

### Escenario 3: Crear pedido offline
1. Usuario crea pedido → POST `/api/pedidos`
2. authFetch encola: `{ method: 'POST', url: '/api/pedidos', body: {...} }`
3. UI optimista: muestra pedido en lista (con badge "Pendiente")
4. Cuando sincroniza: actualiza con ID real del servidor

## Limitaciones

| Acción | Funciona Offline | Notas |
|--------|------------------|-------|
| Ver dashboard | ✅ | Datos cached |
| Ver lista de clientes | ✅ | Cached |
| Ver detalles de producto | ✅ | Cached |
| **Crear cliente** | ⚠️ | Se encola, sincroniza después |
| **Editar pedido** | ⚠️ | Se encola |
| **Eliminar producto** | ⚠️ | Se encola |
| Login | ❌ | Requiere servidor |
| Exportar PDF | ❌ | Backend genera PDF |

## Storage

**Service Worker Cache:**
- Límite: ~50-100MB (depende del navegador)
- Contenido: HTML, CSS, JS, imágenes
- Política: Cache-first para assets estáticos

**IndexedDB Queue:**
- Límite: ~50MB-1GB (depende del navegador)
- Contenido: Peticiones pendientes
- Cleanup: Se borran después de sincronizar

## Debugging

### Ver caché del Service Worker
```javascript
// En DevTools Console
caches.keys().then(console.log)
caches.open('chorizaurio-v1').then(cache => cache.keys()).then(console.log)
```

### Ver cola de IndexedDB
```javascript
// En DevTools Console
import { getAll } from './offline/sync.js'
getAll().then(console.log)
```

### Forzar sincronización
```javascript
import { processQueue } from './offline/sync.js'
processQueue()
```

### Simular offline
1. DevTools → Network tab
2. Throttling dropdown → "Offline"
3. Intentar crear cliente → debe encolarse
4. Volver a "Online" → debe sincronizarse automáticamente

## Eventos

**Eventos que disparan sincronización:**
- `window.addEventListener('online')` → Detecta que volvió internet
- Cada petición exitosa dispara `processQueue()` para limpiar la cola

**Eventos offline:**
- `window.addEventListener('offline')` → Muestra banner "Sin conexión"

## Futuras Mejoras

- [ ] Conflicto de resolución (si servidor cambió datos)
- [ ] Retry con backoff exponencial
- [ ] Prioridad de requests (login > crear > editar > eliminar)
- [ ] Background sync API (sincroniza aunque cierres la pestaña)
- [ ] Notificaciones push cuando sincroniza
