# 🚀 PRE-PRODUCTION REVIEW TODO

**Fecha:** 7 de Enero 2026  
**Estado:** GO ✅ (con fixes pendientes)

---

## MUST-FIX ANTES DE PRODUCCIÓN (5 items)

| # | Severidad | Archivo | Problema | Fix |
|---|-----------|---------|----------|-----|
| 1 | 🔴 CRÍTICO | `backups/` | **Backups de BD trackeados en git** - 4 archivos `.bak` con datos de usuarios | `git rm --cached backups/*.bak data/ventas.db.bak` + asegurar que backups/ esté en .gitignore |
| 2 | 🔴 ALTO | `docker-compose.yml` | Sin override de CORS_ORIGINS para producción - defaults pueden ser muy permisivos | Agregar `CORS_ORIGINS=https://pedidosfriosur.com,https://www.pedidosfriosur.com` al env de prod |
| 3 | 🟠 ALTO | `backend/db.py` | `print()` en código de producción (`verificar_tablas...`, `seed_ofertas...`) | Reemplazar con `logger.info()` o eliminar |
| 4 | 🟠 ALTO | `frontend/public/service-worker.js` | SW básico cachea TODAS las respuestas same-origin incluyendo API | Agregar bypass de cache para endpoints `/api/*` o `/pedidos/*` |
| 5 | 🟠 MEDIO | `frontend/src/components/Ofertas.jsx` | Verificar sintaxis JSX después de edición reciente | Correr build de frontend para confirmar sin errores |

---

## SHOULD-FIX PRONTO (10 items)

| # | Severidad | Archivo | Problema | Sugerencia |
|---|-----------|---------|----------|------------|
| 1 | 🟡 | `backend/main.py` | `get_admin_user` permite "admin" y "administrador" | Normalizar a un solo nombre de rol |
| 2 | 🟡 | `frontend/src/authFetch.js` | Cola offline no incluye token auth para requests encolados | Guardar token con request o refrescar en sync |
| 3 | 🟡 | `frontend/src/components/Pedidos.jsx` | Check de stock antes de guardar no lockea - posible race condition | Usar endpoint `verificar-stock` del backend primero |
| 4 | 🟡 | `frontend/src/components/HistorialPedidos.jsx` | Undo delete recrea pedido sin ID original - puede causar problemas | Considerar soft-delete |
| 5 | 🟡 | `backend/requirements.txt` | Warning de deprecación de `crypt` en passlib (remoción en Python 3.13) | Actualizar passlib o pinear bcrypt explícitamente |
| 6 | 🟡 | `docker-compose.yml` | Healthcheck de backend usa Python urllib (lento) | Cambiar a `curl -f http://localhost:8000/health` |
| 7 | 🟡 | `backend/Dockerfile` | Sin usuario non-root | Agregar `USER app` por seguridad |
| 8 | 🟡 | `frontend/src/components/Login.jsx` | Sin protección CSRF en form de login | Considerar cookies SameSite para tokens |
| 9 | 🟡 | `frontend/src/LayoutApp.jsx` | Búsqueda global fetchea TODOS los clientes/productos | Agregar endpoint de búsqueda server-side |
| 10 | 🟡 | `frontend/nginx.conf` | CSP permite `'unsafe-inline'` para scripts | Considerar CSP basado en nonce cuando sea posible |

---

## NICE-TO-HAVE

- [ ] Agregar tests E2E con Playwright para flujos críticos
- [ ] Implementar paginación server-side para listas grandes de productos (479 items)
- [ ] Agregar tracking de request ID para debugging
- [ ] Considerar Redis para rate limiting en producción (slowapi es in-memory)
- [ ] Agregar PWA manifest para app instalable
- [ ] Implementar versionado de cache apropiado en service worker

---

## BUGS REPORTADOS POR CLIENTE

### 🐛 BUG 1: Error al subir imagen (algunos usuarios)
- **Estado:** ✅ ARREGLADO
- **Síntoma:** Cliente no puede subir imagen, aunque funciona para otros
- **Causa raíz:** La función `actualizarImagenProducto` hacía PUT con todo el producto. Si el producto tenía precio=$0, fallaba porque la validación de Pydantic requería `precio > 0`.
- **Fix aplicado:**
  1. Cambié validación de `gt=0` a `ge=0` en `backend/main.py` para permitir precios de $0
  2. Agregué manejo de error con toast en `actualizarImagenProducto`

### 🐛 BUG 2: Error al asignar categoría
- **Estado:** ✅ ARREGLADO
- **Síntoma:** Toast rojo "Error al actualizar categoría" al intentar asignar categoría a producto
- **Producto afectado:** SALAME PICADO FINO 2 CARLITOS (precio $0)
- **Causa raíz:** La función `actualizarCategoriaProducto` hacía PUT general con `...producto` que incluía precio=$0, y la validación de Pydantic lo rechazaba porque requería `precio > 0`.
- **Fix aplicado:**
  1. Cambié el frontend para usar endpoint específico `PUT /productos/{id}/categoria` en lugar de PUT general
  2. Cambié validación de precio de `gt=0` a `ge=0` en backend

---

## QA RUNBOOK

### Smoke Test (10 min)
```bash
# 1. Health checks
curl http://localhost:8000/health
curl http://localhost:80/health

# 2. Login test
curl -X POST http://localhost:8000/login \
  -d "username=admin&password=admin420"

# 3. CRUD básico (con token)
TOKEN="<from login>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/clientes
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/productos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/pedidos
```

### Test de Roles
| Acción | Admin | Oficina | Ventas |
|--------|-------|---------|--------|
| Ver todos los pedidos | ✅ | ✅ | ❌ (solo propios) |
| Crear pedido | ✅ | ✅ | ✅ |
| Eliminar pedido | ✅ | ❌ | ❌ |
| Ver ofertas | ✅ | ✅ | ✅ (solo lectura) |
| Editar ofertas | ✅ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ |

### Test de PDF
1. Crear 3+ pedidos con diferentes clientes
2. Seleccionar múltiples pedidos en Historial
3. Click "Generar PDF"
4. Verificar que PDF abre con datos correctos
5. Confirmar que stock fue descontado
6. Verificar que pedidos pasaron a tab "Generados"

### Test Offline
1. Crear pedido online → éxito
2. Cambiar browser a modo offline
3. Crear otro pedido → debe mostrar toast "Encolado"
4. Volver a online
5. Verificar que pedido encolado se sincronizó

---

## COMANDOS PARA EJECUTAR

```bash
# 1. Lint frontend
cd frontend && npm run lint

# 2. Tests backend
cd backend && source .venv/bin/activate && pytest tests/ -v

# 3. Build frontend (detecta errores JSX)
cd frontend && npm run build

# 4. Scan de seguridad
cd /home/mauro/dev/chorizaurio && ./scripts/quick-secret-scan.sh

# 5. Remover archivos de backup trackeados
git rm --cached backups/*.bak data/ventas.db.bak
git commit -m "security: remove database backups from tracking"

# 6. Test completo de docker build
docker compose build --no-cache
```

---

## RESUMEN

El sistema está **listo para producción** con algunas correcciones de higiene. El MUST-FIX #1 crítico (archivos de backup en git) debe ser resuelto inmediatamente ya que puede contener PII. El resto son mejoras de calidad que pueden hacerse en la primera semana post-lanzamiento.
