# 🛑 DO NOT COMMIT YET — GOVERNANCE ANALYSIS ONLY 🛑

# CHATGPT_CICD_GOVERNANCE_ANALYSIS_V3.md

## Chorizaurio / Friosur — Production Governance CI/CD Hardening Analysis

> **Date:** 2026-02-28
> **Repo:** `mauropillox/chorilocal` (GitHub, private)
> **Prod Domains:** `pedidosfriosur.com` / `api.pedidosfriosur.com`
> **Deploy Platform:** Render (hobby tier, Oregon, auto-deploy from `main`)
> **Analyst Roles:** Staff DevOps, AppSec, Platform RE, Backend Lead, Frontend Lead, Incident Commander, Security Compliance Officer

---

## Executive Summary

This document is the output of a **governed, multi-role, production-safe CI/CD hardening review** of the Chorizaurio/Friosur system. It cross-validates all findings from `CHATGPT_CICD_AUDIT_V2.md`, extends the analysis with blast-radius modeling, failure simulation, governance alignment, Render auto-deploy risk analysis, and a production readiness scorecard.

**Current state:** The repository has 5 GitHub Actions workflows (2 modified, 3 newly created but uncommitted). The CI pipeline functions but has **critical environment mismatches**, **missing permissions scoping**, **no branch protection enforcement**, and **secrets permanently exposed in git history**. The system is a live SaaS serving Friosur's daily operations.

**Key findings:**
- **2 Critical risks** (secret history exposure, E2E env var mismatch hitting production)
- **6 High risks** (no branch protection, missing permissions, VITE_API_URL prod fallback, duplicate test runs, ESLint silently broken, backup download doesn't fail on empty)
- **8 Medium risks** (pinning, concurrency, CVEs, coverage invisibility, cron overlap, restore validation gaps)
- **4 Low/Informational risks** (legacy Dockerfile, branch naming, artifact retention, test flakiness tracking)
- **Production Readiness Score: 5.1 / 10**

**Recommended action:** Implement changes in 5 phased groups after approval. Zero production downtime expected. All changes are file-editable and revertible.

---

# 1. Current Architecture Map

## 1.1 CI Trigger Graph

```
                     ┌──────────────────────────────┐
                     │         EVENT SOURCE          │
                     └──────────┬───────────────────┘
                                │
          ┌─────────────────────┼────────────────────────┐
          │                     │                        │
    push main/master/dev    PR to main/master/dev    tag v* / manual
    (paths-ignore: docs,md) (paths-ignore: docs,md)      │
          │                     │                        │
          ▼                     ▼                        ▼
    ┌──────────┐         ┌──────────┐           ┌──────────────┐
    │  ci.yml  │         │  ci.yml  │           │ release-     │
    │          │         │  +       │           │ deploy.yml   │
    │          │         │ security │           └──────────────┘
    │          │         │ .yml     │
    └──────────┘         │(on lock/ │
                         │ Docker   │
                         │ changes) │
                         └──────────┘

    ┌────────────────────────────────────────────────┐
    │             SCHEDULED TRIGGERS                 │
    ├────────────────────────────────────────────────┤
    │  Daily   00:00 UTC  → backup-database.yml     │
    │  Weekly  Sun 03:00  → nightly-health.yml      │
    │  Weekly  Mon 04:00  → security.yml            │
    └────────────────────────────────────────────────┘
```

## 1.2 Job Dependency Graph (`ci.yml`)

```
    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐
    │  backend-tests  │    │ frontend-tests  │    │ backend-lint │
    │  (BLOCKING)     │    │ (BLOCKING)      │    │ (advisory)   │
    └────────┬────────┘    └───────┬─────────┘    └──────────────┘
             │                     │
             │              ┌──────▼──────────┐    ┌──────────────┐
             │              │  frontend-build │    │  lint (ESLint│
             │              │  (BLOCKING)     │    │  advisory)   │
             │              └───────┬─────────┘    └──────────────┘
             │                      │
    ┌────────▼──────────────────────▼──────────────────────────┐
    │                     ci-success                           │
    │  (gate job — checks backend-tests, frontend-tests,      │
    │   frontend-build as required; lint jobs as advisory)     │
    └───────────────────────────┬──────────────────────────────┘
                                │
         ┌──────────────────────┤ (label-gated)
         │                      │
    ┌────▼─────────┐     NO BRANCH PROTECTION
    │  e2e-tests   │     enforces ci-success
    │  (advisory)  │
    │  needs:      │
    │  backend-    │
    │  tests +     │
    │  frontend-   │
    │  build       │
    └──────────────┘
```

## 1.3 Blocking vs Advisory Classification

| Job | Type | Failure Impact |
|---|---|---|
| `backend-tests` | **BLOCKING** | ci-success fails → PR should not merge (but no branch protection enforces this) |
| `frontend-tests` | **BLOCKING** | Same |
| `frontend-build` | **BLOCKING** | Same |
| `backend-lint` | Advisory | Warning only. `continue-on-error: true` |
| `lint` (ESLint) | Advisory | Warning only. Currently always fails (deps missing) |
| `e2e-tests` | Advisory + gated | Only runs with `run-e2e` label. `continue-on-error: true` |
| `ci-success` | **GATE** | Intended as branch protection check. NOT enforced. |

## 1.4 Artifact Flow Map

```
    ci.yml
    ├── backend-coverage     → htmlcov/       (7-day retention)
    ├── frontend-coverage    → coverage/      (7-day retention)
    ├── frontend-build       → dist/          (7-day retention)
    └── e2e-report           → playwright-report/ (7-day retention)

    backup-database.yml
    └── database-backup-{ts} → backups/       (90-day retention)

    release-deploy.yml
    └── (no artifacts uploaded — builds are ephemeral)
```

## 1.5 Secret Flow Map

```
    ┌──────────────────────────────────────────────────────────────────┐
    │                    GITHUB SECRETS                               │
    ├──────────────────────────────────────────────────────────────────┤
    │  ADMIN_USERNAME    → backup-database.yml, nightly-health.yml,  │
    │                      release-deploy.yml                         │
    │  ADMIN_PASSWORD    → backup-database.yml, nightly-health.yml,  │
    │                      release-deploy.yml                         │
    │  BACKEND_URL       → backup-database.yml, nightly-health.yml,  │
    │                      release-deploy.yml                         │
    │  VITE_API_URL      → ci.yml (fallback to localhost),           │
    │                      release-deploy.yml (⚠️ fallback to PROD)  │
    └──────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────┐
    │                    HARDCODED TEST SECRETS                       │
    ├──────────────────────────────────────────────────────────────────┤
    │  SECRET_KEY = test-secret-key-for-ci  → ci.yml, release-deploy │
    │  (Acceptable — test-only value, no production use)             │
    └──────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────┐
    │              ⚠️ HISTORICAL EXPOSURE (IN GIT HISTORY)           │
    ├──────────────────────────────────────────────────────────────────┤
    │  .env (commits: eb2dbbc, 3a69d6c, 774be13, 0596c39, 714eb57,  │
    │        03b1da2) — contains SECRET_KEY, ADMIN_PASSWORD          │
    │  scripts/smoke_test.sh (commits: b993e84, 53ca3a4) — contains  │
    │        hardcoded 'admin420' default password                    │
    └──────────────────────────────────────────────────────────────────┘
```

## 1.6 Backup Lifecycle Map

```
    Daily 00:00 UTC (backup-database.yml)
    │
    ▼
    Login to Render API (ADMIN_USERNAME/ADMIN_PASSWORD)
    │
    ▼
    POST /api/admin/backup-now  →  Server creates SQLite backup file
    │
    ▼
    Download backup file via API
    │
    ├─ SUCCESS: Upload as GitHub Artifact (90-day retention, max compress)
    │
    └─ FAIL MODES:
       ├─ Login fails        → exit 1 ✅ (fixed)
       ├─ Backup create fails → exit 1 ✅ (fixed)
       ├─ Download empty      → ⚠️ writes backup_failed.log, does NOT exit 1
       └─ Download succeeds   → No size validation, no integrity check
                                (Only done weekly in nightly-health.yml)

    Weekly validation (nightly-health.yml):
    │
    ▼
    Download fresh backup → PRAGMA integrity_check → Table row counts
    │
    ├─ Missing: Minimum size check (empty DB passes)
    ├─ Missing: Zero-row detection (valid but empty DB passes)
    └─ Missing: Freshness check (stale backup not detected)
```

## 1.7 Render Deployment Path

```
    Developer pushes to main
    │
    ▼
    GitHub triggers ci.yml
    │                              
    │  (SIMULTANEOUSLY)            
    │                              
    ▼                              
    Render detects push to main ──────► Render builds + deploys
    │                                    │
    │  NO GATE between CI and deploy     │
    │  CI may still be running when      │
    │  Render deploys                    │
    │                                    ▼
    │                              Frontend: npm ci → vite build → nginx
    │                              Backend:  pip install → gunicorn start
    │                                    │
    │                                    ▼
    │                              LIVE IN PRODUCTION
    │
    ▼
    ci.yml finishes (pass or fail)
    │
    └─ ⚠️ By this time, Render may have already deployed
       (no rollback trigger on CI failure)
```

## 1.8 Rollback Path

```
    SCENARIO: Bad deploy detected
    │
    ├─ Option A: Render Dashboard → Manual rollback to previous deploy
    │            (fastest: ~2 min)
    │
    ├─ Option B: git revert <bad-commit> && git push main
    │            (triggers new CI + new Render deploy: ~5 min)
    │
    ├─ Option C: git push --force-with-lease origin <known-good>:main
    │            (⚠️ DANGEROUS — force push, rewrites history)
    │
    └─ DATABASE: No automated rollback
                 Manual: download artifact → scp/API upload → restart
                 ⚠️ No point-in-time recovery
                 ⚠️ No WAL-mode backup (SQLite)
```

## 1.9 Release Path

```
    git tag v1.x.x && git push --tags
    │
    ▼
    release-deploy.yml triggers
    │
    ├─ validate (pytest + vitest + vite build)
    │  │
    │  └─ ⚠️ VITE_API_URL fallback is prod URL
    │
    ├─ create-release (changelog from git log → GitHub Release)
    │
    └─ post-deploy-smoke
       │
       ├─ Wait 120s for Render deploy
       ├─ Health check (5 retries, 30s gaps)
       ├─ Auth check
       └─ Endpoint count check (/clientes, /productos)

    ⚠️ Tag push also pushes to main → triggers ci.yml simultaneously
    ⚠️ No approval gate between validate and create-release
    ⚠️ skip_tests=true bypasses all validation with no audit trail
```

## 1.10 Smoke Test Path

```
    LOCAL (scripts/smoke_test.sh — gitignored):
    │
    ├─ Requires: API_USER, API_PASS env vars (mandatory, no defaults)
    ├─ Target: API_URL (default: https://api.pedidosfriosur.com)
    ├─ Tests: auth, CRUD, concurrency (5 parallel pedidos), security, health
    └─ ⚠️ Creates real pedidos in production (no cleanup step)

    CI SMOKE (release-deploy.yml post-deploy-smoke):
    │
    ├─ Uses: BACKEND_URL, ADMIN_USERNAME, ADMIN_PASSWORD secrets
    ├─ Health check with retries
    ├─ Auth verification
    └─ Endpoint count check (read-only — safer than local script)

    CI SMOKE (nightly-health.yml prod-smoke):
    │
    ├─ Health endpoint only
    ├─ Login endpoint reachability (no actual auth)
    └─ Handles Render cold-start gracefully
```

---

# 2. Risk Classification (Re-validated)

## CRITICAL

### C1 — Secrets Permanently in Git History

| Aspect | Detail |
|---|---|
| **What fails** | Credential confidentiality |
| **What breaks** | If repo is ever leaked/forked/public, all historical secrets are exposed |
| **Commits** | `.env`: eb2dbbc, 3a69d6c, 774be13, 0596c39, 714eb57, 03b1da2, 4ff2048, 753d5e6; `smoke_test.sh`: b993e84, 53ca3a4 |
| **Exposed values** | `SECRET_KEY`, `ADMIN_PASSWORD`, hardcoded `admin420` |
| **Who is impacted** | All production users (full admin access if credentials not rotated) |
| **Blast radius** | **Total** — admin access = read/write/delete all data, backup access, user management |
| **Detection speed** | Undetectable unless someone runs `git log --all -p -- .env` |
| **Recovery path** | BFG Repo Cleaner or `git filter-repo` to rewrite history + force push + credential rotation + GitHub support to clear caches |
| **Time to mitigate** | 2-4 hours (history rewrite) + immediate credential rotation |
| **Status since V2 audit** | **Still applies — no action taken** |

### C2 — E2E Tests Silently Hit Production Instead of Localhost

| Aspect | Detail |
|---|---|
| **What fails** | E2E test isolation |
| **What breaks** | CI E2E tests run against live `https://chorilocal.onrender.com` instead of local `localhost:5173` |
| **Root cause** | `ci.yml` E2E job sets `BASE_URL: http://localhost:5173` but `playwright.config.ts` reads `PLAYWRIGHT_URL`. Variable name mismatch. Defaults to `https://chorilocal.onrender.com` |
| **Who is impacted** | Production users (tests may create/modify real data), CI accuracy (tests may pass against stale prod data) |
| **Blast radius** | **High** — E2E tests include CRUD operations (create pedidos, modify data). If run against prod, they mutate live data |
| **Detection speed** | Slow — tests would appear to pass. Only detectable by checking network targets in test output |
| **Recovery path** | Fix env var name: `BASE_URL` → `PLAYWRIGHT_URL` |
| **Time to mitigate** | 30 seconds (1 line change) |
| **Status since V2 audit** | **Still applies — not yet fixed (uncommitted)** |

## HIGH

### H1 — No Branch Protection Enforced

| Aspect | Detail |
|---|---|
| **What fails** | Change governance |
| **What breaks** | Anyone with write access can push directly to `main`, bypassing CI entirely |
| **Who is impacted** | All production users — untested code goes live via Render auto-deploy |
| **Blast radius** | **Total** — broken code deploys to production within minutes |
| **Detection speed** | Fast (monitoring/smoke would catch) but damage already done |
| **Recovery path** | Render manual rollback + git revert |
| **Time to mitigate** | 5 minutes (GitHub Settings → Branch protection → require `ci-success`) |
| **Governance gap** | `ci-success` job exists specifically as a gate, but nothing enforces it |

### H2 — Missing `permissions` Block in `ci.yml`

| Aspect | Detail |
|---|---|
| **What fails** | Principle of least privilege |
| **What breaks** | All jobs run with default `write` permissions to contents, packages, deployments, etc. |
| **Blast radius** | Compromised action/dependency could write to repo, create releases, modify packages |
| **Recovery path** | Add `permissions: contents: read` at workflow top-level |
| **Time to mitigate** | 2 lines |

### H3 — Missing `permissions` Block in `backup-database.yml`

| Aspect | Detail |
|---|---|
| Same as H2 but for backup workflow | Only needs `contents: read` |

### H4 — Missing `permissions` Block in `nightly-health.yml`

| Aspect | Detail |
|---|---|
| Same as H2 but for health check workflow | Only needs `contents: read` |

### H5 — `release-deploy.yml` VITE_API_URL Defaults to Production

| Aspect | Detail |
|---|---|
| **What fails** | CI build isolation |
| **What breaks** | CI validate job builds frontend with `https://api.pedidosfriosur.com/api` baked in. If the secret `VITE_API_URL` is not set, CI validation builds point to prod |
| **Implicit trust** | Assumes `VITE_API_URL` secret is always set. If deleted or misconfigured, fallback silently switches CI builds to target production |
| **Blast radius** | Medium — CI doesn't call prod (it builds only), but validates against wrong assumptions |
| **Recovery path** | Change fallback to `http://localhost:8000/api` (already done in ci.yml, not yet in release-deploy.yml) |

### H6 — ESLint Silently Broken (Deps Not in `package.json`)

| Aspect | Detail |
|---|---|
| **What fails** | Frontend code quality gate |
| **What breaks** | `eslint.config.js` imports 4 packages (`@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) not declared in `devDependencies`. `npm ci` doesn't install them. Lint always fails. Hidden by `continue-on-error`. |
| **Blast radius** | Low immediate (advisory), but team believes lint is running when it isn't |
| **Detection speed** | Never detected — job always shows ⚠️ which team ignores |
| **Recovery path** | Add 4 packages to `frontend/package.json` `devDependencies` |

### H7 — Backup Download Doesn't Fail on Empty File

| Aspect | Detail |
|---|---|
| **What fails** | Backup integrity assurance |
| **What breaks** | If backup download succeeds but file is empty (0 bytes), workflow writes `backup_failed.log` but does NOT `exit 1`. Artifact is uploaded containing only the failure log. Team sees green check. |
| **Blast radius** | Medium — team believes backup succeeded. 90-day retention. If they need to restore, they find an empty backup. |
| **Detection speed** | Only detected during restore (which could be weeks/months later) |
| **Recovery path** | Add `exit 1` after empty file detection in `backup-database.yml` |

## MEDIUM

### M1 — `ruff` Not Pinned

| Aspect | Detail |
|---|---|
| **What fails** | Lint reproducibility |
| **What breaks** | New ruff release could change rules, add new errors, or have breaking changes. CI would suddenly start behaving differently. |
| **Recovery path** | Pin to `ruff==0.9.7` |

### M2 — Backend Tests Run Twice (Double pytest Invocation)

| Aspect | Detail |
|---|---|
| **What fails** | CI efficiency |
| **What breaks** | `backend-tests` runs `pytest tests/ -v --tb=short` then immediately re-runs with `pytest tests/ --cov`. Wastes 30-60s of CI time. |
| **Recovery path** | Merge into single: `pytest tests/ -v --tb=short --cov=. --cov-report=xml --cov-report=html --junitxml=test-results.xml` |

### M3 — No Concurrency Groups on CI

| Aspect | Detail |
|---|---|
| **What fails** | Runner efficiency, queue management |
| **What breaks** | Rapid pushes to same branch queue multiple CI runs. Old runs continue to completion even though they're superseded. |
| **Recovery path** | Add `concurrency: group: ci-${{ github.ref }}` + `cancel-in-progress: true` |

### M4 — `python-jose` CVE (CVE-2024-33663)

| Aspect | Detail |
|---|---|
| **What fails** | JWT security |
| **What breaks** | Known vulnerability in ECDSA signature verification. Unmaintained library. |
| **Who is impacted** | `pip-audit` reports it. Security scanners flag it. |
| **Recovery path** | Replace with `pyjwt` (backend code change, not CI) |

### M5 — Coverage Regression Invisible

| Aspect | Detail |
|---|---|
| **What fails** | Code quality gate |
| **What breaks** | Both backend and frontend coverage steps have `continue-on-error: true`. Coverage can drop to 0% with no alert. |
| **Recovery path** | Remove `continue-on-error` or add minimum threshold enforcement |

### M6 — No Backup Minimum Size Check (nightly-health.yml)

| Aspect | Detail |
|---|---|
| **What fails** | Backup validity |
| **What breaks** | A valid but empty SQLite DB (~4KB) passes `PRAGMA integrity_check`. Real production backup should be >10KB minimum. |
| **Recovery path** | Add `stat -c%s` check, fail if < 10240 bytes |

### M7 — No Zero-Row Detection in Restore Verify

| Aspect | Detail |
|---|---|
| **What fails** | Backup content validation |
| **What breaks** | A structurally valid but data-empty DB passes all current checks. If `usuarios` table has 0 rows, backup is useless for restore. |
| **Recovery path** | Add `SELECT COUNT(*) FROM usuarios`, fail if 0 |

### M8 — E2E Missing `ENVIRONMENT`/`DB_PATH` Env Vars

| Aspect | Detail |
|---|---|
| **What fails** | E2E backend startup |
| **What breaks** | E2E job starts backend with only `SECRET_KEY`. Missing `ENVIRONMENT=test` and `DB_PATH=/tmp/test_e2e_ventas.db`. Backend may try to use production-mode validation or default DB path. |
| **Recovery path** | Add 2 env vars to E2E backend start step |

## LOW

### L1 — Root `Dockerfile` is Legacy Artifact

| Aspect | Detail |
|---|---|
| **What** | Root `Dockerfile` uses Node 18, `npm install` (not `npm ci`), references root `requirements.txt`. Not used by Render (which uses `backend/Dockerfile` and `frontend/Dockerfile`). |
| **Risk** | Confusion. A developer may accidentally build from root. |
| **Recovery** | Delete or rename to `Dockerfile.legacy` |

### L2 — `origin/HEAD → master` but Deploy from `main`

| Aspect | Detail |
|---|---|
| **What** | Default branch on GitHub remote is `master` but Render deploys from `main`. CI triggers on both. |
| **Risk** | Confusion. `git clone` checks out `master`. Developer works on wrong branch. |
| **Recovery** | `git remote set-head origin main` + set GitHub default branch to `main` |

### L3 — No Concurrency Group on Backup Workflow

| Aspect | Detail |
|---|---|
| **What** | Manual + scheduled backup can overlap |
| **Risk** | Two simultaneous backups could cause API contention |
| **Recovery** | Add `concurrency: group: database-backup` with `cancel-in-progress: false` |

### L4 — Frontend `npm ci` Runs Twice in CI

| Aspect | Detail |
|---|---|
| **What** | `frontend-tests` and `frontend-build` both run `npm ci`. Build depends on tests, runs sequentially. |
| **Risk** | ~20s wasted per CI run |
| **Recovery** | Merge into single job or cache `node_modules` across jobs |

## INFORMATIONAL

### I1 — No Flaky Test Tracking

| Aspect | Detail |
|---|---|
| **What** | No mechanism to detect intermittently failing tests |
| **Current** | Backend: no retries. Frontend vitest: no retries. E2E Playwright: 2 retries in CI (good). |
| **Impact** | Flaky tests either block CI (false negatives) or are ignored (false confidence) |

### I2 — Artifact Retention is 7 Days for CI, 90 Days for Backups

| Aspect | Detail |
|---|---|
| **What** | Coverage reports and build artifacts expire after 7 days. Backups after 90 days. |
| **Risk** | After 90 days, backup history is lost. No long-term archive strategy. |
| **Mitigation** | Acceptable for hobby tier. Consider S3/B2 for long-term if growth warrants it. |

### I3 — `smoke_test.sh` Creates Real Production Data

| Aspect | Detail |
|---|---|
| **What** | Local smoke script creates pedidos in production (no cleanup/teardown) |
| **Risk** | Test data accumulates in production DB |
| **Mitigation** | Add cleanup step or use dedicated test user with flagged data |

### I4 — `detect-secrets` Excludes All `.lock` Files

| Aspect | Detail |
|---|---|
| **What** | Security workflow excludes `*.lock` from secret scanning |
| **Risk** | Low — unlikely to contain secrets. Could mask edge cases. |

---

# 3. Governance Alignment Review

| Governance Principle | Current State | Gap | Severity |
|---|---|---|---|
| **Least privilege (permissions)** | `ci.yml`, `backup-database.yml`, `nightly-health.yml` lack `permissions` block → default full `write` | 3 workflows over-privileged | **High** |
| **Branch protection** | `ci-success` gate job exists but NO GitHub branch protection rule requires it. Direct push to `main` is possible. | No enforcement | **High** |
| **Required status checks** | None configured in GitHub. `ci-success` is advisory-only in practice. | No enforcement | **High** |
| **Concurrency control** | No `concurrency` groups on any workflow. Stale runs consume resources. | Missing | **Medium** |
| **Skip-tests bypass audit** | `release-deploy.yml` has `skip_tests: true` input. No audit trail of who used it or why. | No accountability | **Medium** |
| **Change approval gating** | No required reviewers. No CODEOWNERS file. Anyone with write access can merge. | No review enforcement | **High** |
| **Production promotion gate** | Render auto-deploys on push to `main`. No manual approval between CI pass and production deploy. | No gate | **High** |
| **Artifact immutability** | GitHub Artifacts are overwrite-safe by default (timestamped names). | OK | — |
| **Secret rotation enforcement** | No policy. No expiration tracking. Secrets in history are not rotated. | No rotation | **Critical** |
| **Backup minimum-size enforcement** | Not implemented. | Missing | **Medium** |
| **Zero-row detection in restore** | Not implemented. | Missing | **Medium** |
| **Production read-only validation** | CI E2E tests could write to production (C2). Smoke test creates data (I3). No read-only mode. | Missing | **High** |
| **CODEOWNERS** | No `CODEOWNERS` file exists. | Missing | **Medium** |
| **Dependabot / Renovate** | No automated dependency update mechanism. | Missing | **Low** |

---

# 4. Phased Hardening Plan

## Phase 0 — Zero-Risk Line Changes

> **Risk:** None. Single-line or 2-line fixes. Fully reversible. No behavior change for passing pipelines.

| ID | Change | File | Lines | Why Safe | Failure Mode | Rollback |
|---|---|---|---|---|---|---|
| P0.1 | Fix `BASE_URL` → `PLAYWRIGHT_URL` | `ci.yml` L215 | 1 | Correct env var name match | None — currently broken | Revert line |
| P0.2 | Add `ENVIRONMENT: test`, `DB_PATH: /tmp/test_e2e_ventas.db` to E2E backend start | `ci.yml` L206-208 | 2 | Adds required env config | None — currently missing | Remove 2 lines |
| P0.3 | Add `permissions: contents: read` | `ci.yml` top | 2 | Restricts from default write | Job may fail if it writes (it doesn't) | Remove 2 lines |
| P0.4 | Add `permissions: contents: read` | `backup-database.yml` top | 2 | Same | Same | Same |
| P0.5 | Add `permissions: contents: read` | `nightly-health.yml` top | 2 | Same | Same | Same |
| P0.6 | Fix VITE_API_URL fallback to localhost | `release-deploy.yml` validate job | 1 | Matches ci.yml pattern | None — build uses correct URL | Revert line |

**Total: ~10 lines across 4 files. Zero behavioral risk.**

## Phase 1 — CI Reliability Corrections

> **Risk:** Low. Changes to CI efficiency and output. No production impact.

| ID | Change | File | Lines | Why Safe | Failure Mode | Rollback |
|---|---|---|---|---|---|---|
| P1.1 | Merge dual pytest into single invocation with `--cov` + `--junitxml` | `ci.yml` backend-tests | ~10 | Same tests, same results, single run | If syntax error in pytest args, CI fails (detectable immediately) | Revert to 2-step |
| P1.2 | Pin `ruff==0.9.7` | `ci.yml` backend-lint | 1 word | Prevents surprise breakage | None — pins to known working version | Unpin |
| P1.3 | Add `concurrency` group to ci.yml | `ci.yml` top | 3 | Cancels superseded runs only | None — adds efficiency | Remove 3 lines |
| P1.4 | Add `concurrency` group to backup-database.yml | `backup-database.yml` top | 3 | Prevents overlapping manual+scheduled runs | `cancel-in-progress: false` ensures running backups complete | Remove 3 lines |

**Total: ~17 lines. Low behavioral risk. CI efficiency improvement.**

## Phase 2 — Security Hardening

> **Risk:** Medium. Requires coordination. Some changes are outside CI (backend code, git history).

| ID | Change | Type | Effort | Why Safe | Failure Mode | Rollback |
|---|---|---|---|---|---|---|
| P2.1 | Rotate `SECRET_KEY` and `ADMIN_PASSWORD` in Render | Render Dashboard | 5 min | Old secrets in history become invalid | If wrong value entered, login fails → rollback in Render | Restore old value |
| P2.2 | Run BFG Repo Cleaner to purge `.env` and `smoke_test.sh` from history | Git operation | 1-2h | Rewrites history — requires force push and team coordination | All forks/clones must re-clone. Old PRs may break. | Cannot un-force-push (irreversible, but old secrets already exposure-mitigated by rotation) |
| P2.3 | Replace `python-jose` with `pyjwt` | Backend code | 1-2h | API-compatible for HS256 usage | If import paths differ, backend crashes → detectable in CI | Revert code change |
| P2.4 | Add ESLint deps to `frontend/package.json` | Frontend config | 4 lines | Makes lint actually work | If versions mismatch, lint fails (advisory anyway) | Remove lines |
| P2.5 | Add `CODEOWNERS` file | Repo root | New file | Requires review from specified owners | If misconfigured, blocks PRs → remove file | Delete file |
| P2.6 | Request GitHub support to clear cached secrets after BFG | GitHub Support ticket | 1 day | Cleans server-side git cache | No risk — support handles it | N/A |

**Phase 2 requires approval and coordination. NOT a "just commit it" phase.**

## Phase 3 — Deployment Control

> **Risk:** Medium. Changes to deployment governance. Requires GitHub admin access.

| ID | Change | Type | Effort | Why Safe | Failure Mode | Rollback |
|---|---|---|---|---|---|---|
| P3.1 | Enable branch protection on `main` | GitHub Settings | 5 min | Enforces `ci-success` as required check | If CI is broken, blocks all merges → disable rule | Toggle off |
| P3.2 | Require at least 1 reviewer for PRs to `main` | GitHub Settings | 2 min | Enforces review | Over-strict for solo dev → set to 0 | Toggle off |
| P3.3 | Set GitHub default branch to `main` | GitHub Settings | 1 min | Fixes `origin/HEAD → master` confusion | None | Set back to master |
| P3.4 | Consider tag-only Render deploy | Render Settings | 10 min | Prevents accidental main-push deploys | Requires manual tag for every deploy — slower iteration | Revert to branch deploy |
| P3.5 | Add `skip_tests` audit trail | `release-deploy.yml` | 5 lines | Outputs who triggered and why to Step Summary | None — informational only | Remove lines |

## Phase 4 — Resilience Improvements

> **Risk:** Very low. Adds validation checks that don't change existing behavior.

| ID | Change | File | Lines | Why Safe | Failure Mode | Rollback |
|---|---|---|---|---|---|---|
| P4.1 | Add minimum backup size check (≥10KB) | `nightly-health.yml` | 5 | Fails on suspicious small backups | If legitimate small backup exists (<10KB), false alarm → adjust threshold | Remove check |
| P4.2 | Add zero-row detection (`usuarios` table) | `nightly-health.yml` | 6 | Fails if backup has no user data | If `usuarios` table doesn't exist (schema change), fails → update query | Remove check |
| P4.3 | Add `exit 1` on empty backup download | `backup-database.yml` | 1 | Currently silently continues | None — makes failure explicit | Remove exit |
| P4.4 | Add JUnit XML upload for backend tests | `ci.yml` | 5 | Enables GitHub test annotations | If upload fails, advisory only | Remove step |

**Total: ~17 lines. Near-zero behavioral risk. Improves detection and observability.**

---

# 5. Advanced Pipeline Recommendations

| Recommendation | Why Companies Use It | When Worth It | Cost vs Benefit | Complexity | Governance Maturity Required |
|---|---|---|---|---|---|
| **SAST (Semgrep/CodeQL)** | Find code-level vulnerabilities before merge | Now — already partially done via CodeQL | Free (GitHub) / Medium benefit | Low (already set up) | Low |
| **DAST (ZAP/Nuclei)** | Find runtime vulnerabilities in deployed app | When staging environment exists | Medium cost (CI time) / High benefit | Medium | Medium |
| **Container Scanning (Trivy)** | Find CVEs in Docker base images | Now — 2 production Dockerfiles | Free / High benefit | Low (add step) | Low |
| **SBOM Generation (Syft/CycloneDX)** | Supply chain transparency, license compliance | When regulated or enterprise customers require it | Free / Low immediate benefit | Low | Low |
| **License Compliance** | Avoid GPL/proprietary conflicts | When distributing software or enterprise sales | Low cost / Low-medium benefit | Low | Low |
| **Artifact Signing (cosign)** | Tamper-proof releases | When compliance requires provenance guarantees | Low cost / Low benefit for hobby | Medium | High |
| **Tag Immutability** | Prevent re-tagging to different commits | When multiple people tag releases | Free (GitHub setting) / Medium benefit | Very Low | Low |
| **Canary Smoke Testing** | Gradual rollout verification | When on a platform supporting traffic splitting (not Render hobby) | High cost / High benefit | High | High |
| **Backup Restore Rehearsal** | Automated monthly restore-to-temp validation | Now — already partially done weekly | Free / High benefit | Low (extend existing) | Low |
| **Schema Drift Detection** | Detect unintended DB schema changes | When multiple developers modify models | Medium cost / Medium benefit | Medium | Medium |
| **CI Performance Regression** | Detect CI getting slower over time | When CI times exceed 5+ minutes | Low cost / Low benefit | Low | Low |
| **Flaky Test Tracker** | Track and quarantine intermittent failures | When flaky tests block CI regularly | Medium cost / Medium benefit | Medium | Medium |
| **Release Approval Gate** | Manual approval before production deploy | Now — critical governance gap | Free (GitHub Environments) | Low | Medium |
| **Manual Production Promotion** | Explicit "deploy to prod" step | When mistakes have high business impact | Free / High benefit | Medium | High |
| **Infra Drift Detection (driftctl)** | Detect manual Render changes diverging from IaC | When render.yaml is source of truth | Medium cost / Medium benefit | Medium | Medium |
| **Secret Expiration Enforcement** | Auto-rotate or alert on old secrets | When team grows or compliance requires it | Medium cost / High benefit | High | High |

### Highest-ROI Recommendations for Current Stage:

1. **Container Scanning (Trivy)** — Add 1 step to security.yml. Free. Catches CVEs in python:3.11-slim and nginx:alpine.
2. **Release Approval Gate** — Use GitHub Environments with required reviewers. Free. Prevents accidental production deploys.
3. **Backup Restore Rehearsal** — Already 80% done in nightly-health.yml. Just need size+row validation (Phase 4).
4. **Tag Immutability** — GitHub setting. 1 minute to enable.

---

# 6. Render AutoDeploy Risk Analysis

## 6.1 Current Configuration

```yaml
# render.yaml
autoDeploy: true
branch: main
```

Both services (backend + frontend) auto-deploy from `main` on every push.

## 6.2 Risk Assessment

| Risk | Severity | Detail |
|---|---|---|
| **CI bypass via direct push** | **Critical** | Without branch protection, `git push origin main` deploys immediately. CI may not even start or finishes after deploy is live. |
| **Failed CI still deploys** | **High** | Render doesn't wait for CI. A push that fails CI tests is still deployed. |
| **Accidental force push** | **High** | `git push --force main` rewrites production history. Render deploys the new HEAD. |
| **Render builds with stale cache** | **Low** | Render caches Docker layers. A cached layer with old code may slip through. `--no-cache` is not configurable in hobby tier. |
| **Deploy during backup** | **Medium** | If deploy happens during daily backup (00:00 UTC), backend restart interrupts the backup API call. |

## 6.3 Recommended Branch Protection Model

```
    main (protected)
    │
    ├── Required status checks: ci-success
    ├── Required reviewers: 1 (or 0 for solo dev)
    ├── Dismiss stale reviews on new commits: yes
    ├── Require linear history: optional
    ├── Restrict force pushes: ALWAYS
    ├── Restrict deletions: ALWAYS
    └── Include administrators: YES (even admins follow rules)
```

## 6.4 Is Tag-Only Deploy Safer?

| Aspect | Branch Deploy (current) | Tag-Only Deploy |
|---|---|---|
| **Speed** | Fast — push to main = deploy | Slower — requires tagging |
| **Safety** | Low — no gate | Higher — explicit "I want to deploy" intent |
| **Rollback** | Push revert | Push old tag (or Render dashboard) |
| **CI integration** | CI runs in parallel with deploy (no gate) | Tag triggers CI first, then deploy (if configured) |
| **Render support** | ✅ `branch: main` | ⚠️ Render auto-deploy only supports branches, not tags. Would need API deploy hook. |

**Verdict:** Tag-only deploy is **not natively supported** by Render hobby tier. Branch protection + required status checks is the pragmatic solution.

## 6.5 Staging/Preview Environments

| Type | Feasibility on Render | Cost | Recommendation |
|---|---|---|---|
| **Staging environment** | Possible (separate Render services) | $14/mo (2x hobby) | Recommended if revenue justifies it |
| **Preview environments** | Render supports PR previews | $7/mo per preview | Useful but costly for hobby tier |
| **Local staging** | Free (docker-compose.yml exists) | $0 | Use `docker-compose.local.yml` for integration testing |

**Verdict:** For current scale (hobby tier, single developer), **local staging via docker-compose + branch protection + CI gate** is the pragmatic minimum. Render preview environments are a nice-to-have.

## 6.6 Production Promotion Pipeline (Future)

```
    Feature Branch → PR → CI passes → Merge to main
                                          │
                                    ┌─────▼──────┐
                                    │ Render auto │
                                    │ deploy      │
                                    └─────┬──────┘
                                          │
                               Current: IMMEDIATELY LIVE
                                          │
                        ────────────────────────────────────
                               Future (with Environment):
                                          │
                                    ┌─────▼──────┐
                                    │ GitHub      │
                                    │ Environment │
                                    │ "prod"      │
                                    │ (requires   │
                                    │  approval)  │
                                    └─────┬──────┘
                                          │
                                    Manual approval
                                          │
                                    Deploy trigger
                                    (Render Deploy Hook API)
```

**Not recommended yet** for single-developer team. Branch protection is sufficient.

---

# 7. Production Readiness Scorecard

| Category | Score | Explanation |
|---|---|---|
| **CI Reliability** | **5/10** | Core tests run and gate ci-success. But: E2E env var broken (C2), backend tests run twice (M2), ESLint silently dead (H6), no JUnit XML upload, no concurrency groups, no flaky test tracking. |
| **Security Posture** | **3/10** | CodeQL and dependency scanning exist (good). But: secrets in git history (C1), no credential rotation, python-jose CVE (M4), no container scanning, no SBOM, permissions over-scoped (H2-H4). |
| **Deployment Safety** | **4/10** | Render auto-deploy works reliably. But: no branch protection (H1), no required status checks, no promotion gate, CI and deploy race condition, VITE_API_URL prod fallback (H5), skip_tests bypass without audit trail. |
| **Secret Hygiene** | **2/10** | Secrets are in GitHub Secrets (good). But: historical exposure in git (C1), no rotation policy, no expiration enforcement, .env was committed 6+ times, smoke_test.sh hardcoded password in history. |
| **Governance Maturity** | **2/10** | No branch protection, no CODEOWNERS, no required reviewers, no approval gates, no audit trail for skip_tests, no change control documentation, no incident response runbook. |
| **Backup Resilience** | **6/10** | Daily automated backup (good), 90-day artifact retention (good), weekly integrity check (good). But: no size validation (M6), no zero-row detection (M7), empty download doesn't fail (H7), no long-term archive, no point-in-time recovery, no backup encryption. |
| **Observability** | **5/10** | Sentry for error tracking (good), structlog for structured logging (good), health endpoint (good), CI Step Summaries (good). But: no coverage trend tracking, no CI performance monitoring, no deployment tracking dashboard, no alert on backup failure (only GitHub can notify on workflow failure). |
| **Recovery Readiness** | **4/10** | Render manual rollback available (good), backup artifacts downloadable (good). But: no automated rollback trigger, no documented recovery runbook, no backup restore rehearsal validation (size/rows), no DB point-in-time recovery, no tested disaster recovery procedure. |

### Overall Production Readiness Score: **5.1 / 10**

**Interpretation:** The system functions and serves production traffic. Basic CI and backup mechanisms exist. However, governance is immature — there's no enforcement of the rules that exist. A single mistake (direct push to main, accidental secret exposure, empty backup not detected) could have outsized impact.

**Target after Phase 0-1:** 6.5/10
**Target after Phase 0-4:** 7.5/10
**Target with advanced recommendations:** 8.5+/10

---

# 8. Controlled Implementation Strategy

## 8.1 How Changes Should Be Introduced

```
    1. Create feature branch: git checkout -b ci/hardening-phase-0
    2. Apply Phase 0 changes (zero-risk)
    3. Validate YAML: python3 -c "import yaml; yaml.safe_load(open(f))" for each file
    4. Self-review diff: git diff --stat && git diff
    5. Commit: git commit -m "ci: phase 0 — fix env vars, add permissions, fix fallback"
    6. Push branch: git push origin ci/hardening-phase-0
    7. Open PR to main
    8. Verify CI runs and passes on the PR
    9. Manually verify: E2E env var correct, permissions block present, fallback correct
    10. Merge PR (NOT direct push)
    11. Monitor Render deploy
    12. Verify daily backup still works (next day or manual trigger)
    13. Proceed to Phase 1
```

## 8.2 PR Order

| Order | PR | Contains | Depends On |
|---|---|---|---|
| 1 | `ci/hardening-phase-0` | P0.1-P0.6 (env fixes, permissions, fallback) | Nothing |
| 2 | `ci/hardening-phase-1` | P1.1-P1.4 (single pytest, pin ruff, concurrency) | PR 1 merged |
| 3 | `ci/hardening-phase-4` | P4.1-P4.4 (backup validation, JUnit) | PR 1 merged |
| 4 | `security/phase-2` | P2.1-P2.6 (credential rotation, pyjwt, ESLint, BFG) | PRs 1-3 merged, coordination |
| 5 | `deploy/phase-3` | P3.1-P3.5 (branch protection, default branch) | PRs 1-3 merged |

**Phase 4 before Phase 2** because Phase 4 is low-risk and high-value (backup validation), while Phase 2 requires coordination (BFG, credential rotation).

## 8.3 Manual Testing Sequence

For each PR:

| Step | Test | Expected |
|---|---|---|
| 1 | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` | No error |
| 2 | Same for all modified workflow files | No error |
| 3 | Open PR → watch CI run | ci-success passes |
| 4 | Check Actions tab → verify permissions are restricted | No unexpected write operations |
| 5 | Check Actions tab → verify concurrency cancels stale runs | New push cancels old run |
| 6 | After merge → manual trigger backup-database.yml | Backup completes with artifact |
| 7 | After merge → manual trigger nightly-health.yml | Health check passes, backup verify passes |
| 8 | After merge → verify Render deploy completes | Both services healthy |

## 8.4 Safe Activation Order

```
    Phase 0 (zero risk) ──► merge ──► verify CI + backup ──► Phase 1
                                                              │
    Phase 1 (low risk) ──► merge ──► verify CI timing ──► Phase 4
                                                            │
    Phase 4 (very low risk) ──► merge ──► trigger nightly ──► Phase 2
                                                               │
    Phase 2 (medium risk, coordinated) ──► rotate creds ──► BFG ──► Phase 3
                                                                      │
    Phase 3 (GitHub settings) ──► enable branch protection ──► DONE
```

## 8.5 How to Verify No Production Breakage

| Check | How | When |
|---|---|---|
| Backend health | `curl https://api.pedidosfriosur.com/health` | After each Render deploy |
| Frontend loads | Open `https://pedidosfriosur.com` in browser | After each Render deploy |
| Login works | Test login via UI or curl | After each Render deploy |
| Backup works | Manual trigger `backup-database.yml` or wait for daily cron | After Phase 0/1 merge |
| E2E isolated | Check Playwright output — should show `localhost:5173` as baseURL | After Phase 0 merge (PR CI run) |
| CI gate works | Push a PR with intentionally failing test → verify ci-success fails | After Phase 3 (branch protection) |

## 8.6 How to Validate Backup Integrity

| Check | How |
|---|---|
| Artifact exists | GitHub Actions → latest backup workflow run → Artifacts section |
| Artifact size | Should be >10KB (real DB is typically 100KB-1MB+) |
| SQLite integrity | Download artifact → `sqlite3 backup.db "PRAGMA integrity_check;"` → must output `ok` |
| Row counts | `sqlite3 backup.db "SELECT COUNT(*) FROM usuarios;"` → must be >0 |
| Table schema | `sqlite3 backup.db ".schema"` → should match production schema |

## 8.7 How to Validate E2E Isolation

After Phase 0 merge:
1. Add `run-e2e` label to a test PR
2. Watch the E2E job output
3. Verify Playwright logs show `baseURL: http://localhost:5173` (NOT `https://chorilocal.onrender.com`)
4. Verify backend startup log shows `ENVIRONMENT=test`
5. Verify no network calls to production in trace output

## 8.8 How to Ensure Render Does Not Deploy Prematurely

| Scenario | Mitigation |
|---|---|
| PR merge to main | After Phase 3: branch protection requires ci-success → CI must pass before merge → Render only sees passing code |
| Direct push to main | After Phase 3: branch protection blocks direct pushes |
| Force push | After Phase 3: branch protection restricts force pushes |
| Tag push | release-deploy.yml validate job runs first. But Render still auto-deploys from the main branch commit, not the tag. Tags = GitHub Release only, not Render deploy trigger. |
| Emergency hotfix | Developer must still go through PR (or admin can temporarily disable branch protection) |

---

# Appendix A — Quick-Reference Issue Index

| ID | Severity | Category | Summary | Phase |
|---|---|---|---|---|
| C1 | **Critical** | Security | Secrets in git history (.env, smoke_test.sh) | P2.1-P2.2 |
| C2 | **Critical** | CI | E2E tests hit production (PLAYWRIGHT_URL mismatch) | P0.1 |
| H1 | **High** | Governance | No branch protection on main | P3.1 |
| H2 | **High** | Security | ci.yml missing permissions block | P0.3 |
| H3 | **High** | Security | backup-database.yml missing permissions block | P0.4 |
| H4 | **High** | Security | nightly-health.yml missing permissions block | P0.5 |
| H5 | **High** | Deployment | release-deploy.yml VITE_API_URL prod fallback | P0.6 |
| H6 | **High** | CI | ESLint deps missing, lint is silently dead | P2.4 |
| H7 | **High** | Backup | Empty backup download doesn't fail | P4.3 |
| M1 | **Medium** | CI | ruff not pinned | P1.2 |
| M2 | **Medium** | CI | Backend tests run twice | P1.1 |
| M3 | **Medium** | CI | No concurrency groups | P1.3 |
| M4 | **Medium** | Security | python-jose CVE | P2.3 |
| M5 | **Medium** | CI | Coverage regression invisible | Future |
| M6 | **Medium** | Backup | No minimum size check | P4.1 |
| M7 | **Medium** | Backup | No zero-row detection | P4.2 |
| M8 | **Medium** | CI | E2E missing ENVIRONMENT/DB_PATH | P0.2 |
| L1 | **Low** | Infra | Root Dockerfile is legacy | Future |
| L2 | **Low** | Git | origin/HEAD → master confusion | P3.3 |
| L3 | **Low** | CI | No concurrency on backup workflow | P1.4 |
| L4 | **Low** | CI | Frontend npm ci runs twice | Future |
| I1 | **Info** | CI | No flaky test tracking | Future |
| I2 | **Info** | Backup | 90-day artifact retention | Acceptable |
| I3 | **Info** | Smoke | smoke_test.sh creates production data | Future |
| I4 | **Info** | Security | detect-secrets broad exclusions | Acceptable |

---

# Appendix B — Failure Simulation Matrix

| Scenario | What Happens Today | What Should Happen | Gap |
|---|---|---|---|
| Developer pushes directly to main | Code deploys to production. CI may not have started yet. | Push blocked. Must use PR. CI must pass. | **No branch protection** |
| CI fails but code already merged | Render deployed before CI finished. Production has failing code. | CI must pass before merge. Render only sees tested code. | **No required checks** |
| E2E tests triggered with `run-e2e` label | Tests run against `https://chorilocal.onrender.com` (production). CRUD tests create/modify real data. | Tests run against `localhost:5173`. No production calls. | **Env var mismatch (C2)** |
| Backup download returns empty file | Workflow writes `backup_failed.log`, uploads it as "backup" artifact. Shows green check. | Workflow fails with exit 1. Alert generated. | **Missing exit 1 (H7)** |
| Someone rotates ADMIN_PASSWORD in Render but not in GitHub Secrets | Next backup fails (login fails → exit 1). Next nightly-health fails. | Same — but no preemptive detection of mismatch. | **No secret sync validation** |
| pip-audit finds critical CVE | Advisory only (continue-on-error). Team may not notice. | Block PR or send alert. | **Advisory-only scanning** |
| ruff releases breaking change | CI lint job behavior changes unpredictably | Pin version, upgrade deliberately | **Not pinned (M1)** |
| SQLite DB corrupts in production | No detection until manual check or user report | PRAGMA integrity_check in nightly. But only if backup is recent. | **No real-time corruption detection** |
| Render has outage during backup cron | Login times out → exit 1. Backup fails. No retry. | Retry with backoff. Alert on 2+ consecutive failures. | **No retry logic in backup** |
| Skip_tests used for emergency release | Release created without any validation. No record of who or why. | Audit trail in Step Summary. Alert/notification. | **No audit trail (P3.5)** |

---

# Appendix C — Secret History Exposure Detail

## Files with Secrets in Git History

### `.env` — 8 commits containing this file

| Commit | Date | Content Risk |
|---|---|---|
| `0596c39` | Initial commit | Full .env with all secrets |
| `714eb57` | login v3 | SECRET_KEY visible |
| `03b1da2` | env confusion | SECRET_KEY, possibly ADMIN_PASSWORD |
| `774be13` | DB path fix | DB_PATH + possibly adjacent secrets |
| `3a69d6c` | Auto-commit deploy | Full .env snapshot |
| `eb2dbbc` | Remove from tracking | git rm cached — secrets in diff |
| `4ff2048` | Stop tracking | git rm cached — secrets in diff |
| `753d5e6` | Security cleanup | git rm — secrets visible in diff |

### `scripts/smoke_test.sh` — 2 commits

| Commit | Content Risk |
|---|---|
| `b993e84` | Hardcoded `admin420` as default password |
| `53ca3a4` | Same file with same default |

### Remediation Plan

```
    Step 1: Rotate all exposed credentials IMMEDIATELY
            - SECRET_KEY (Render env var)
            - ADMIN_PASSWORD (Render env var + GitHub Secret)
            - Any other values from .env history
            (This neutralizes the exposure regardless of history cleanup)

    Step 2: Install BFG Repo Cleaner
            $ brew install bfg  (or download .jar)

    Step 3: Create backup of current repo state
            $ git clone --mirror git@github.com:mauropillox/chorilocal.git repo-backup.git

    Step 4: Run BFG to remove sensitive files from history
            $ bfg --delete-files .env repo-backup.git
            $ bfg --delete-files smoke_test.sh repo-backup.git

    Step 5: Clean and push
            $ cd repo-backup.git
            $ git reflog expire --expire=now --all
            $ git gc --prune=now --aggressive
            $ git push --force

    Step 6: Contact GitHub support
            - Request cache/ghost data purge
            - Confirm no residual copies

    Step 7: Notify all collaborators
            - Everyone must re-clone
            - Old branches/forks may retain old history

    ⚠️ This is a DESTRUCTIVE operation. All git SHAs change.
    ⚠️ All existing PRs will break.
    ⚠️ Force push rewrites origin/main and origin/master.
    ⚠️ Do this AFTER all pending work is merged/saved.
```

---

# Appendix D — Implementation Priority Matrix

```
    ┌──────────────────────────────────────────────────────────────┐
    │                  IMPACT (blast radius)                      │
    │                                                              │
    │  HIGH │ C1(SecretHist) │ H1(BranchProt)│                   │
    │       │ C2(E2EProd)    │ H5(ViteURL)   │                   │
    │       │                │ H6(ESLint)    │                   │
    │       │                │ H7(BackupFail)│                   │
    │       │                │               │                   │
    │  MED  │ M4(JoseCVE)   │ M2(DualPytest)│ M3(Concurrency)  │
    │       │ M8(E2EEnv)    │ M6(BackupSize)│ M1(RuffPin)      │
    │       │               │ M7(ZeroRow)   │ M5(CovInvis)     │
    │       │               │               │                   │
    │  LOW  │               │ L2(Branch)    │ L1(RootDocker)   │
    │       │               │ L3(BackupConc)│ L4(DualNpmCi)    │
    │       │               │               │ I1-I4            │
    │       ├───────────────┼───────────────┼──────────────────│
    │       │  HARD/RISKY   │  MODERATE     │  EASY/SAFE       │
    │       │               │               │                   │
    │                  EFFORT TO FIX                              │
    └──────────────────────────────────────────────────────────────┘

    Fix Order:  Top-right first → Top-center → Mid-right → Mid-center
                → Top-left (coordinated) → rest
```

---

# 🛑 DO NOT COMMIT YET 🛑

This document is the complete governance analysis.

**Next steps:**
1. Review this document entirely
2. Ask questions about any risk or recommendation
3. Approve specific phases for implementation
4. Implementation will be done phase-by-phase with verification gates
5. NO files will be modified until explicit approval is given

**Awaiting approval to proceed with Phase 0 implementation.**
