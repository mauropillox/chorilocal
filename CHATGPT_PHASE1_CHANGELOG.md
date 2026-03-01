# Phase 1 Changelog — CI Reliability & Build-Time Safety

> **Date:** 2026-02-28
> **Repo:** `mauropillox/chorilocal`
> **Status:** Applied locally. **NOT committed. NOT pushed.**
> **Phase:** 1 (CI reliability corrections — build-time env var fixes, efficiency improvements)
> **Depends on:** Phase 0 (completed)

---

## Summary

1 change applied to 1 workflow file. Total: **1 line modified in-place**. No triggers, job order, secrets, deploy logic, backup logic, or cron schedules were modified. Render production behavior is completely unaffected — the modified build is ephemeral (never uploaded, never deployed).

---

## Change Log

### CHANGE #8 — Fix `VITE_API_URL` fallback in `release-deploy.yml`

| Field | Value |
|---|---|
| **File** | `.github/workflows/release-deploy.yml` |
| **Location** | `validate` job → "Build frontend" step → `env:` block (line 83) |
| **Lines changed** | 1 (in-place string replacement) |
| **Risk** | Very low |
| **Phase** | 1 |

**Before:**
```yaml
          VITE_API_URL: ${{ secrets.VITE_API_URL || 'https://api.pedidosfriosur.com/api' }}
```

**After:**
```yaml
          VITE_API_URL: ${{ secrets.VITE_API_URL || 'http://localhost:8000/api' }}
```

**Why this is safe:**
1. `VITE_API_URL` is a **build-time** variable. Vite does string substitution during `vite build`. The URL is baked into the JS bundle as a literal string.
2. The `validate` job's `vite build` is a **validation-only build**. The resulting `dist/` is never uploaded as an artifact and never deployed anywhere. It is discarded when the runner terminates.
3. **Render builds independently.** When Render auto-deploys from `main`, it uses `frontend/Dockerfile` which has its own `ARG VITE_API_URL=https://api.pedidosfriosur.com/api`. Render also provides the value via `render.yaml` (`key: VITE_API_URL`, `value: https://api.pedidosfriosur.com/api`). Neither is affected by this change.
4. If the GitHub Secret `VITE_API_URL` is set, the fallback is never used. Both versions behave identically in that case.
5. If the secret is missing/deleted, the old fallback baked the prod URL into a discarded CI build (theoretical risk of accidental prod calls if bundle were somehow used). The new fallback bakes `localhost` instead (harmless, fails safely).
6. This matches the pattern already applied to `ci.yml` (which uses `http://localhost:8000/api` as its fallback).

**What could go wrong:**
- If someone copies the CI validation build output and tries to use it as a production deployment, API calls would go to `localhost` instead of prod. This is the desired behavior — CI builds should not be production-deployable.

**Rollback:** Revert the fallback URL string from `http://localhost:8000/api` back to `https://api.pedidosfriosur.com/api`.

**Verification checklist:**
- ✅ Triggers: unchanged (`push: tags: v*`, `workflow_dispatch`)
- ✅ Job order: unchanged (`validate` → `create-release` → `post-deploy-smoke`)
- ✅ Secret name: unchanged (`secrets.VITE_API_URL`)
- ✅ Deploy logic: unchanged (Render auto-deploys independently)
- ✅ Backup logic: not in this workflow
- ✅ No new external calls
- ✅ No production endpoint references added (one removed from fallback)
- ✅ YAML validation: passed

---

## Remaining Phase 1 Items (Not Yet Implemented)

| ID | Change | File | Status |
|---|---|---|---|
| P1.1 | Merge dual pytest into single invocation with `--cov` + `--junitxml` | `ci.yml` | Pending approval |
| P1.2 | Pin `ruff==0.9.7` | `ci.yml` | Pending approval |
| P1.3 | Add concurrency to `backup-database.yml` (`cancel-in-progress: false`) | `backup-database.yml` | Pending approval |
| P4.1 | Add minimum backup size check (≥10KB) | `nightly-health.yml` | Pending approval |
| P4.2 | Add zero-row detection in restore verify | `nightly-health.yml` | Pending approval |
| P4.3 | Add `exit 1` on empty backup download | `backup-database.yml` | Pending approval |

These require separate approval and analysis before implementation.

---

## Cumulative Local State (All Phases)

```
MODIFIED (tracked):
  .github/workflows/ci.yml              (Phase 0: changes #1-3, #7 + pre-Phase-0)
  .github/workflows/backup-database.yml (Phase 0: change #4 + pre-Phase-0 exit 1 fix)

CREATED (untracked):
  .github/workflows/security.yml        (pre-Phase-0)
  .github/workflows/nightly-health.yml  (Phase 0: change #5 applied)
  .github/workflows/release-deploy.yml  (Phase 0: change #6 + Phase 1: change #8)
  CHATGPT_CICD_SUMMARY.md
  CHATGPT_CICD_AUDIT_V2.md
  CHATGPT_CICD_GOVERNANCE_ANALYSIS_V3.md
  CHATGPT_PHASE0_CHANGELOG.md
  CHATGPT_PHASE1_CHANGELOG.md

NOTHING COMMITTED. NOTHING PUSHED.
```

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
