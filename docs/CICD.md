# 🚀 CI/CD Pipeline - Documentación

> ⚠️ **IMPORTANTE**: Este documento es solo referencia. NO IMPLEMENTAR hasta que se confirme el pago.
> 
> **Estado**: 🔴 PENDIENTE DE PAGO
> 
> **Última actualización**: 2026-01-04

---

## 📍 Repositorio Oficial

```
https://github.com/mauropillox/chorizaurio
```

---

## 🏗️ Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDER.COM                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  chorilocal-frontend │    │  chorilocal-backend  │        │
│  │  (Docker/Nginx)      │───▶│  (Docker/FastAPI)    │        │
│  │                      │    │                      │        │
│  │  pedidosfriosur.com  │    │  api.pedidosfriosur  │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                      │                       │
│                              ┌───────▼───────┐              │
│                              │   SQLite DB   │              │
│                              │  ventas.db    │              │
│                              └───────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Pipeline Propuesto (NO IMPLEMENTADO)

### Trigger Events
- Push a `main` → Tests + Deploy
- Push a `develop` → Tests only
- Pull Request → Tests + E2E

### Jobs

#### 1. Backend Tests 🔧
```yaml
# NO IMPLEMENTAR
- Python 3.11
- pip install requirements.txt
- pytest tests/ -v --cov
```

#### 2. Frontend Tests 🎨
```yaml
# NO IMPLEMENTAR
- Node.js 18
- npm ci
- npm run lint
- npm run build
```

#### 3. Docker Build 🐳
```yaml
# NO IMPLEMENTAR
- Build backend image
- Build frontend image
- Push to registry (opcional)
```

#### 4. Deploy to Render 🚀
```yaml
# NO IMPLEMENTAR
- Trigger deploy hooks
- Health check post-deploy
```

---

## 🔐 Secrets Requeridos (cuando se implemente)

| Secret | Descripción |
|--------|-------------|
| `RENDER_DEPLOY_HOOK_BACKEND` | Webhook de deploy del backend |
| `RENDER_DEPLOY_HOOK_FRONTEND` | Webhook de deploy del frontend |

### Cómo obtener Deploy Hooks:
1. Ir a https://dashboard.render.com
2. Seleccionar servicio (backend o frontend)
3. Settings → Build & Deploy → Deploy Hook
4. Copiar URL

---

## 📁 Archivo de Workflow (REFERENCIA)

Ubicación cuando se implemente:
```
.github/workflows/ci.yml
```

Contenido de referencia guardado pero **NO ACTIVO**.

---

## ⏱️ Tiempo Estimado de Implementación

| Tarea | Tiempo |
|-------|--------|
| Crear workflow file | 10 min |
| Configurar secrets en GitHub | 10 min |
| Obtener deploy hooks de Render | 5 min |
| Test del pipeline | 15 min |
| **Total** | **~40 min** |

---

## 🚦 Checklist Pre-Implementación

- [ ] ✅ Pago confirmado
- [ ] Acceso al repo GitHub confirmado
- [ ] Deploy hooks de Render obtenidos
- [ ] Secrets configurados en GitHub
- [ ] Pipeline testeado en branch de prueba
- [ ] Deploy automático verificado

---

## 📞 Contacto

Cuando se confirme el pago, contactar para implementar el pipeline completo.

---

*Documento generado: 2026-01-04*
*Estado: 🔴 PENDIENTE - NO IMPLEMENTAR*
