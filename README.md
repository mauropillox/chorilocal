# Chorizaurio - Sistema de Gestión de Pedidos 🛒

Sistema completo de gestión de pedidos con inventario, reportes, y administración de clientes/productos.

---

## 🎯 Stack Tecnológico

### Frontend
- **React 18** + **Vite 6** - Build y desarrollo rápido
- **React Query v5.90** - Estado del servidor, cache, sincronización
- **Zustand 4.5** - Estado local (auth, carrito)
- **React Toastify** - Notificaciones toast (success/error/warn/info)
- **Tailwind CSS 4** - Estilos utility-first
- **Zod 4.3.5** - Validación de esquemas (actualmente deshabilitado)

### Backend
- **FastAPI 0.115** - API REST con documentación automática
- **SQLite** - Base de datos (preparado para PostgreSQL migration)
- **Pydantic 2.11** - Validación de modelos
- **Python-JOSE** - JWT para autenticación
- **ReportLab + OpenPyXL** - Generación de PDFs/Excel
- **Sentry** - Monitoreo de errores
- **SlowAPI** - Rate limiting

### Testing
- **Pytest** (Backend) - 10 test files, ~1971 líneas
- **Playwright** (E2E) - 19 test files
- **Vitest** (Frontend) - Configurado (sin tests actualmente)

### DevOps
- **Docker** + **Docker Compose** - Containerización
- **Render** - Deployment en producción

---

## 📂 Estructura del Proyecto

```
chorizaurio/
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── components/   # Componentes reutilizables
│   │   ├── pages/        # Páginas principales
│   │   ├── hooks/        # Custom hooks
│   │   ├── utils/        # Utilidades (API client, auth)
│   │   └── schemas/      # Zod schemas (deshabilitados)
│   ├── Dockerfile
│   └── package.json
│
├── backend/              # FastAPI
│   ├── routers/          # 21 routers modulares
│   │   ├── auth.py      # Login, register, JWT
│   │   ├── pedidos.py   # CRUD pedidos, estados, bulk delete
│   │   ├── productos.py # CRUD productos, stock
│   │   ├── clientes.py  # CRUD clientes
│   │   ├── reportes.py  # 6 reportes (ventas, inventario, clientes, etc)
│   │   ├── dashboard.py # Métricas, alertas
│   │   ├── admin.py     # Backups, migrations, delete impact
│   │   └── ...          # templates, ofertas, tags, listas_precios, etc
│   ├── tests/           # Pytest tests (10 archivos)
│   ├── models.py        # Pydantic models
│   ├── db.py            # Database layer
│   ├── deps.py          # Dependency injection (auth, rate limiting)
│   ├── main.py          # FastAPI app initialization
│   ├── Dockerfile
│   └── requirements.txt
│
├── docs/                # Documentación técnica
│   ├── COMPREHENSIVE_TEST_REPORT_2026-01-10.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── SECURITY_AUDIT_10_10.md
│   └── ...              # 50+ docs de arquitectura/auditorías
│
├── e2e/                 # Playwright E2E tests
├── data/                # SQLite database + uploads
├── backups/             # Database backups automáticos
├── docker-compose.yml
└── render.yaml          # Render deployment config
```

---

## 🚀 Quick Start

### 1. **Backend Setup**

```bash
cd backend

# Crear virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Inicializar database (si no existe)
python3 main.py  # Se crea ventas.db automáticamente

# Correr servidor
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend disponible en: `http://localhost:8000`
- API Docs (Swagger): `http://localhost:8000/docs`
- Alternative docs (ReDoc): `http://localhost:8000/redoc`

### 2. **Frontend Setup**

```bash
cd frontend

# Instalar dependencias
npm install

# Correr dev server
npm run dev
```

Frontend disponible en: `http://localhost:5173`

### 3. **Login Inicial**

**Default Admin:**
- Username: `admin`
- Password: set via `ADMIN_PASSWORD` in your `.env` file

---

## 🔑 Autenticación & Roles

### Roles Disponibles
- **admin/administrador** - Acceso total (CRUD, reportes, backups, usuarios)
- **vendedor/oficina** - Crear/editar pedidos, ver reportes
- **repartidor** - Solo ver pedidos asignados

### JWT Token
- **Access token:** Expira en 30 días
- **Refresh token:** Permite renovar sin re-login
- **Headers:** `Authorization: Bearer <token>`

### Endpoints de Auth
```
POST /login        → Obtener token
POST /register     → Crear usuario (solo admin)
POST /logout       → Invalidar token
POST /refresh      → Renovar token
GET  /users/me     → Info del usuario actual
GET  /users        → Listar usuarios (admin)
```

---

## 📊 Funcionalidades Principales

### 🛒 Pedidos
- Crear/editar/eliminar pedidos
- Estados: Pendiente → En Preparación → Listo → Entregado → Cancelado
- Bulk delete (hasta 100 pedidos)
- Exportar a CSV
- Generar PDF masivo (hojas de ruta)
- Preview de impacto en stock antes de confirmar
- Historial completo con filtros (cliente, estado, fecha, creador)

### 📦 Productos
- CRUD completo
- Stock management (delta updates para concurrencia)
- Categorías, tags, imágenes
- Stock mínimo con alertas
- Tipos: "unidad" o "kilo"

### 👥 Clientes
- CRUD completo
- Zona geográfica para rutas
- Historial de pedidos por cliente

### 📈 Reportes (6 tipos)
1. **Ventas** - Ingresos por período, ranking productos
2. **Inventario** - Stock actual, valoración, alertas
3. **Clientes** - Frecuencia, ticket promedio, top clientes
4. **Productos** - Más vendidos, menos vendidos
5. **Rendimiento** - Comparativo por período
6. **Comparativo** - Tendencias mes/año

### 💰 Listas de Precios & Ofertas

#### Listas de Precios
- Múltiples listas de precios por cliente
- Precios personalizados por producto/cliente
- Gestión vía API `/api/listas-precios`

#### Sistema de Ofertas (4 Tipos)

**1. Porcentaje** - Descuento porcentual
```json
{
  "tipo": "porcentaje",
  "descuento_porcentaje": 15.0,
  "titulo": "15% OFF en todo"
}
```

**2. Precio por Cantidad** - Precios escalonados
```json
{
  "tipo": "precio_cantidad",
  "reglas": [
    {"cantidad": 1, "precio": 100},
    {"cantidad": 5, "precio": 90},
    {"cantidad": 10, "precio": 80}
  ]
}
```

**3. NxM** - Compra N, paga M
```json
{
  "tipo": "nxm",
  "compra_cantidad": 3,
  "paga_cantidad": 2
}
```

**4. Regalo** - Producto gratis con compra
```json
{
  "tipo": "regalo",
  "regalo_producto_id": 123,
  "regalo_cantidad": 1
}
```

**Endpoints:**
- `GET /api/ofertas` - Listar (admin: todas, users: activas)
- `GET /api/ofertas/activas` - Públicas (sin auth)
- `POST /api/ofertas` - Crear (admin only)
- `PUT /api/ofertas/{id}` - Actualizar (admin only)
- `DELETE /api/ofertas/{id}` - Eliminar (admin only)

**Validación:**
- Porcentaje: 0-100%
- NxM: compra ≥ 2, paga < compra
- Fechas: desde < hasta
- Regalo: producto_id debe existir

Ver: [docs/OFERTAS_TESTING_REPORT.md](docs/OFERTAS_TESTING_REPORT.md)

### 🔧 Admin
- Backups automáticos diarios (SQLite → backup folder)
- Migrations management
- Delete impact preview (relaciones antes de eliminar)
- System info (disk, memory, uptime)

---

## 🧪 Testing

### Backend Tests (Pytest)

```bash
cd backend

# Instalar pytest si no está
pip install pytest pytest-asyncio httpx pytest-mock

# Correr todos los tests
python3 -m pytest tests/ -v

# Tests específicos
python3 -m pytest tests/test_auth.py -v
python3 -m pytest tests/test_crud.py -v

# Con coverage
python3 -m pytest tests/ --cov=. --cov-report=html
```

**Test Files (10 files):**
- `test_auth.py` - Login, register, JWT
- `test_crud.py` - CRUD operations
- `test_pedidos.py` - Pedidos workflow
- `test_estados_workflow.py` - Estado transitions
- `test_reportes_comprehensive.py` - Report generation
- `test_bulk_delete.py` - Bulk operations
- `test_database.py` - DB operations
- `test_comprehensive_e2e.py` - End-to-end flows
- `test_toast_e2e.py` - Toast notifications E2E
- `conftest.py` - Fixtures (temp_db, client)

### E2E Tests (Playwright)

```bash
# Instalar Playwright
npm install

# Correr E2E tests LOCALES
npm run test:e2e

# Correr tests de PRODUCCIÓN (read-only)
npm run test:e2e:prod

# Con UI (local)
npm run test:e2e:ui

# Con UI (producción)
npm run test:e2e:prod:ui

# Headed mode (ver browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Ver reporte de tests de producción
npm run test:e2e:prod:report
```

**E2E Files (19+ files):**
- auth.spec.ts - Login, logout, permisos
- crud.spec.ts - CRUD operations UI
- offline.spec.ts - Offline behavior
- navigation.spec.ts - Rutas y navegación
- performance.spec.ts - Performance benchmarks
- reports.spec.ts - Generación reportes
- toasts.spec.ts - Toast notifications
- **production.spec.ts** - **PRODUCTION smoke tests (read-only)**

**Production Testing:**
Los tests de producción son **seguros** y **read-only**:
- ✅ Verifican que el sitio carga correctamente
- ✅ Validan navegación entre páginas
- ✅ Comprueban que no hay errores JavaScript
- ✅ Miden performance y bundle size
- ❌ **NO modifican datos** (solo lectura)
- ❌ **NO crean/editan/eliminan** entidades

**Configuración para tests de producción:**
```bash
# 1. Set environment variables
export PROD_TEST_USER="test@example.com"
export PROD_TEST_PASSWORD="secure_password"

# 2. Run production tests
npm run test:e2e:prod
```

⚠️ **IMPORTANTE**: Necesitas crear un usuario de test en producción con permisos de **solo lectura** antes de correr los tests.

---

## 🐳 Docker

### Development

```bash
docker-compose -f docker-compose.local.yml up --build
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Servicios:**
- `frontend` - React app (port 3000)
- `backend` - FastAPI (port 8000)

---

## 📡 API Endpoints

### Auth
- `POST /login` - Login
- `POST /register` - Register (admin)
- `POST /logout` - Logout
- `GET /users/me` - Current user
- `GET /users` - List users (admin)

### Pedidos
- `GET /pedidos` - List (filters: estado, cliente_id, fecha_desde/hasta)
- `POST /pedidos` - Create
- `GET /pedidos/{id}` - Get one with items
- `PUT /pedidos/{id}` - Update
- `DELETE /pedidos/{id}` - Delete
- `PATCH /pedidos/{id}/estado` - Update estado
- `POST /pedidos/bulk-delete` - Bulk delete (max 100)
- `POST /pedidos/generar_pdfs` - Generate PDFs
- `POST /pedidos/preview_stock` - Preview stock impact
- `GET /pedidos/export/csv` - Export CSV

### Productos
- `GET /productos` - List
- `POST /productos` - Create
- `GET /productos/{id}` - Get one
- `PUT /productos/{id}` - Update
- `DELETE /productos/{id}` - Delete
- `PATCH /productos/{id}/stock` - Update stock (delta or absolute)

### Clientes
- `GET /clientes` - List
- `POST /clientes` - Create
- `GET /clientes/{id}` - Get one
- `PUT /clientes/{id}` - Update
- `DELETE /clientes/{id}` - Delete

### Reportes
- `GET /reportes/ventas?fecha_desde=X&fecha_hasta=Y`
- `GET /reportes/inventario`
- `GET /reportes/clientes?fecha_desde=X&fecha_hasta=Y`
- `GET /reportes/productos?fecha_desde=X&fecha_hasta=Y`
- `GET /reportes/rendimiento?fecha_desde=X&fecha_hasta=Y`
- `GET /reportes/comparativo?periodo=mes|año`

### Dashboard
- `GET /dashboard/metrics` - Métricas generales
- `GET /dashboard/pedidos_por_dia` - Chart data
- `GET /dashboard/alertas` - Stock bajo, pedidos antiguos

### Admin
- `POST /admin/backup-now` - Crear backup manual
- `GET /admin/backups` - List backups
- `GET /admin/backups/{filename}` - Download backup
- `GET /admin/system-info` - System info
- `GET /admin/delete-impact/producto/{id}` - Preview delete impact
- `GET /admin/delete-impact/cliente/{id}`
- `GET /admin/delete-impact/categoria/{id}`

Ver documentación completa en: `http://localhost:8000/docs`

---

## 🔒 Seguridad

### Implementado
✅ JWT authentication con refresh tokens
✅ Password hashing (bcrypt)
✅ Rate limiting (SlowAPI)
✅ CORS configurado
✅ SQL injection protection (prepared statements)
✅ Error tracking (Sentry)
✅ Token blacklist para logout
✅ Role-based access control (RBAC)

### Recomendaciones Producción
- [ ] HTTPS obligatorio
- [ ] Secrets en variables de entorno (no hardcoded)
- [ ] Rotar SECRET_KEY regularmente
- [ ] Configurar CSP headers
- [ ] Backup encryption
- [ ] Rate limiting más agresivo
- [ ] 2FA para admin

Ver: [docs/SECURITY_AUDIT_10_10.md](docs/SECURITY_AUDIT_10_10.md)

---

## 🚀 Deployment

### Render (Actual Producción)

1. **Backend:** Deploy desde `backend/` con `render.yaml`
2. **Frontend:** Build estático en Render Static Site
3. **Database:** SQLite persistente con volumen

Ver guía completa: [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

### Variables de Entorno Requeridas

**Backend:**
```bash
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 días
SENTRY_DSN=your-sentry-dsn  # Opcional
```

**Frontend:**
```bash
VITE_API_URL=https://your-backend.onrender.com
```

---

## 🐛 Troubleshooting

### Backend no inicia
```bash
# Verificar dependencias
pip install -r backend/requirements.txt

# Verificar database
ls -la data/ventas.db  # Debe existir

# Verificar permisos
chmod +x backend/main.py
```

### Frontend no conecta al backend
```bash
# Verificar .env o vite.config.js
cat frontend/.env  # VITE_API_URL debe estar correcto

# Rebuild frontend
cd frontend && npm run build
```

### Tests fallan
```bash
# Backend: reinstalar pytest
pip install pytest pytest-asyncio httpx pytest-mock

# E2E: reinstalar Playwright
npx playwright install
```

### Database corruption
```bash
# Restaurar desde backup
cp backups/ventas.db.YYYYMMDD_HHMMSS.bak data/ventas.db
```

---

## 📚 Documentación Adicional

- [COMPREHENSIVE_TEST_REPORT_2026-01-10.md](docs/COMPREHENSIVE_TEST_REPORT_2026-01-10.md) - Test coverage completo
- [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Deployment step-by-step
- [SECURITY_AUDIT_10_10.md](docs/SECURITY_AUDIT_10_10.md) - Auditoría de seguridad
- [ARCHITECTURAL_REVIEW_2026-01-05.md](docs/ARCHITECTURAL_REVIEW_2026-01-05.md) - Decisiones arquitecturales
- [RECOMMENDED_NEXT_STEPS.md](docs/RECOMMENDED_NEXT_STEPS.md) - Roadmap de mejoras

---

## 🛠️ Tech Debt & Mejoras Pendientes

### High Priority
- [ ] Re-habilitar Zod validation (requiere normalizar schemas backend)
- [ ] Re-habilitar WebSocket (requiere Render upgrade o alternativa)
- [ ] Migrar SQLite → PostgreSQL (production-ready)
- [ ] Agregar tests unitarios frontend (Vitest)

### Medium Priority
- [ ] Implementar cursor pagination (actualmente limit/offset)
- [ ] Optimizar bundle size (actualmente 437 KB)
- [ ] Agregar i18n (actualmente solo español)
- [ ] Implementar dark mode

### Low Priority
- [ ] PWA support (offline-first)
- [ ] Notificaciones push
- [ ] Multi-tenant support

Ver: [docs/IMPROVEMENTS_TODO.md](docs/IMPROVEMENTS_TODO.md)

---

## 🤝 Contributing

1. Fork el proyecto
2. Create feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Add nueva funcionalidad'`
4. Push branch: `git push origin feature/nueva-funcionalidad`
5. Submit Pull Request

**Convenciones:**
- Commits en español
- Tests obligatorios para nuevas features
- Código debe pasar linting (pendiente configurar ESLint/Black)

---

## 📄 Licencia

Proprietary - Todos los derechos reservados

---

## 👥 Equipo

Desarrollado por Mauro para gestión interna de pedidos.

**Contacto:** mauro@example.com (actualizar)

---

## 🎉 Reconocimientos

- FastAPI por la excelente documentación
- React Query por simplificar el estado del servidor
- Render por el hosting accesible
- Sentry por el error tracking

---

**Última actualización:** 2026-01-11
**Versión:** 1.0.0
**Estado:** ✅ Producción estable
