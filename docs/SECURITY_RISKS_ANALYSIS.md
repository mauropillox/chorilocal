# 🔒 Análisis de Riesgos de Seguridad y Estabilidad

**Fecha:** 2026-01-08  
**Sistema:** Chorizaurio - Sistema de Gestión de Pedidos

---

## ✅ **RIESGO CRÍTICO RESUELTO**

### 1. Auto-Restore de Backup en Cada Reinicio ⚠️ **[FIXED]**
- **Ubicación:** `backend/db.py` línea 38-113
- **Riesgo:** La función `_init_sqlite_from_base64()` comparaba fechas y restauraba backup automáticamente
- **Impacto:** Pérdida de datos en producción (usuarios, pedidos, cambios recientes)
- **Estado:** ✅ **RESUELTO** (commit 87de7ba)
- **Solución:** Solo restaura si DB no existe o `FORCE_DB_RECREATE=true`

---

## ⚠️ **RIESGOS ACTUALES - ALTA PRIORIDAD**

### 2. Migraciones Automáticas en Startup Sin Control
**Ubicación:** `backend/main.py` línea 257-280

**Problema:**
```python
@app.on_event("startup")
async def startup_event():
    # Estas migraciones se ejecutan EN CADA REINICIO
    cursor.execute("UPDATE usuarios SET activo = 1 WHERE activo = 0 OR activo IS NULL")
    cursor.execute("UPDATE usuarios SET rol = 'vendedor' WHERE rol = 'usuario'")
```

**Riesgos:**
- ❌ Si un admin **desactiva** un usuario, al reiniciar se **reactiva automáticamente**
- ❌ No hay forma de detener estas migraciones una vez ejecutadas
- ❌ No hay registro de cuándo/cuántas veces se ejecutaron

**Impacto:** 🔴 ALTO - Puede reactivar usuarios deshabilitados por seguridad

**Recomendación:**
```python
# Crear tabla de migraciones ejecutadas
# Solo ejecutar si no está en la tabla
# Ejemplo:
cursor.execute("SELECT * FROM migration_log WHERE name='activate_users'")
if not cursor.fetchone():
    cursor.execute("UPDATE usuarios SET activo = 1 WHERE activo = 0")
    cursor.execute("INSERT INTO migration_log (name, executed_at) VALUES ('activate_users', ?)", (datetime.now(),))
```

---

### 3. Eliminación en Cascada (CASCADE) Sin Confirmación
**Ubicación:** Múltiples routers con `ON DELETE CASCADE`

**Ejemplos:**
- `routers/tags.py` línea 47-48: Eliminar tag borra TODOS los productos asociados
- `routers/templates.py` línea 155: Eliminar template borra items relacionados

**Problema:**
```sql
-- Si eliminas un tag, se borran TODAS las relaciones productos-tags
CREATE TABLE productos_tags (
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
)
```

**Riesgos:**
- ❌ Eliminar un tag borra todas las asociaciones sin advertencia
- ❌ No hay soft-delete (papelera de reciclaje)
- ❌ No se verifica si hay datos relacionados antes de eliminar

**Impacto:** 🟡 MEDIO - Pérdida accidental de datos relacionados

**Recomendación:**
- Implementar soft-delete (campo `deleted_at`)
- Verificar dependencias antes de eliminar
- Mostrar confirmación en frontend con conteo de items afectados

---

### 4. Sin Backups Automáticos en Producción
**Ubicación:** `backend/backup.py` y `scripts/backup_cron.sh`

**Problema:**
- ✅ Existe script de backup (`backup.py`)
- ❌ NO está configurado en Render (no hay cron jobs)
- ❌ Dockerfile.cron existe pero no se usa

**Riesgos:**
- ❌ Si se corrompe la BD, no hay backup reciente
- ❌ Si hay error humano (DELETE accidental), no se puede recuperar
- ❌ El archivo `/etc/secrets/ventas.db.b64` es el único backup (estático)

**Impacto:** 🔴 ALTO - Sin backups, riesgo de pérdida total de datos

**Recomendación:**
```bash
# Configurar Render Cron Job (desde Render Dashboard)
# O usar servicio externo como Render Background Workers
# Ejecutar backup cada 6 horas:
# 0 */6 * * * cd /app && python backend/backup.py
```

---

### 5. Sin Validación de Integridad Referencial
**Ubicación:** `backend/db.py` - funciones delete_*

**Problema:**
```python
def delete_producto(producto_id: int):
    # No verifica si el producto está en pedidos activos
    cursor.execute("DELETE FROM productos WHERE id = ?", (producto_id,))
```

**Riesgos:**
- ❌ Puedes eliminar un producto que está en pedidos pendientes
- ❌ Puedes eliminar un cliente que tiene pedidos históricos
- ❌ Se pierden referencias históricas

**Impacto:** 🟡 MEDIO - Inconsistencia de datos

**Recomendación:**
```python
def delete_producto(producto_id: int):
    # Verificar si está en pedidos
    cursor.execute("""
        SELECT COUNT(*) FROM detalles_pedido 
        WHERE producto_id = ? AND pedido_id IN 
        (SELECT id FROM pedidos WHERE estado != 'completado')
    """, (producto_id,))
    
    if cursor.fetchone()[0] > 0:
        raise HTTPException(400, "No se puede eliminar: producto en pedidos activos")
```

---

### 6. Token JWT Sin Rotación
**Ubicación:** `backend/deps.py`

**Problema:**
- ✅ Tokens tienen expiración (30 min default)
- ❌ No hay rotación automática (refresh tokens)
- ❌ Si roban un token, es válido hasta que expire

**Riesgos:**
- ❌ Token robado puede usarse durante 30 minutos
- ❌ Usuario debe re-loguearse cada 30 min (mala UX)

**Impacto:** 🟡 MEDIO - Riesgo de seguridad moderado

**Recomendación:**
- Implementar refresh tokens (vida larga)
- Access token de corta duración (5-15 min)
- Endpoint `/refresh` para renovar tokens

---

### 7. Base de Datos SQLite en Producción
**Ubicación:** `backend/db.py` y `main.py`

**Problema:**
- SQLite no soporta múltiples escrituras concurrentes
- Render puede reiniciar contenedores (filesystem efímero sin persistent disk)
- Sin replicación ni alta disponibilidad

**Riesgos:**
- ❌ "Database is locked" errors con múltiples usuarios
- ❌ Si el contenedor se reinicia sin volume, se pierde todo
- ❌ No hay redundancia

**Impacto:** 🔴 ALTO - Riesgo de pérdida de datos y performance

**Recomendación:**
```yaml
# Migrar a PostgreSQL (ya configurado en docker-compose.prod.yml)
# Render ofrece PostgreSQL managed con backups automáticos
# Configurar: USE_POSTGRES=true y DATABASE_URL en Render
```

---

### 8. Variables de Entorno Sin Validación
**Ubicación:** `backend/main.py` y múltiples archivos

**Problema:**
```python
DB_PATH = os.getenv("DB_PATH", "/data/ventas.db")  # Default sin validar
SECRET_KEY = os.getenv("SECRET_KEY", "a_random_secret_key")  # Fallback inseguro
```

**Riesgos:**
- ❌ Si olvidas setear `SECRET_KEY` en producción, usa default débil
- ❌ Sin validación, errores de config pasan desapercibidos

**Impacto:** 🟡 MEDIO - Configuración incorrecta en producción

**Recomendación:**
```python
# En startup, validar variables críticas
if ENVIRONMENT == "production":
    required_vars = ["SECRET_KEY", "DB_PATH"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {missing}")
    
    # Validar que SECRET_KEY no sea default
    if SECRET_KEY == "a_random_secret_key":
        raise RuntimeError("SECRET_KEY must be changed in production")
```

---

### 9. Sin Rate Limiting en Endpoints Críticos
**Ubicación:** Algunos endpoints sin `@limiter.limit()`

**Problema:**
- ✅ Login tiene rate limiting
- ❌ Endpoints de creación (pedidos, productos) sin límite
- ❌ Posible abuso/spam

**Impacto:** 🟡 MEDIO - Riesgo de abuso

**Recomendación:**
- Aplicar rate limiting a todos los endpoints POST/PUT/DELETE
- Diferentes límites por rol (admin = más permisivo)

---

### 10. Logs Sin Rotación
**Ubicación:** `backend/logging_config.py`

**Problema:**
- Logs en stdout (Render los guarda)
- Sin rotación local si se corre en Docker
- Pueden llenar disco

**Impacto:** 🟢 BAJO - Solo en deployments locales

**Recomendación:**
- Configurar logrotate en Docker local
- Render maneja rotación automáticamente

---

## 📋 **PLAN DE ACCIÓN RECOMENDADO**

### Prioridad 1 (Inmediato)
1. ✅ **[DONE]** Desactivar auto-restore de backup
2. ⏳ **Implementar sistema de migraciones con control** (migration_log table)
3. ⏳ **Configurar backups automáticos en Render**
4. ⏳ **Migrar a PostgreSQL** (ya configurado, solo activar)

### Prioridad 2 (Esta semana)
5. ⏳ Implementar validaciones de integridad referencial
6. ⏳ Agregar soft-delete en entities críticas
7. ⏳ Validar variables de entorno en startup

### Prioridad 3 (Próximas 2 semanas)
8. ⏳ Implementar refresh tokens
9. ⏳ Rate limiting completo
10. ⏳ Mejorar logging y monitoreo

---

## 🎯 **MÉTRICAS DE MEJORA**

| Área | Antes | Después (propuesto) |
|------|-------|---------------------|
| Auto-restore risk | 🔴 100% | ✅ 0% |
| Backup frequency | 🔴 Manual | ✅ Cada 6h |
| DB reliability | 🟡 SQLite | ✅ PostgreSQL |
| Migration control | 🔴 Ninguno | ✅ Version tracking |
| Data validation | 🟡 Básica | ✅ Completa |

---

**Documentado por:** GitHub Copilot (Claude Sonnet 4.5)  
**Revisión:** Pendiente aprobación del equipo
