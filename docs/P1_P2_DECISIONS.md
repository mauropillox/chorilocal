# P1/P2/P3 Security Decisions

**Date:** 2026-01-08  
**Context:** Post-Phase1 security hardening (backup system, migrations, SQLite optimization)

---

## ✅ P1 Implemented (High Priority)

### 1. Environment Validation Enhancement
**Status:** ✅ Implemented  
**Files:** `backend/deps.py`

Enhanced `validate_production_secrets()` to fail-fast on startup if critical vars are missing/weak:
- `SECRET_KEY` (min 32 chars, rejects weak defaults)
- `ADMIN_PASSWORD` (min 8 chars)
- `ENVIRONMENT` (must be "production")
- `CORS_ORIGINS` (non-empty, warns on localhost)

**Rationale:** Prevents production deployment with insecure configuration. Error messages categorized for fast diagnosis.

### 2. Admin Rate Limiting
**Status:** ✅ Implemented  
**Files:** `backend/deps.py`, `backend/routers/admin.py`

Added stricter `RATE_LIMIT_ADMIN = "20/minute"` for all 10 admin endpoints:
- Backup operations (create, list, download, status)
- Migration operations (list, run)
- System info
- Delete-impact previews (3 entities)

**Rationale:** Admin endpoints are high-value targets. 20/min allows legitimate use while preventing abuse. Lower than generic READ (100/min) or WRITE (30/min).

### 3. Delete Confirmation Safety
**Status:** ✅ Implemented  
**Files:** `backend/routers/productos.py`, `backend/routers/clientes.py`, `backend/routers/categorias.py`

All three main entity deletes now require `X-Confirm-Delete: true` header:
- DELETE `/productos/{id}`
- DELETE `/clientes/{id}`
- DELETE `/categorias/{id}`

Returns 400 with clear message if header missing. Frontend should:
1. Call GET `/admin/delete-impact/{entity}/{id}` to preview impact
2. Show confirmation dialog with impact details
3. Set header if user confirms

**Rationale:** Prevents accidental deletes. Complements existing FK constraint checks with explicit user confirmation. Minimal backend change, requires frontend integration.

---

## ❌ P2 Deferred (Optional)

### 4. JWT Refresh Tokens
**Status:** ❌ Not Implemented  
**Reason:** Current 30-minute session length is adequate for the user base and usage patterns. Implementing refresh tokens adds complexity (token rotation, revocation logic, additional DB table) without clear benefit. No user complaints about frequent re-login. Can revisit if session length becomes a friction point.

**Monitoring:** If support tickets mention "login too often", reconsider.

---

## ❌ P3/P4 Deferred (Low Priority)

### 5. Log Rotation
**Status:** ❌ Not Implemented  
**Reason:** App logs to stdout (standard 12-factor). Render platform handles log retention (7-day default on free tier, configurable on paid). Implementing in-app rotation (e.g., logrotate, rotating file handlers) adds complexity and doesn't solve the underlying issue (disk space on ephemeral containers). Better to use platform features or upgrade retention if needed.

**Alternative:** If historical logs needed, configure Render log drains to external service (Datadog, Papertrail, etc.).

### 6. Additional Infrastructure Hardening
**Status:** ❌ Not Implemented  
**Reason:** No concrete incidents or vulnerabilities identified. Current setup has:
- HTTPS (Render default)
- CORS with specific origins
- Rate limiting (per-IP, in-memory)
- JWT auth with bcrypt
- SQLite with WAL mode and foreign keys
- Backup system with rotation

Further hardening (e.g., WAF, DDoS protection, Redis-backed rate limiting, PostgreSQL) would increase complexity and cost without addressing known threats. Should be driven by actual security events or scale requirements.

**Monitoring:** Review after 3 months of production usage or if incidents occur.

---

## Summary

**Implemented (P1):**
- Environment validation (4 critical vars)
- Admin-specific rate limiting (20/min)
- Delete confirmation safety (X-Confirm-Delete header)

**Deferred:**
- JWT refresh (P2) - no user friction observed
- Log rotation (P3) - platform handles it
- Additional infra hardening (P4) - no known threats

**Next Review:** 2026-04-08 (3 months) or sooner if:
- Security incident occurs
- User friction with current session length
- Platform limitations encountered
- Scale requirements change
