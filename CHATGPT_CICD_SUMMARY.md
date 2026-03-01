# Chorizaurio CI/CD & Security Pipeline — Full Summary

> **Date:** 2026-02-28
> **Repo:** `mauropillox/chorilocal` (GitHub)
> **Prod URL:** `pedidosfriosur.com` / `api.pedidosfriosur.com`

---

## Project Overview

**Chorizaurio** is a production order-management system for a butcher shop ("Frío Sur").

| Layer | Stack |
|---|---|
| **Backend** | Python 3.11, FastAPI 0.115.12, SQLite on Render persistent disk (PostgreSQL coded but inactive), Gunicorn+Uvicorn in Docker, Sentry monitoring, ~23 API routers |
| **Frontend** | React 18, Vite, Tailwind CSS, Zustand, TanStack Query, PWA. Multi-stage Docker → Nginx |
| **E2E** | Playwright, 10 spec files (auth, CRUD, navigation, reports, toasts, offline, performance) |
| **Deploy** | Render hobby tier, auto-deploy from `main` branch. Two Docker services. `render.yaml` IaC |
| **Branches** | `main` (active), `master` (legacy remote HEAD), `mejoras-feb` |

---

## What Existed Before (2 workflows)

### `ci.yml` (CI/CD Pipeline)

- **Triggers:** push `main`/`master`/`develop`, PRs to same
- **Jobs:** `backend-tests`, `frontend-tests`, `frontend-build`, `lint`, `e2e-tests` (label-gated `run-e2e`), `ci-success` (aggregator)
- Uses `npm ci`, pip caching, pinned action versions (`@v4`/`@v5`) — solid baseline
- **Problems found:**
  - ESLint failures invisible (`|| true` suppression)
  - No Python linting at all
  - `ci-success` didn't include lint in its checks
  - `VITE_API_URL` defaulted to prod URL in CI builds
  - Playwright browsers not cached

### `backup-database.yml` (Database Backup)

- **Triggers:** Daily cron (00:00 UTC), manual dispatch
- Logs into Render backend API → triggers server-side backup → downloads file → uploads as GitHub Artifact (90-day retention, max compression)
- **Secrets used:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `BACKEND_URL`
- **Problem found:** `exit 0` on failure = silent backup failures, no notifications

### What was missing

- No security scanning (no CodeQL, no dependency audit, no secret scanning, no SAST)
- No restore verification (backups never tested for restorability)
- No Python linting/formatting (no ruff, flake8, black, mypy)
- No release/tag workflow or deploy gating
- No health checks or production smoke tests in CI
- No container image scanning
- Hardcoded fallback password in `scripts/smoke_test.sh` (line 9: `admin420`)
- `.env` with secrets was committed in git history (removed later but still in history)
- ESLint dependencies (`@eslint/js`, plugins) missing from `frontend/package.json` devDependencies

---

## Changes Made (All Local, Nothing Committed/Pushed)

### 1. EDITED: `.github/workflows/ci.yml` (+51 −9 lines)

| Change | Detail |
|---|---|
| **Added `backend-lint` job** | Uses `ruff check . --output-format=github`. Set `continue-on-error: true` because 92 pre-existing lint issues exist (59 unused imports, 12 redefinitions, 8 f-string issues, 7 unused vars, 3 bare excepts, 3 import ordering) |
| **Fixed ESLint visibility** | Removed `\|\| true` from ESLint command. Replaced with `continue-on-error: true` at job level — failures now visible in CI UI instead of silently swallowed |
| **Fixed `VITE_API_URL`** | Changed fallback from `https://api.pedidosfriosur.com` to `http://localhost:8000/api` — CI builds won't accidentally point to production |
| **Enhanced `ci-success`** | Now includes `backend-lint` and `lint` in dependency list. Prints all job statuses. Distinguishes "required" (tests/build = blocking) from "advisory" (lint = warning only) |

### 2. EDITED: `.github/workflows/backup-database.yml` (+1 −1 line)

Changed `exit 0` → `exit 1` on backup creation failure. Workflow now properly fails and triggers GitHub notifications when backups can't be created.

### 3. CREATED: `.github/workflows/security.yml`

- **Triggers:** Weekly cron (Monday 4AM UTC), PRs on lockfile/Dockerfile changes, manual dispatch
- **Jobs:**
  - `codeql-analysis` — CodeQL for Python and JavaScript/TypeScript, `security-and-quality` queries, SARIF upload to Security tab. Schedule/manual only (too slow for every PR).
  - `dependency-scan` — `pip-audit` on both requirements files, `npm audit --audit-level=high` on frontend. Advisory (`continue-on-error`).
  - `dependency-review` — GitHub `dependency-review-action@v4` on PRs only. Fails on high-severity issues. Posts comment summary.
  - `secret-scan` — `detect-secrets scan` with exclusions for lockfiles/minified JS. Reports count and locations. Advisory.
  - `security-summary` — Aggregated table in GitHub Step Summary.

### 4. CREATED: `.github/workflows/nightly-health.yml`

- **Triggers:** Weekly cron (Sunday 3AM UTC), manual dispatch
- **Jobs:**
  - `dependency-audit` — `pip-audit` + `npm audit`, outputs to Step Summary
  - `prod-smoke` — Hits `$BACKEND_URL/health` and login endpoint. Handles Render cold-start timeouts. Gracefully skips if secrets not configured.
  - `backup-restore-verify` — Logs into prod API, creates backup, downloads it, runs `sqlite3 PRAGMA integrity_check`, reports table counts & file size. Full end-to-end backup restorability proof.
  - `health-summary` — Aggregated table in Step Summary.

### 5. CREATED: `.github/workflows/release-deploy.yml`

- **Triggers:** Push tags `v*`, manual `workflow_dispatch` with version input
- **Inputs:** `version` (string), `skip_tests` (boolean, emergency-only), `run_smoke` (boolean, default true)
- **Jobs:**
  - `validate` — Runs full backend tests + frontend tests + frontend build. Skippable via `skip_tests` input.
  - `create-release` — Creates GitHub Release with auto-generated changelog from git log since last tag. Uses `actions/github-script@v7`. Handles duplicate tag gracefully.
  - `post-deploy-smoke` — Waits 120s for Render, then health check with 5 retries (30s gaps), authenticates and verifies core endpoints (clientes, productos).

### 6. EDITED: `scripts/smoke_test.sh` (local-only, gitignored)

Removed hardcoded fallback password `admin420`. Now uses `${API_USER:?ERROR}` / `${API_PASS:?ERROR}` — fails immediately if credentials aren't provided.

---

## Required GitHub Secrets

| Secret | Purpose | Status |
|---|---|---|
| `ADMIN_USERNAME` | Backup + smoke test login | Already exists |
| `ADMIN_PASSWORD` | Backup + smoke test login | Already exists |
| `BACKEND_URL` | Render backend API base URL | Already exists |
| `VITE_API_URL` | Frontend build API target | Recommended to add |
| `PROD_TEST_USER` | E2E prod tests (future) | Optional |
| `PROD_TEST_PASSWORD` | E2E prod tests (future) | Optional |

---

## Complete Workflow Map

| Trigger | Workflow | Jobs | Blocking? |
|---|---|---|---|
| PR / push main | `ci.yml` | backend-tests, backend-lint, frontend-tests, frontend-build, lint, ci-success | Tests + build block. Lint advisory. |
| PR label `run-e2e` | `ci.yml` (e2e-tests) | Full E2E with local backend+frontend | `continue-on-error` |
| Daily 00:00 UTC | `backup-database.yml` | Download prod backup → artifact | **Now fails loudly** on error |
| Sunday 3AM UTC | `nightly-health.yml` | Dep audit, prod smoke, backup restore verify | Advisory |
| Monday 4AM UTC | `security.yml` | CodeQL, dep scan, secret scan | Advisory |
| PR (lockfile changes) | `security.yml` (dependency-review) | Dependency review | Blocks on high severity |
| Tag `v*` / manual | `release-deploy.yml` | Validate, create release, post-deploy smoke | Blocking |

---

## Known Issues — Intentionally Not Fixed

| Issue | Reason |
|---|---|
| **92 ruff lint errors in backend** | Pre-existing. Lint is advisory (`continue-on-error`) until cleanup. Breakdown: 59 unused imports, 12 redefinitions, 8 f-string, 7 unused vars, 3 bare excepts, 3 import ordering. |
| **ESLint deps missing from `frontend/package.json`** | `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` are imported but not declared. ESLint job will fail until added. Kept as `continue-on-error`. |
| **`.env` in git history** | Commits `eb2dbbc`, `3a69d6c` contain `SECRET_KEY`, `ADMIN_PASSWORD`. Requires `git filter-branch` or BFG + credential rotation. Destructive operation — needs explicit approval. |
| **`smoke_test.sh` with password in git history** | Committed with `admin420` before gitignore. Same historical exposure. |
| **`main` vs `master` branch confusion** | `origin/HEAD → master` but Render deploys from `main`. Branch management out of scope. |

---

## How to Validate

1. **`ci.yml`:** Push a branch or open PR → verify all jobs (incl. `backend-lint`) appear, `ci-success` reports correctly
2. **`backup-database.yml`:** Manual trigger → verify it fails loudly if backup creation fails
3. **`security.yml`:** Manual trigger → verify CodeQL, dep scan, secret scan run and produce summaries
4. **`nightly-health.yml`:** Manual trigger → verify dep audit, prod smoke, backup restore all work
5. **`release-deploy.yml`:** Manual trigger with test version → verify validate passes, release created, smoke test runs

---

## File Change Inventory

```
MODIFIED (2 files, tracked):
  .github/workflows/ci.yml              (+51 -9 lines)
  .github/workflows/backup-database.yml (+1 -1 line)

CREATED (3 files, untracked):
  .github/workflows/security.yml        (~130 lines)
  .github/workflows/nightly-health.yml  (~160 lines)
  .github/workflows/release-deploy.yml  (~170 lines)

MODIFIED (1 file, gitignored):
  scripts/smoke_test.sh                 (credential cleanup)

NOTHING WAS COMMITTED OR PUSHED.
```

---

## Recommended Next Steps

1. **Commit & push** the 5 workflow files in a single commit
2. **Add `VITE_API_URL` secret** in GitHub repo settings
3. **Trigger each workflow manually** to validate
4. **Clean up 92 ruff errors** in backend (start with `ruff check . --fix` for 68 auto-fixable)
5. **Add ESLint deps** to `frontend/package.json` devDependencies
6. **Consider** running BFG Repo Cleaner to remove historical secrets + rotate `SECRET_KEY` and `ADMIN_PASSWORD`
7. **Set up branch protection** on `main` requiring `ci-success` check
