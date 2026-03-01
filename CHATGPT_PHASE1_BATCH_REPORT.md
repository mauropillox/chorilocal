# Phase 1 Batch Report — CI Reliability Hardening

**Generated:** 2026-02-28  
**Phase:** P1 (CI Reliability)  
**Changes:** #8 through #14 (7 total)  
**Status:** ✅ COMPLETE — all YAML validated  
**Governance:** No commits, no pushes, no PRs — local only

---

## Change Summary

| # | ID | File | Description | Risk | Lines |
|---|-----|------|------------|------|-------|
| 8 | P1.0 | `release-deploy.yml` | VITE_API_URL fallback: prod → localhost | LOW | +1 |
| 9 | P1.1 | `ci.yml` | Merge dual pytest into single invocation | LOW | −6/+12 |
| 10 | P1.2 | `ci.yml` | Pin ruff to `0.9.7` | LOW | 1 changed |
| 11 | P1.3 | `backup-database.yml` | Add concurrency block (cancel-in-progress: false) | LOW | +3 |
| 12 | P1.4 | `backup-database.yml` | Add `exit 1` on empty backup download | LOW | +1 |
| 13 | P1.5a | `nightly-health.yml` | Minimum backup size check (≥10KB) | LOW | +8 |
| 14 | P1.5b | `nightly-health.yml` | Zero-row detection on `usuarios` table | LOW | +7 |

**Total delta:** −6 / +33 lines across 3 files

---

## Change #8 — VITE_API_URL Fallback Fix (previously applied)

**File:** `.github/workflows/release-deploy.yml`

Changed the `VITE_API_URL` fallback from production URL to `http://localhost:8000/api`. This prevents CI from accidentally pointing builds at production when the secret isn't set.

---

## Change #9 — Merge Dual pytest Runs

**File:** `.github/workflows/ci.yml` (backend-tests job)

### Problem
Backend tests ran twice:
1. `pytest tests/ -v --tb=short` (with env vars, mandatory)
2. `pytest tests/ --cov=. --cov-report=xml --cov-report=html` (WITHOUT env vars, `continue-on-error: true`)

Issues:
- Wasted ~60s CI time running tests twice
- Coverage run lacked `ENVIRONMENT`, `SECRET_KEY`, `DB_PATH` env vars — could fail silently
- `continue-on-error: true` meant coverage failures were invisible
- No JUnit XML artifact produced

### Solution
Single invocation combining all flags:
```yaml
- name: Run tests with coverage
  run: python -m pytest tests/ -v --tb=short --cov=. --cov-report=xml --cov-report=html --junitxml=test-results.xml
  env:
    ENVIRONMENT: test
    SECRET_KEY: test-secret-key-for-ci
    DB_PATH: /tmp/test_ventas.db
```

Added JUnit XML artifact upload (`backend-test-results`) and made coverage upload `if: always()`.

### Validation
Ran locally — confirmed all 3 artifacts created:
- `test-results.xml` (54KB JUnit XML) ✅
- `htmlcov/index.html` (29KB HTML coverage) ✅
- `coverage.xml` (307KB XML coverage) ✅1

### Artifact Upload Paths
| Artifact Name | Path | Matches Before? |
|--------------|------|----------------|
| `backend-test-results` | `backend/test-results.xml` | NEW (added) |
| `backend-coverage` | `backend/htmlcov/` | ✅ Same as before |

---

## Change #10 — Pin ruff Version

**File:** `.github/workflows/ci.yml` (backend-lint job)

### Before
```yaml
run: pip install ruff
```

### After
```yaml
run: pip install ruff==0.9.7
```

Prevents surprise lint rule changes from breaking CI unexpectedly. Version bumps should be intentional via PR.

---

## Change #11 — Backup Concurrency Block

**File:** `.github/workflows/backup-database.yml`

### Added
```yaml
concurrency:
  group: database-backup
  cancel-in-progress: false
```

Key design decision: `cancel-in-progress: false` **never cancels running backups**. If a backup is in progress when a new trigger fires, the new run queues instead of killing the active one. This prevents data loss from interrupted backup downloads.

---

## Change #12 — Exit 1 on Empty Backup Download

**File:** `.github/workflows/backup-database.yml`

### Before
```bash
else
  echo "⚠️ Backup falló o está vacío"
  echo "Backup failed at $(date)" > backups/backup_failed.log
fi
```

### After
```bash
else
  echo "❌ Backup falló o está vacío"
  echo "Backup failed at $(date)" > backups/backup_failed.log
  exit 1
fi
```

Previously, a failed/empty backup download would log a warning but the workflow would succeed, uploading an empty artifact. Now it fails properly, triggering GitHub Actions failure notifications.

---

## Change #13 — Minimum Backup Size Check (≥10KB)

**File:** `.github/workflows/nightly-health.yml` (backup-restore-verify job)

### Added (before integrity check)
```bash
echo "📏 Checking backup file size..."
FILESIZE=$(stat -c%s "/tmp/backup-verify/$BACKUP_FILENAME")
if [ "$FILESIZE" -lt 10240 ]; then
  echo "❌ Backup file too small: ${FILESIZE} bytes (minimum 10KB)"
  exit 1
fi
echo "✅ Backup size OK: ${FILESIZE} bytes"
```

Catches truncated downloads that might still pass `PRAGMA integrity_check` on a valid-but-empty SQLite header. The production database is several MB — anything under 10KB is suspect.

---

## Change #14 — Zero-Row Detection on `usuarios` Table

**File:** `.github/workflows/nightly-health.yml` (backup-restore-verify job)

### Added (after table statistics printout)
```bash
echo "🔒 Checking critical table has data..."
USUARIO_COUNT=$(sqlite3 "/tmp/backup-verify/$BACKUP_FILENAME" "SELECT COUNT(*) FROM usuarios;" 2>/dev/null || echo "0")
if [ "$USUARIO_COUNT" -eq 0 ] 2>/dev/null; then
  echo "❌ CRITICAL: usuarios table has 0 rows — possible data loss"
  exit 1
fi
echo "✅ usuarios table has $USUARIO_COUNT rows"
```

A production system with 0 users means the backup is empty or corrupted. This is the most critical table — if it's empty after restore, the nightly health check will fail and alert the team.

---

## YAML Validation

All 5 workflow files pass `yaml.safe_load()`:

```
✅ .github/workflows/ci.yml
✅ .github/workflows/backup-database.yml
✅ .github/workflows/nightly-health.yml
✅ .github/workflows/release-deploy.yml
✅ .github/workflows/security.yml
```

---

## Files Modified in Phase 1

| File | Changes Applied |
|------|----------------|
| `.github/workflows/ci.yml` | #8 (VITE fallback), #9 (merge pytest), #10 (pin ruff) |
| `.github/workflows/backup-database.yml` | #11 (concurrency), #12 (exit 1 empty) |
| `.github/workflows/nightly-health.yml` | #13 (size check), #14 (zero-row detect) |
| `.github/workflows/release-deploy.yml` | #8 (VITE fallback — applied in previous session) |

---

## What's Next — Phase 2 (Security Hardening)

Pending changes awaiting approval:

| # | ID | Description |
|---|-----|------------|
| 15 | P2.1 | `python-jose==3.4.0` → CVE-2024-33663 remediation |
| 16 | P2.2 | Dependency gating rules |
| 17 | P2.3 | Secrets audit confirmation |
| 18 | P2.4 | Permissions verification |

**⏸ Waiting for approval before starting Phase 2.**
