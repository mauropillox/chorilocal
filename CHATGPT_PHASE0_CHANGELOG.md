# Phase 0 Changelog — Zero-Risk CI/CD Governance Hardening

> **Date:** 2026-02-28
> **Repo:** `mauropillox/chorilocal`
> **Status:** Applied locally. **NOT committed. NOT pushed.**
> **Phase:** 0 (zero-risk line changes only)

---

## Summary

7 changes applied across 4 workflow files. Total: **+18 lines**. No triggers, job order, secrets, deploy logic, backup logic, build steps, or cron schedules were modified. All changes are independently revertible by removing the added lines.

---

## Change Log

### CHANGE #1 — Fix E2E `PLAYWRIGHT_URL` env var

| Field | Value |
|---|---|
| **File** | `.github/workflows/ci.yml` |
| **Location** | `e2e-tests` job → "Run E2E tests" step |
| **Lines changed** | 1 (in-place rename) |
| **Risk** | Zero |

**Before:**
```yaml
          BASE_URL: http://localhost:5173
```

**After:**
```yaml
          PLAYWRIGHT_URL: http://localhost:5173
```

**Why zero-risk:** `playwright.config.ts` reads `process.env.PLAYWRIGHT_URL`, not `BASE_URL`. The old variable was dead — tests were silently falling through to the default (`https://chorilocal.onrender.com`, i.e., production). This fix routes E2E tests to the CI-local frontend as intended. No trigger, job, or command changed.

---

### CHANGE #2 — Add `ENVIRONMENT` and `DB_PATH` to E2E backend start

| Field | Value |
|---|---|
| **File** | `.github/workflows/ci.yml` |
| **Location** | `e2e-tests` job → "Start backend server" step → `env:` block |
| **Lines changed** | +2 |
| **Risk** | Zero |

**Before:**
```yaml
        env:
          SECRET_KEY: test-secret-key-for-ci
```

**After:**
```yaml
        env:
          SECRET_KEY: test-secret-key-for-ci
          ENVIRONMENT: test
          DB_PATH: /tmp/friosur-e2e.db
```

**Why zero-risk:** Both env vars are read by the backend (`main.py` line 31, `db.py` line 26). Without `ENVIRONMENT=test`, defaults to `development` (safe but imprecise). Without `DB_PATH`, defaults to `/data/ventas.db` which doesn't exist on CI runners. The path `/tmp/friosur-e2e.db` is ephemeral, unique, and can't collide with anything. Scoped to step-level env only — no global env change.

---

### CHANGE #3 — Add `permissions: contents: read` to `ci.yml`

| Field | Value |
|---|---|
| **File** | `.github/workflows/ci.yml` |
| **Location** | Top-level, between `on:` block and `env:` block |
| **Lines changed** | +3 |
| **Risk** | Zero |

**Before:**
```yaml
      - '**.md'

env:
```

**After:**
```yaml
      - '**.md'

permissions:
  contents: read

env:
```

**Why zero-risk:** No job in `ci.yml` requires write permissions. All jobs use only `checkout`, `setup-*`, `upload-artifact`, `download-artifact`, and shell commands. `upload-artifact` does not require `contents: write`. This restricts from default full-write to read-only (principle of least privilege).

---

### CHANGE #4 — Add `permissions: contents: read` to `backup-database.yml`

| Field | Value |
|---|---|
| **File** | `.github/workflows/backup-database.yml` |
| **Location** | Top-level, between `on:` block and `jobs:` block |
| **Lines changed** | +3 |
| **Risk** | Zero |

**Before:**
```yaml
  workflow_dispatch: # Manual trigger option

jobs:
```

**After:**
```yaml
  workflow_dispatch: # Manual trigger option

permissions:
  contents: read

jobs:
```

**Why zero-risk:** Backup workflow only uses shell commands (`curl` to Render API) and `upload-artifact`. No GitHub API writes, no releases, no PR comments. `contents: read` is sufficient.

---

### CHANGE #5 — Add `permissions: contents: read` to `nightly-health.yml`

| Field | Value |
|---|---|
| **File** | `.github/workflows/nightly-health.yml` |
| **Location** | Top-level, between `on:` block and `env:` block |
| **Lines changed** | +3 |
| **Risk** | Zero |

**Before:**
```yaml
  workflow_dispatch: # Manual trigger

env:
```

**After:**
```yaml
  workflow_dispatch: # Manual trigger

permissions:
  contents: read

env:
```

**Why zero-risk:** Health check workflow uses `checkout`, `setup-*`, `pip-audit`, `npm audit`, `curl`, `sqlite3`, and `$GITHUB_STEP_SUMMARY`. No CodeQL, no SARIF, no `security-events`, no releases, no PR comments. `contents: read` is sufficient.

---

### CHANGE #6 — Add `permissions: contents: read` to `release-deploy.yml`

| Field | Value |
|---|---|
| **File** | `.github/workflows/release-deploy.yml` |
| **Location** | Top-level, between `on:` block and `env:` block |
| **Lines changed** | +3 |
| **Risk** | Zero |

**Before:**
```yaml
        default: true

env:
```

**After:**
```yaml
        default: true

permissions:
  contents: read

env:
```

**Why zero-risk:** Sets default to read-only. The `create-release` job already has a job-level `permissions: contents: write` override (unchanged) which is required for `github.rest.repos.createRelease()`. The other two jobs (`validate`, `post-deploy-smoke`) only need read access. Job-level permissions override top-level in GitHub Actions.

---

### CHANGE #7 — Add `concurrency` block to `ci.yml`

| Field | Value |
|---|---|
| **File** | `.github/workflows/ci.yml` |
| **Location** | Top-level, between `permissions:` block and `env:` block |
| **Lines changed** | +4 |
| **Risk** | Zero |

**Before:**
```yaml
permissions:
  contents: read

env:
```

**After:**
```yaml
permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

env:
```

**Why zero-risk:** Only cancels superseded CI runs on the **same branch or same PR**. Group key includes PR number (for PRs) or ref (for pushes), so different branches/PRs can't cancel each other. `ci.yml` is push/PR only (not scheduled), so no cron-cancellation risk. Saves CI runner time on rapid pushes.

---

## Files Not Touched

| File | Reason |
|---|---|
| `.github/workflows/security.yml` | Already has `permissions: contents: read` + `security-events: write`. No change needed. |
| `scripts/smoke_test.sh` | Gitignored. Not a CI governance item. |
| `frontend/package.json` | ESLint deps fix is Phase 2 (code change, not CI governance). |
| `backend/requirements.txt` | `python-jose` CVE is Phase 2 (code change). |

---

## Validation

All 5 workflow files pass YAML syntax validation:
```bash
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in [
  '.github/workflows/ci.yml',
  '.github/workflows/backup-database.yml',
  '.github/workflows/nightly-health.yml',
  '.github/workflows/release-deploy.yml',
  '.github/workflows/security.yml'
]]"
```

---

## Current Local State

```
MODIFIED (tracked):
  .github/workflows/ci.yml              (+64 -9 lines total, including pre-Phase-0 changes)
  .github/workflows/backup-database.yml (+6 -1 lines total, including pre-Phase-0 exit 1 fix)

CREATED (untracked):
  .github/workflows/security.yml
  .github/workflows/nightly-health.yml
  .github/workflows/release-deploy.yml
  CHATGPT_CICD_SUMMARY.md
  CHATGPT_CICD_AUDIT_V2.md
  CHATGPT_CICD_GOVERNANCE_ANALYSIS_V3.md
  CHATGPT_PHASE0_CHANGELOG.md

NOTHING COMMITTED. NOTHING PUSHED.
```

---

## Phase 1 Preview

Phase 1 will address:
- `VITE_API_URL` fallback in `release-deploy.yml` (requires build-time analysis)
- Single pytest invocation (merge dual pytest runs)
- Pin `ruff` version
- Backup empty-file failure surfacing
- Backup size/row validation in nightly-health

Phase 1 requires separate approval.
