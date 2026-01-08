# Guía de Despliegue a Producción

## Resumen de Cambios Recientes

### Workflow de Estados Simplificado
- **Estados válidos**: `pendiente` → `preparando` → `entregado` (o `cancelado`)
- Eliminados estados obsoletos: `tomado`, `listo`
- Se mantienen las transiciones automáticas y manuales

### Soporte PostgreSQL
- El backend ahora soporta tanto SQLite como PostgreSQL
- PostgreSQL recomendado para producción
- SQLite para desarrollo y testing

## Requisitos Previos

### Variables de Entorno
```bash
# Producción con PostgreSQL
USE_POSTGRES=true
DATABASE_URL=postgresql://user:password@host:5432/chorizaurio_db
SECRET_KEY=tu-clave-secreta-muy-segura
CORS_ORIGINS=https://tudominio.com
SENTRY_DSN=tu-dsn-de-sentry  # opcional
```

## Pasos de Despliegue

### 1. Preparar PostgreSQL

```bash
# Crear base de datos
createdb chorizaurio_db

# O en el servidor PostgreSQL:
CREATE DATABASE chorizaurio_db;
```

### 2. Migrar Datos de SQLite a PostgreSQL

```bash
# Configurar conexión
export DATABASE_URL='postgresql://user:password@host:5432/chorizaurio_db'
export SQLITE_DB_PATH='./data/ventas.db'

# Ejecutar migración
./scripts/migrate_to_postgres.sh
```

### 3. Despliegue con Docker Compose

```bash
# Copiar template de variables
cp .env.production.template .env

# Editar variables con valores reales
nano .env

# Desplegar
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verificar Despliegue

```bash
# Health check
curl https://tudominio.com/api/health

# Verificar logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Estructura de Archivos de Producción

```
docker-compose.prod.yml   # Compose con PostgreSQL
.env.production.template  # Template de variables
scripts/migrate_to_postgres.sh  # Script de migración
```

## Rollback

Si necesitas volver a SQLite:

```bash
# En .env
USE_POSTGRES=false
# Eliminar DATABASE_URL

# Reiniciar
docker-compose -f docker-compose.prod.yml restart backend
```

## Tests

### Backend (48 tests)
```bash
cd backend && pytest tests/ -v
```

### Frontend (8 tests)
```bash
cd frontend && npm test
```

## Monitoreo

- **Sentry**: Configurar `SENTRY_DSN` para tracking de errores
- **Health endpoint**: `/health` devuelve estado de la base de datos
- **Logs**: Docker logs o archivo de logs configurable

## Contacto

Para problemas con el despliegue, revisar:
1. Logs del backend: `docker logs chorizaurio-backend`
2. Conexión a PostgreSQL: verificar `DATABASE_URL`
3. Variables de entorno: verificar que todas estén configuradas
