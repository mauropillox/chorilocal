# Chorizaurio CI/CD Pipeline — Full Audit & Improvement Plan (v2)

> **Date:** 2026-02-28
> **Repo:** `mauropillox/chorilocal` (GitHub, private)
> **Prod URL:** `pedidosfriosur.com` / `api.pedidosfriosur.com`
> **Platform:** Render (hobby tier, auto-deploy from `main`)

---

## Project Stack

| Layer | Stack |
|---|---|
| **Backend** | Python 3.11, FastAPI 0.115.12, SQLite on Render persistent disk (PostgreSQL coded but inactive), Gunicorn+Uvicorn in Docker, Sentry monitoring, ~23 API routers |
| **Frontend** | React 18, Vite, Tailwind CSS v4, Zustand, TanStack Query, PWA. Multi-stage Docker → Nginx |
| **E2E** | Playwright (10 spec files: auth, CRUD, navigation, reports, toasts, offline, performance, fixes-validation, production) |
| **Deploy** | Render hobby tier, auto-deploy from `main`. Two Docker services (backend + frontend). `render.yaml` IaC |
| **Branches** | `main` (active, Render deploys from here), `master` (legacy, is `origin/HEAD`), `mejoras-feb` |

---

## Current Workflow Inventory (5 files)

### 1. `ci.yml` — CI/CD Pipeline

**Triggers:** push to `main`/`master`/`develop`, PRs to same (ignores docs/md)

**Jobs:**

| Job | What it does | Blocking? |
|---|---|---|
| `backend-tests` | `pip install -r requirements.txt` → `pytest tests/ -v --tb=short` → coverage run (separate) → upload htmlcov artifact | **Yes** (blocks `ci-success`) |
| `frontend-tests` | `npm ci` → `vitest run` → coverage → upload artifact | **Yes** |
| `frontend-build` | `npm ci` → `vite build` (needs `frontend-tests`) → upload dist artifact | **Yes** |
| `backend-lint` | `pip install ruff` → `ruff check . --output-format=github` | **No** (`continue-on-error: true`) |
| `lint` (Frontend) | `npm ci` → `npm run lint` (ESLint) | **No** (`continue-on-error: true`) |
| `e2e-tests` | Label-gated (`run-e2e`), starts backend+frontend locally, runs `playwright test` | **No** (`continue-on-error: true`) |
| `ci-success` | Aggregator gate. Checks backend-tests, frontend-tests, frontend-build. Lints are advisory warnings. | **Yes** (intended as branch protection required check) |

**Environment:**
- `NODE_VERSION: '20'`, `PYTHON_VERSION: '3.11'`
- `SECRET_KEY: test-secret-key-for-ci` (hardcoded test value, acceptable)
- `VITE_API_URL` fallback: `http://localhost:8000/api` (was prod URL, already fixed)

### 2. `backup-database.yml` — Database Backup

**Triggers:** Daily cron `0 0 * * *` UTC, manual dispatch

**Single job `backup`:**
1. Login to Render backend API using `ADMIN_USERNAME`/`ADMIN_PASSWORD` secrets
2. POST to `/api/admin/backup-now` to create server-side backup
3. Download the backup file
4. Upload as GitHub Artifact (90-day retention, max compression)
5. Step summary with timestamp and file list

**Key details:**
- Fails with `exit 1` if login fails or backup creation fails (was `exit 0`, already fixed)
- If download succeeds but file is empty, writes `backup_failed.log` but does NOT `exit 1` (mild gap)
- Secrets used: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `BACKEND_URL`

### 3. `security.yml` — Security Scanning

**Triggers:** Weekly Mon 4AM UTC, PRs on lockfile/Dockerfile changes, manual

**Jobs:**

| Job | When | What | Blocking? |
|---|---|---|---|
| `codeql-analysis` | Schedule/manual only | CodeQL for Python + JS/TS, `security-and-quality` queries | No |
| `dependency-scan` | Always | `pip-audit` on both requirements files, `npm audit --audit-level=high` | No (`continue-on-error`) |
| `dependency-review` | PRs only | `dependency-review-action@v4`, fails on high severity, comments in PR | **Yes** (on PRs) |
| `secret-scan` | Always | `detect-secrets scan` with exclusions, reports count/locations | No (`continue-on-error`) |
| `security-summary` | Always | Step Summary table | No |

**Permissions:** `contents: read`, `security-events: write`

### 4. `nightly-health.yml` — Weekly Health Check

**Triggers:** Weekly Sun 3AM UTC, manual

**Jobs:**

| Job | What | Blocking? |
|---|---|---|
| `dependency-audit` | `pip-audit` + `npm audit`, output to Step Summary | No |
| `prod-smoke` | Hits `$BACKEND_URL/health` and login endpoint, handles Render cold-start | No |
| `backup-restore-verify` | Login → create backup → download → `PRAGMA integrity_check` → table row counts | No |
| `health-summary` | Aggregated result table | No |

### 5. `release-deploy.yml` — Release & Deploy

**Triggers:** Push tags `v*`, manual dispatch (with version / skip_tests / run_smoke inputs)

**Jobs:**

| Job | What | Blocking? |
|---|---|---|
| `validate` | Full backend pytest + frontend vitest + vite build. Skippable via `skip_tests` input. | **Yes** (blocks release) |
| `create-release` | Generates changelog from git log, creates GitHub Release via `github-script@v7` | Depends on validate |
| `post-deploy-smoke` | Waits 120s for Render, then health check (5 retries, 30s gaps), auth + endpoint checks | No |

---

## Findings by Category

### CI Reliability Risks

| # | Risk | Severity | Detail |
|---|---|---|---|
| **R1** | ESLint deps missing from `package.json` | **Medium** | `eslint.config.js` imports `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` — none declared in `devDependencies`. `npm ci` won't install them. Lint always fails. Hidden by `continue-on-error`. |
| **R2** | `ruff` not pinned | **Low** | `pip install ruff` without version. New releases could change output or break. |
| **R3** | E2E `PLAYWRIGHT_URL` env var mismatch | **Medium** | `playwright.config.ts` reads `PLAYWRIGHT_URL`, but CI E2E job sets `BASE_URL`. Tests would hit default `https://chorilocal.onrender.com` instead of local `localhost:5173`. |
| **R4** | E2E missing `ENVIRONMENT`/`DB_PATH` env vars | **Medium** | E2E job starts backend with only `SECRET_KEY`. Missing `ENVIRONMENT=test` and `DB_PATH`. Backend may attempt prod-mode validation and fail. |
| **R5** | Two `npm ci` in same PR run | **Low** | `frontend-tests` and `frontend-build` both do `npm ci`. Build depends on tests, so it re-installs from scratch (~20s waste). |
| **R6** | Coverage runs always `continue-on-error` | **Low** | Coverage threshold regressions are invisible in CI. |
| **R7** | Backend tests run twice | **Low** | First `pytest tests/ -v`, then again `pytest tests/ --cov`. Same suite, double time (~30-60s). |

### Security Gaps

| # | Gap | Severity | Detail |
|---|---|---|---|
| **S1** | `.env` committed in git history | **High** | Commits `eb2dbbc`, `3a69d6c` contain `SECRET_KEY`, `ADMIN_PASSWORD`. File is now gitignored but secrets are permanently in history. Requires BFG/filter-branch + credential rotation. |
| **S2** | `smoke_test.sh` password in git history | **Medium** | Committed with hardcoded `admin420` default before gitignore (commits `b993e84`, `53ca3a4`). Currently gitignored, local file now requires env vars. |
| **S3** | No `permissions` block in `ci.yml` | **Medium** | Defaults to full `write` permissions. Should restrict to `contents: read`. |
| **S4** | No `permissions` in `backup-database.yml` | **Medium** | Same as S3. Only needs `contents: read`. |
| **S5** | No `permissions` in `nightly-health.yml` | **Medium** | Same as S3. |
| **S6** | `python-jose` has known CVEs | **Medium** | `python-jose==3.4.0` has CVE-2024-33663. Unmaintained. `pyjwt` is the recommended replacement. Not a CI change — flagging for awareness. |
| **S7** | `detect-secrets` excludes are broad | **Low** | All `.lock` files excluded. `.env.example` may generate false positives. |

### Deployment Safety Gaps

| # | Gap | Severity | Detail |
|---|---|---|---|
| **D1** | No branch protection enforced | **High** | `ci-success` exists as a gate but no GitHub branch protection rules require it. Anyone can push directly to `main`. |
| **D2** | `release-deploy.yml` VITE_API_URL fallback to prod | **Medium** | Validate job builds frontend with fallback `https://api.pedidosfriosur.com/api`. CI validation should not point to production. `ci.yml` was fixed but this one wasn't. |
| **D3** | `skip_tests` bypass has no audit trail | **Low** | Emergency skip leaves no record of who and why. |
| **D4** | Render auto-deploys on push to `main` | **Info** | `autoDeploy: true` in `render.yaml`. No manual gate between CI pass and production deploy. By design, but noted. |

### Historical Risk Areas

| # | Risk | Detail |
|---|---|---|
| **H1** | `.env` with real secrets in git history | Permanent exposure. Requires history rewrite + credential rotation. |
| **H2** | `smoke_test.sh` password in history | `admin420` in 2 commits. Currently gitignored. |
| **H3** | `main` vs `master` branch confusion | `origin/HEAD → master` but Render deploys from `main`. CI triggers on both. |
| **H4** | Root `Dockerfile` is legacy | Uses Node 18 (not 20), `npm install` (not `npm ci`), root `requirements.txt`. Actual deploy uses `backend/Dockerfile` + `frontend/Dockerfile`. Confusing artifact. |

### CI Performance Bottlenecks

| # | Bottleneck | Impact | Detail |
|---|---|---|---|
| **P1** | Backend tests run twice | ~30-60s waste | pytest runs, then re-runs with coverage. Should be one invocation with `--cov`. |
| **P2** | Frontend `npm ci` runs twice | ~20-30s waste | Once in `frontend-tests`, once in `frontend-build`. |
| **P3** | Playwright browsers not cached | ~60s if E2E | Downloads chromium every time. Cacheable. |
| **P4** | `nightly-health` + `security` both run `npm ci` | ~20s each | Different schedules reduce overlap. Unavoidable for `npm audit`. |

### Flaky Test Detection

| Aspect | Status |
|---|---|
| Backend `pytest` retries | None. Single-shot, hard fail. |
| E2E Playwright retries | Configured: `retries: CI ? 2 : 0`. Good. |
| Frontend `vitest` retries | None. `testTimeout: 10000`. |
| JUnit/XML upload for backend | Missing. GitHub can't show test annotations. |
| Test trend tracking | None. No history mechanism. |

### Rollback Readiness

| Aspect | Status |
|---|---|
| Render rollback | Manual via dashboard |
| DB rollback | Manual: download artifact, restore to Render |
| Frontend rollback | Revert commit + push (or Render dashboard) |
| Workflow rollback | Revert commit or delete file |
| Secret rotation | Not automated |

### Restore Validation Robustness

| Check | Status |
|---|---|
| `PRAGMA integrity_check` | ✅ Done |
| Table row counts | ✅ Printed |
| Zero-row detection | ❌ Missing — empty but valid DB passes |
| Minimum size check | ❌ Missing — a 1KB file passes |
| Backup freshness check | ❌ Missing — stale backup not detected |

---

## Improvement Plan

### HIGH Priority (Zero-risk line fixes)

#### I1 — Fix E2E `PLAYWRIGHT_URL` env var
- **File:** `ci.yml` (e2e-tests, "Run E2E tests" step)
- **Why:** CI sets `BASE_URL` but Playwright reads `PLAYWRIGHT_URL`. Tests hit remote Render instead of localhost.
- **Change:** `BASE_URL` → `PLAYWRIGHT_URL`
- **Risk:** None. **1 line.**

#### I2 — Fix E2E missing env vars
- **File:** `ci.yml` (e2e-tests, "Start backend server" step)
- **Why:** Backend startup without `ENVIRONMENT=test` and `DB_PATH` may attempt prod validation and fail.
- **Change:** Add `ENVIRONMENT: test` and `DB_PATH: /tmp/test_e2e_ventas.db`
- **Risk:** None. **2 lines.**

#### I3 — Add `permissions` to `ci.yml` and `backup-database.yml`
- **File:** `ci.yml` (top-level) + `backup-database.yml` (top-level)
- **Why:** Principle of least privilege. Currently full write.
- **Change:** Add `permissions: contents: read`
- **Risk:** None. **2+2 lines.**

#### I4 — Fix `release-deploy.yml` VITE_API_URL fallback
- **File:** `release-deploy.yml` (validate job, "Build frontend")
- **Why:** Still points to prod URL. CI validation should not hit production.
- **Change:** `https://api.pedidosfriosur.com/api` → `http://localhost:8000/api`
- **Risk:** None. **1 line.**

### MEDIUM Priority

#### I5 — Merge backend test + coverage into single run
- **File:** `ci.yml` (backend-tests job)
- **Why:** Backend tests run twice (once plain, once with coverage). Wastes 30-60s.
- **Change:** Replace 2 steps with 1 `pytest tests/ -v --tb=short --cov=. --cov-report=xml --cov-report=html --junitxml=test-results.xml` + upload JUnit XML artifact
- **Risk:** Low. **~10 line edit.** Also adds JUnit XML for GitHub test annotations.

#### I6 — Add minimum backup size check
- **File:** `nightly-health.yml` (backup-restore-verify)
- **Why:** A valid but empty SQLite file (~4KB) passes integrity check. Real backups should be >10KB.
- **Change:** `stat -c%s` check, fail if < 10240 bytes.
- **Risk:** None. **5 lines.**

#### I7 — Pin `ruff` version
- **File:** `ci.yml` (backend-lint)
- **Why:** `pip install ruff` without version can break on update.
- **Change:** `pip install ruff` → `pip install ruff==0.9.7`
- **Risk:** None. **1 word.**

#### I8 — Add `concurrency` groups to `ci.yml`
- **File:** `ci.yml` (top-level)
- **Why:** Cancel superseded CI runs on same branch. Saves runner time on rapid pushes.
- **Change:** `concurrency: group: ci-${{ github.ref }}` + `cancel-in-progress: true`
- **Risk:** Low. **3 lines.**

### LOW Priority

#### I10 — Add zero-row detection in restore-verify
- **File:** `nightly-health.yml` (backup-restore-verify)
- **Why:** Empty DB backup passes integrity check but is useless.
- **Change:** Query `SELECT COUNT(*) FROM usuarios`, fail if 0.
- **Risk:** None. **6 lines.**

#### I11 — Add `concurrency` to backup workflow
- **File:** `backup-database.yml` (top-level)
- **Why:** Prevent overlapping manual + scheduled runs.
- **Change:** `concurrency: group: database-backup` + `cancel-in-progress: false`
- **Risk:** None. **3 lines.**

---

## Implementation Order

| Phase | Changes | Files | Risk |
|---|---|---|---|
| **Phase 1** | I1 + I2 + I3 + I4 | ci.yml, backup-database.yml, release-deploy.yml | None |
| **Phase 2** | I7 + I8 | ci.yml | None/Low |
| **Phase 3** | I5 | ci.yml | Low |
| **Phase 4** | I6 + I10 + I11 | nightly-health.yml, backup-database.yml | None |

**Total: ~35 lines changed across 4 existing files. No new files. No backup logic changes. No secret introductions.**

---

## Required GitHub Secrets

| Secret | Purpose | Exists? |
|---|---|---|
| `ADMIN_USERNAME` | Backup + smoke login | Yes |
| `ADMIN_PASSWORD` | Backup + smoke login | Yes |
| `BACKEND_URL` | Render backend API | Yes |
| `VITE_API_URL` | Frontend build target | Recommended (has safe localhost fallback) |

---

## Current Local State (Uncommitted)

```
MODIFIED (tracked):
  .github/workflows/ci.yml              (+51 -9 lines — from previous session)
  .github/workflows/backup-database.yml (+1 -1 line — exit 0 → exit 1)

CREATED (untracked):
  .github/workflows/security.yml        (~130 lines — from previous session)
  .github/workflows/nightly-health.yml  (~200 lines — from previous session)
  .github/workflows/release-deploy.yml  (~225 lines — from previous session)
  CHATGPT_CICD_SUMMARY.md               (previous summary doc)
  CHATGPT_CICD_AUDIT_V2.md              (this file)

MODIFIED (gitignored):
  scripts/smoke_test.sh                 (credential cleanup — from previous session)

NOTHING HAS BEEN COMMITTED OR PUSHED.
```

---

## What Still Needs Fixing (Not CI — Flagged for Awareness)

1. **ESLint deps missing from `frontend/package.json`** — `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` need to be added to `devDependencies` for lint to actually work.
2. **92 pre-existing ruff lint errors** in backend — 59 unused imports, 12 redefinitions, 8 f-string issues, 7 unused vars, 3 bare excepts, 3 import ordering. Most auto-fixable with `ruff check . --fix`.
3. **`python-jose` CVE** — Replace with `pyjwt`. Backend code change.
4. **`.env` in git history** — Requires `git filter-branch` or BFG Repo Cleaner + credential rotation.
5. **Root `Dockerfile`** — Legacy artifact using Node 18 + `npm install`. Could be deleted or marked as legacy.
6. **`main`/`master` branch confusion** — Set `origin/HEAD` to `main` or delete `master`.
7. **Branch protection rules** — Configure GitHub to require `ci-success` status check before merge to `main`.

---

## How to Validate After Committing

| Workflow | How to test | Expected |
|---|---|---|
| `ci.yml` | Push branch or open PR | All jobs appear, `ci-success` reports required + advisory results |
| `backup-database.yml` | Manual "Run workflow" | Fails loudly if backup creation fails |
| `security.yml` | Manual trigger | CodeQL completes, dep scan reports, secret scan runs |
| `nightly-health.yml` | Manual trigger | Dep audit, prod smoke, backup restore verify produce Step Summary |
| `release-deploy.yml` | Manual trigger with test version | Validate passes, release created, smoke runs |

## How to Disable a Workflow Instantly

1. **GitHub UI:** Go to Actions → select workflow → "..." menu → "Disable workflow"
2. **Code:** Add `if: false` to the workflow's top-level job
3. **Revert:** `git revert <commit>` and push

---

## Workflow Map (Visual)

```
PR / push main
  └─→ ci.yml
        ├── backend-tests (BLOCKING)
        ├── backend-lint (advisory)
        ├── frontend-tests (BLOCKING)
        │     └── frontend-build (BLOCKING)
        ├── frontend-lint (advisory)
        ├── e2e-tests (label-gated, advisory)
        └── ci-success ← gate job ← branch protection (recommended)

Daily 00:00 UTC
  └─→ backup-database.yml
        └── backup (login → create → download → artifact, 90d retention)

Weekly Sunday 3AM UTC
  └─→ nightly-health.yml
        ├── dependency-audit
        ├── prod-smoke
        ├── backup-restore-verify
        └── health-summary

Weekly Monday 4AM UTC
  └─→ security.yml
        ├── codeql-analysis (schedule only)
        ├── dependency-scan
        ├── dependency-review (PR only, BLOCKING on high severity)
        ├── secret-scan
        └── security-summary

Tag v* / manual
  └─→ release-deploy.yml
        ├── validate (BLOCKING, skippable via input)
        ├── create-release (changelog + GH release)
        └── post-deploy-smoke (120s wait → health → auth → endpoints)
```
