# Phase 3 Governance Report — Deployment Control & Governance

**Generated:** 2026-02-28  
**Phase:** P3 (Governance & Deployment Control)  
**Status:** In progress  
**Governance:** No commits, no pushes, no PRs — local only

---

## Section 1: Branch Protection Configuration Guide

### Change #19 — P3.1: Branch Protection & Required Status Checks

**Type:** Documentation only — no file changes  
**Purpose:** Step-by-step guide to configure GitHub branch protection rules for the `main` branch using the exact workflow/job names from this repository.

---

### 1. Navigate to Branch Protection Settings

```
GitHub → Repository (mauropillox/chorilocal)
  → Settings (top nav)
    → Branches (left sidebar, under "Code and automation")
      → Branch protection rules
        → Add rule (or edit existing rule for "main")
```

**Branch name pattern:** `main`

---

### 2. Required Status Checks

Enable: **☑ Require status checks to pass before merging**

Enable: **☑ Require branches to be up to date before merging**

#### Status Checks to Add as Required

These are the checks that run on `pull_request` to `main` and must pass before merge:

| Check Name (as shown in GitHub) | Workflow | Job ID | Why Required |
|---------------------------------|----------|--------|-------------|
| `CI/CD Pipeline / CI Success` | ci.yml | `ci-success` | Gates all required checks (backend tests, frontend tests, frontend build) |

**Important:** `CI Success` is the single gate check. It internally validates:
- `Backend Tests` → must be `success`
- `Frontend Tests` → must be `success`
- `Frontend Build` → must be `success`
- `Backend Lint (ruff)` → advisory (warns but doesn't block)
- `Frontend Lint (ESLint)` → advisory (warns but doesn't block)

By requiring only `CI Success`, you get the benefit of a single required check that aggregates all mandatory results. If you later want to require individual checks as well, add these:

| Check Name | Required? | Notes |
|-----------|-----------|-------|
| `CI/CD Pipeline / Backend Tests` | Optional | Already gated by CI Success |
| `CI/CD Pipeline / Frontend Tests` | Optional | Already gated by CI Success |
| `CI/CD Pipeline / Frontend Build` | Optional | Already gated by CI Success |
| `CI/CD Pipeline / Backend Lint (ruff)` | Do NOT require | Advisory — `continue-on-error: true` |
| `CI/CD Pipeline / Frontend Lint (ESLint)` | Do NOT require | Advisory — `continue-on-error: true` |
| `CI/CD Pipeline / E2E Tests` | Do NOT require | Only runs when `run-e2e` label is applied |

#### Security Checks (PR-triggered)

| Check Name | Workflow | Required? | Notes |
|-----------|----------|-----------|-------|
| `Security Scanning / Dependency Review` | security.yml | Recommended | Runs on PRs that touch `requirements*.txt`, `package*.json`, `Dockerfile*` |

**Note:** `Dependency Review` only triggers on PRs that modify dependency files (via `paths:` filter). If added as required, GitHub will show it as "Expected — Waiting for status to be reported" on PRs that don't touch those files. This is safe — GitHub treats missing optional checks as passing. However, if this causes confusion, leave it as non-required and rely on manual review of its output when it does run.

---

### 3. Pull Request Reviews

Enable: **☑ Require a pull request before merging**

| Setting | Recommended Value | Rationale |
|---------|------------------|-----------|
| Required approving reviews | **1** | Minimum viable review gate; increase to 2 for critical repos |
| Dismiss stale pull request approvals when new commits are pushed | **☑ Enabled** | Forces re-review after code changes, prevents "approve then sneak in changes" |
| Require review from Code Owners | **☐ Disabled** | No CODEOWNERS file exists yet; enable after creating one |
| Restrict who can dismiss pull request reviews | **☐ Disabled** | Not needed for a small team |
| Allow specified actors to bypass required pull requests | **☐ Leave empty** | No one should bypass PR review |

---

### 4. Force Push & Deletion Protection

| Setting | Recommended Value | Rationale |
|---------|------------------|-----------|
| **☑ Do not allow force pushes** | Enabled | Prevents history rewriting on `main` — critical for audit trail |
| **☑ Do not allow deletions** | Enabled | Prevents accidental deletion of the `main` branch |

---

### 5. Push Restrictions

Enable: **☑ Restrict who can push to matching branches**

| Setting | Recommended Value | Rationale |
|---------|------------------|-----------|
| People, teams, or apps that can push | **Leave empty** | No direct pushes to `main` — all changes must go through PRs |

**Effect:** With this enabled and the list empty, the only way code reaches `main` is through a merged PR that passes all required checks. This is the strongest protection level.

**Exception:** If you need emergency hotfix capability, add one admin user. Document this in the rollback playbook (Change #21).

---

### 6. Conversation Resolution

Enable: **☑ Require conversation resolution before merging**

| Setting | Recommended Value | Rationale |
|---------|------------------|-----------|
| Require conversation resolution | **☑ Enabled** | Ensures all review comments are addressed before merge |

---

### 7. Linear History (Optional)

| Setting | Recommended Value | Rationale |
|---------|------------------|-----------|
| Require linear history | **☐ Disabled (for now)** | Requires squash or rebase merges only. Useful for clean history but may surprise contributors used to merge commits. Enable after team agrees on merge strategy. |

If you decide to enable this later:
- Choose between "Squash merging" (recommended for this repo) or "Rebase merging"
- Configure in **Settings → General → Pull Requests** (separate from branch protection)
- Uncheck "Allow merge commits" to enforce the policy

---

### 8. Additional Settings

| Setting | Recommended Value | Rationale |
|---------|------------------|-----------|
| Lock branch | **☐ Disabled** | Only for frozen/archived branches |
| Allow fork syncing | **☐ Disabled** | Not needed for private team repos |
| Require signed commits | **☐ Disabled (for now)** | Requires all contributors to set up GPG keys. Consider enabling after team onboarding. |

---

### 9. Complete Settings Summary

```
Branch name pattern: main

☑ Require a pull request before merging
  ├─ Required approving reviews: 1
  ├─ ☑ Dismiss stale approvals when new commits are pushed
  ├─ ☐ Require review from Code Owners
  └─ ☐ Restrict who can dismiss reviews

☑ Require status checks to pass before merging
  ├─ ☑ Require branches to be up to date before merging
  └─ Required checks:
      └─ CI/CD Pipeline / CI Success

☑ Require conversation resolution before merging

☑ Do not allow force pushes
☑ Do not allow deletions

☑ Restrict who can push to matching branches
  └─ (empty — all changes via PR only)

☐ Require linear history (optional — enable after team alignment)
☐ Require signed commits (optional — enable after GPG onboarding)
☐ Lock branch (disabled)
```

---

### 10. Verification After Applying

After saving the branch protection rule:

1. **Test PR workflow:**
   ```bash
   git checkout -b test/branch-protection
   echo "# test" >> README.md
   git add README.md && git commit -m "test: verify branch protection"
   git push origin test/branch-protection
   # Open PR → verify CI/CD Pipeline / CI Success appears as required check
   # Close PR without merging
   git checkout main && git branch -D test/branch-protection
   ```

2. **Test force-push block:**
   ```bash
   git push --force origin main
   # Expected: rejected by GitHub
   ```

3. **Test direct push block:**
   ```bash
   git push origin main
   # Expected: rejected (if "Restrict who can push" is enabled with empty list)
   ```

---

### 11. Screenshots (To Be Added)

> **Note:** This section is a placeholder. Add screenshots of the configured settings after applying them in the GitHub UI.

- [ ] Screenshot: Branch protection rules overview
- [ ] Screenshot: Required status checks configuration
- [ ] Screenshot: Pull request review settings
- [ ] Screenshot: Force push / deletion protection

---

### Workflow Check Names Reference

For convenience, here is the complete map of every workflow and job in this repository, with their GitHub-displayed check names:

| Workflow File | Workflow Name | Job Display Name | Triggers On |
|--------------|--------------|-----------------|-------------|
| `ci.yml` | CI/CD Pipeline | Backend Tests | push, pull_request → main/master/develop |
| `ci.yml` | CI/CD Pipeline | Frontend Tests | push, pull_request → main/master/develop |
| `ci.yml` | CI/CD Pipeline | Frontend Build | push, pull_request → main/master/develop |
| `ci.yml` | CI/CD Pipeline | Backend Lint (ruff) | push, pull_request → main/master/develop |
| `ci.yml` | CI/CD Pipeline | Frontend Lint (ESLint) | push, pull_request → main/master/develop |
| `ci.yml` | CI/CD Pipeline | E2E Tests | pull_request (only with `run-e2e` label) |
| `ci.yml` | CI/CD Pipeline | CI Success | push, pull_request → main/master/develop |
| `security.yml` | Security Scanning | Dependency Review | pull_request → main/master (dep file changes only) |
| `security.yml` | Security Scanning | Dependency Audit | schedule (Monday 4AM UTC), workflow_dispatch |
| `security.yml` | Security Scanning | CodeQL (python/js-ts) | schedule (Monday 4AM UTC), workflow_dispatch |
| `security.yml` | Security Scanning | Secret Scan | schedule, pull_request, workflow_dispatch |
| `security.yml` | Security Scanning | Security Summary | schedule, pull_request, workflow_dispatch |
| `backup-database.yml` | Database Backup | Backup Database | schedule (daily 00:00 UTC), workflow_dispatch |
| `nightly-health.yml` | Weekly Health Check | Dependency Audit | schedule (Sunday 3AM UTC), workflow_dispatch |
| `nightly-health.yml` | Weekly Health Check | Production Smoke Test | schedule, workflow_dispatch |
| `nightly-health.yml` | Weekly Health Check | Backup Restore Verification | schedule, workflow_dispatch |
| `nightly-health.yml` | Weekly Health Check | Health Summary | schedule, workflow_dispatch |
| `release-deploy.yml` | Release & Deploy | Validate Release | push tags `v*`, workflow_dispatch |
| `release-deploy.yml` | Release & Deploy | Create GitHub Release | push tags `v*`, workflow_dispatch |
| `release-deploy.yml` | Release & Deploy | Post-Deploy Smoke Test | push tags `v*`, workflow_dispatch |

---

---

## Section 2: Render Deploy Strategy

### Change #20 — P3.2: Render Deploy Strategy Documentation

**Type:** Documentation only — no file changes  
**Purpose:** Document the current Render deployment model, compare alternatives, and provide a migration path if needed.

---

### 1. Current Render Configuration

From `render.yaml`:

| Setting | Backend (`chorilocal-backend`) | Frontend (`chorilocal-frontend`) |
|---------|-------------------------------|----------------------------------|
| Type | `web` (Docker) | `web` (Docker) |
| Region | Oregon | Oregon |
| Plan | Hobby ($7/mo) | Hobby ($7/mo) |
| Dockerfile | `./backend/Dockerfile` | `./frontend/Dockerfile` |
| **Auto-deploy** | **`true`** | **`true`** |
| **Branch** | **`main`** | **`main`** |
| Persistent disk | 1GB at `/data` (SQLite) | None |

**Current model: Auto-deploy from `main`.**

Every push to `main` triggers a Render build and deploy for both services. There is no manual approval gate on the Render side — if code reaches `main`, it deploys.

---

### 2. Two Deployment Models

#### Model A: PR-Gated Auto-Deploy from `main` (Recommended)

```
feature branch → PR → CI checks pass → review approved → merge to main → Render auto-deploys
```

**How it works:**
- Branch protection on `main` (Section 1) ensures only reviewed, CI-passing code merges
- Render's `autoDeploy: true` + `branch: main` deploys every merge automatically
- No changes needed to `render.yaml`

**Prerequisites (all completed or documented in this hardening):**
- ☑ CI pipeline with required checks (Phase 1)
- ☑ Branch protection with PR reviews (Section 1 of this document)
- ☑ No direct pushes to `main`
- ☑ Security scanning on dependency changes (Phase 2)

#### Model B: Tag-Based Releases Only (Advanced)

```
feature branch → PR → merge to main → (code sits in main, not deployed)
                                        → git tag v1.3.0 → release-deploy.yml validates → Render deploys
```

**How it works:**
- Render's `autoDeploy` set to `false` (or filtered to tags)
- Deploys only trigger on `git tag v*` pushes
- `release-deploy.yml` runs validation before creating a GitHub Release
- Render can be configured to deploy from GitHub Releases or via Deploy Hook

**Prerequisites:**
- Change `render.yaml`: set `autoDeploy: false` on both services
- Create a Render Deploy Hook URL for each service
- Add Deploy Hook as a GitHub secret
- Modify `release-deploy.yml` to call the Deploy Hook after release creation
- Team adopts semantic versioning discipline

---

### 3. Risk Comparison

| Risk Factor | Model A (PR-gated auto-deploy) | Model B (Tag-based releases) |
|-------------|-------------------------------|------------------------------|
| **Broken deploy from bad merge** | Medium — CI catches most issues, but integration bugs can slip through | Low — extra validation step before deploy |
| **Deploy frequency** | Every merge = immediate deploy | Controlled cadence (when you tag) |
| **Complexity** | Low — no extra tooling needed | Medium — requires tagging discipline, deploy hooks |
| **Rollback speed** | Fast — revert PR, auto-deploys revert | Fast — re-tag previous version, or use Render manual rollback |
| **Human error** | Low — automation handles deploy | Medium — forgetting to tag means features sit unreleased |
| **Hotfix speed** | Fastest — merge hotfix PR, auto-deploys | Slower — must merge, then tag, then wait for deploy |
| **Audit trail** | Git merge commits + Render deploy log | Git tags + GitHub Releases + Render deploy log |
| **Team size fit** | Best for 1-3 person teams | Better for 4+ person teams with release manager |

### Recommendation

**Model A (PR-gated auto-deploy)** is recommended for this project because:

1. **Team size:** Small team (1-2 people) — tag-based releases add ceremony without proportional safety benefit
2. **Deploy frequency:** The product benefits from rapid iteration — every merged PR should reach production quickly
3. **Safety is already covered:** Branch protection + required CI checks + PR review provide sufficient gates
4. **Render hobby tier:** No staging environment — there's no intermediate step where a "release" would be tested before production anyway
5. **Current setup already works this way** — no migration needed

Model B becomes worthwhile when:
- Team grows beyond 3-4 developers
- A staging environment is added (Render Pro tier)
- Regulatory requirements mandate versioned releases
- Deploy frequency needs to be decoupled from merge frequency

---

### 4. "What Happens If CI Fails After Merge" Scenario

This is the key risk with Model A. Here's what can happen and how to handle it:

#### Scenario: Code passes CI on the PR, but fails in production after merge

```
Timeline:
  1. Developer opens PR from feature/x → main
  2. CI runs on PR, all checks pass ✅
  3. Reviewer approves ✅
  4. Developer merges PR
  5. CI runs again on the push to main (ci.yml triggers on push to main)
  6. Render sees push to main, starts building
  7. Two things happen in parallel:
     a. GitHub CI runs tests
     b. Render builds Docker image and deploys
```

#### The Gap

Render does NOT wait for GitHub CI to pass before deploying. Render and GitHub CI are independent systems. This means:

- If a test passes on the PR branch but fails on `main` (e.g., merge conflict in tests), Render will still deploy the broken code
- This is rare but possible (stale branch, race condition in merge)

#### Mitigations Already In Place

| Mitigation | Coverage |
|-----------|----------|
| `Require branches to be up to date` in branch protection | Forces PR branch to be rebased on latest `main` before merge — eliminates most merge-related failures |
| `CI Success` required check | Ensures the PR-branch CI passes with current `main` integrated |
| Post-deploy smoke test in `release-deploy.yml` | Catches production issues (but only runs on tag pushes, not auto-deploys) |
| Nightly health check | Catches issues within 24 hours if missed |

#### If It Still Happens — Response Playbook

```
1. Notice: CI fails on main after merge
   └─ GitHub sends failure notification
   
2. Check Render deploy status
   └─ Dashboard → chorilocal-backend → Events
   └─ If Render build also failed → no broken deploy (Docker build failure = no deploy)
   └─ If Render deployed successfully → broken code is live

3. If broken code is live:
   a. Quick fix available?
      └─ Yes → Push fix PR, fast-track review, merge
      └─ No → Revert the merge commit:
           git revert <merge-commit-sha> -m 1
           # Push revert as PR (or direct if emergency)
   
   b. Render will auto-deploy the revert/fix

4. Post-incident:
   └─ Why did the PR CI pass but main CI fail?
   └─ Was "Require branches to be up to date" enabled?
   └─ Add regression test if applicable
```

#### Advanced Mitigation (Future)

If the CI-Render gap becomes a real problem, you can:

1. **Disable Render auto-deploy** and use a Deploy Hook triggered by CI success on `main`:
   ```yaml
   # In ci.yml, add a deploy job after ci-success:
   deploy:
     needs: ci-success
     if: github.ref == 'refs/heads/main' && github.event_name == 'push'
     runs-on: ubuntu-latest
     steps:
       - name: Trigger Render deploy
         run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_BACKEND }}"
       - name: Trigger frontend deploy
         run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_FRONTEND }}"
   ```
   This ensures Render only deploys after CI passes on `main`. This is essentially a hybrid of Model A and Model B.

2. **Add a post-deploy smoke test to ci.yml** (not just release-deploy.yml) that runs after the deploy job completes.

These are documented here for future reference but are NOT recommended to implement now — the current setup with branch protection provides sufficient safety.

---

### 5. Migration Plan (If Switching to Model B Later)

If the team decides to switch from Model A to Model B:

| Step | Action | Risk |
|------|--------|------|
| 1 | Set `autoDeploy: false` in `render.yaml` for both services | **LOW** — stops auto-deploys after next push |
| 2 | Create Deploy Hooks in Render Dashboard (Settings → Deploy Hook) | None |
| 3 | Add `RENDER_DEPLOY_HOOK_BACKEND` and `RENDER_DEPLOY_HOOK_FRONTEND` as GitHub secrets | None |
| 4 | Add deploy step to `release-deploy.yml` (curl the hooks after release creation) | **LOW** — additive change |
| 5 | Test with a `v0.0.1-test` tag before going live | None |
| 6 | Remove test tag and release | None |
| 7 | Communicate to team: "Merging to main no longer deploys. Tag a release to deploy." | **MEDIUM** — process change |

**Estimated effort:** 1-2 hours  
**Reversible:** Yes — set `autoDeploy: true` to go back to Model A

---

### 6. Current State Summary

| Aspect | Current | After Branch Protection (Section 1) |
|--------|---------|-------------------------------------|
| Deploy trigger | Any push to `main` | Only PR merges to `main` (no direct pushes) |
| Pre-deploy validation | None (Render doesn't check CI) | CI must pass before PR can merge |
| Review gate | None | 1 required reviewer |
| Security scan | Runs but was silently green | Fails on real CVEs (Phase 2) |
| Rollback method | Render manual rollback or revert commit | Same, but with better audit trail |

**No changes to `render.yaml` are needed.** The safety improvements come entirely from GitHub-side branch protection, which was documented in Section 1.

---

*Phase 3 continues with Change #21 (Rollback Playbook).*

---

## Section 3: Rollback & Incident Playbook

### Change #21 — P3.3: Rollback and Incident Response

**Type:** Documentation only — no file changes  
**Purpose:** Concrete decision trees for every failure mode in this system, with "stop the bleeding" as the first priority in every scenario.

---

### Part A: Rollback Types

#### A1. Roll Back a Render Deployment (Fastest — No Git Needed)

**When to use:** Production is broken, you need to undo the last deploy immediately.

```
1. Go to Render Dashboard
   └─ https://dashboard.render.com

2. Select the broken service:
   └─ chorilocal-backend  OR  chorilocal-frontend

3. Click "Events" tab
   └─ Find the last successful deploy (green "Deploy succeeded")
   └─ Click the three-dot menu (⋯) on that deploy
   └─ Click "Rollback to this deploy"

4. Wait for rollback to complete (~60-90 seconds)

5. Verify:
   └─ Backend: curl -s https://api.pedidosfriosur.com/health
   └─ Frontend: open https://www.pedidosfriosur.com in browser
```

**Important notes:**
- Render rollback restores the **Docker image**, not the code. The `main` branch still has the broken code.
- You must ALSO fix the code (via revert PR) or the next push to `main` will re-deploy the broken version.
- Render hobby tier keeps previous deploys for rollback. No guarantee on how many.

---

#### A2. Roll Back via Git Revert on `main` (Permanent Fix)

**When to use:** After Render rollback has stopped the bleeding, or for non-urgent regressions.

```
1. Identify the merge commit that broke things:
   git log --oneline main -10

2. Create a revert:
   git checkout main
   git pull origin main
   git checkout -b revert/broken-feature
   git revert <merge-commit-sha> -m 1
   git push origin revert/broken-feature

3. Open PR: revert/broken-feature → main
   └─ CI will run on the PR
   └─ Get fast-track review (1 approval)
   └─ Merge

4. Render auto-deploys the revert from main

5. Verify (same as A1 step 5)
```

**Emergency bypass:** If branch protection is blocking an urgent revert and no reviewer is available:
- A repo admin can temporarily disable "Require a pull request before merging" in Settings → Branches
- Push the revert directly to `main`
- **Re-enable branch protection immediately after**
- Document the bypass in the incident postmortem

---

#### A3. Roll Back a Release Tag (If Using Tag-Based Deploys Later)

**When to use:** Only relevant if Model B (tag-based releases) from Section 2 is adopted.

```
1. Do NOT delete the broken tag — it's part of the audit trail

2. Re-tag the last known good version:
   git tag v1.2.1-hotfix <last-good-commit-sha>
   git push origin v1.2.1-hotfix

3. release-deploy.yml will trigger on the new tag
   └─ Validates → Creates Release → Deploys

4. Verify (same as A1 step 5)
```

---

#### A4. Roll Back a Broken Workflow Change

**When to use:** A change to `.github/workflows/*.yml` broke CI, security scanning, backups, or health checks.

```
1. Identify the commit that broke the workflow:
   git log --oneline .github/workflows/ -5

2. Revert that specific change:
   git checkout main
   git pull origin main
   git checkout -b fix/workflow-revert
   git revert <commit-sha>
   git push origin fix/workflow-revert

3. Open PR → fast-track review → merge

4. Verify:
   └─ Go to Actions tab
   └─ Trigger the affected workflow via workflow_dispatch
   └─ Confirm it passes
```

**Common workflow breakages:**
| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| "Invalid workflow file" | YAML syntax error | Fix indentation, validate with `python3 -c "import yaml; yaml.safe_load(open('file'))"` |
| Job skipped unexpectedly | `if:` condition wrong | Check conditional expressions |
| "Permission denied" | Missing `permissions:` block | Add required permissions |
| Action version not found | Pinned to removed tag | Update action version (e.g., `@v3` → `@v4`) |

---

### Part B: Incident Workflows (Decision Trees)

#### B1. CI Failing on `main`

```
CI/CD Pipeline fails on push to main
         │
         ▼
1. STOP THE BLEEDING
   └─ Is Render auto-deploying the broken code RIGHT NOW?
       ├─ Check: Render Dashboard → Events → is a build in progress?
       ├─ YES → Render rollback (A1) immediately
       └─ NO (build failed or hasn't started) → proceed to step 2
         │
         ▼
2. DIAGNOSE
   └─ Which job failed?
       ├─ Backend Tests → test regression or dependency issue
       ├─ Frontend Tests → component/unit test failure
       ├─ Frontend Build → build error, bad import, env var issue
       ├─ Backend Lint / Frontend Lint → advisory, non-blocking
       └─ CI Success → one of the above failed; check which required check is red
         │
         ▼
3. FIX
   ├─ Quick fix possible (typo, missing import)?
   │   └─ Push fix PR → fast-track review → merge
   │
   └─ Complex fix needed?
       └─ Revert the merge commit (A2)
       └─ Fix on a separate branch
       └─ Re-merge when ready
         │
         ▼
4. VERIFY
   └─ CI passes on main ✅
   └─ Render deploys successfully ✅
   └─ Health endpoint returns 200 ✅
```

---

#### B2. Render Deploy Broken After Merge

```
Render deploy fails or app crashes after deploy
         │
         ▼
1. STOP THE BLEEDING (within 5 minutes)
   └─ Render Dashboard → rollback to last good deploy (A1)
   └─ Verify: curl -s -o /dev/null -w "%{http_code}" https://api.pedidosfriosur.com/health
   └─ Expected: 200
         │
         ▼
2. DIAGNOSE
   └─ Check Render deploy logs:
       ├─ Build failure → Dockerfile issue, missing dependency
       ├─ Runtime crash → uncaught exception, bad env var, DB connection
       └─ Health check timeout → app takes too long to start, infinite loop
         │
         ▼
3. CHECK DATABASE
   └─ If backend crash involved DB:
       curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" \
         -d "username=$ADMIN_USER&password=$ADMIN_PASS" \
         https://api.pedidosfriosur.com/api/login
   └─ Expected: 200 with access_token
   └─ If 500: database may be corrupted → check persistent disk
         │
         ▼
4. FIX
   └─ Revert the merge commit (A2) → Render auto-deploys the revert
   └─ If DB corruption: restore from latest backup artifact
       └─ GitHub → Actions → Database Backup → latest successful run → download artifact
         │
         ▼
5. VERIFY
   └─ Health endpoint 200 ✅
   └─ Login works ✅
   └─ Can create/view pedidos ✅
```

---

#### B3. Backup Workflow Failure

```
Database Backup workflow fails
         │
         ▼
1. CHECK WHICH STEP FAILED
   └─ Actions → Database Backup → latest run → expand failed step
       │
       ├─ "Failed to login" (exit 1 at login step)
       │   └─ ADMIN_USERNAME or ADMIN_PASSWORD secret is wrong/expired
       │   └─ Fix: Settings → Secrets → update credentials
       │   └─ Re-run: Actions → Re-run failed jobs
       │
       ├─ "No se pudo crear backup" (exit 1 at backup creation)
       │   └─ Backend /api/admin/backup-now endpoint is failing
       │   └─ Check: is backend healthy? curl .../health
       │   └─ Check: is persistent disk full? Render Dashboard → Disk Usage
       │
       ├─ "Backup falló o está vacío" (exit 1 at download — Change #12)
       │   └─ Backup file downloaded but was empty or missing
       │   └─ Check: backend logs for backup errors
       │   └─ Check: disk space on Render
       │
       └─ Artifact upload failed
           └─ GitHub issue, usually transient
           └─ Re-run failed jobs
         │
         ▼
2. SEVERITY ASSESSMENT
   └─ One failed backup is not critical if recent backups exist
   └─ Check: Actions → Database Backup → last 7 runs
   └─ If 3+ consecutive failures: escalate — no viable backup exists
         │
         ▼
3. VERIFY AFTER FIX
   └─ Trigger manually: Actions → Database Backup → Run workflow
   └─ Confirm artifact is uploaded and non-empty
```

---

#### B4. Nightly Health Check Failure

```
Weekly Health Check fails
         │
         ▼
1. CHECK WHICH JOB FAILED
       │
       ├─ Dependency Audit
       │   └─ New CVE found in Python or npm deps
       │   └─ Not urgent — scheduled, not blocking deploys
       │   └─ Triage: check CVE severity, patch or ignore (see Phase 2 playbook)
       │
       ├─ Production Smoke Test
       │   └─ Backend unreachable or returned error
       │   └─ Check: is the app sleeping? (Render hobby tier spins down after 15min idle)
       │   └─ Check: curl https://api.pedidosfriosur.com/health
       │   └─ If 000 (timeout): app may be cold-starting, re-run workflow
       │   └─ If 5xx: production is down → escalate (B2)
       │
       └─ Backup Restore Verification
           │
           ├─ "Backup file too small" (Change #13, <10KB)
           │   └─ Backup is likely truncated or corrupted
           │   └─ Check last 3 daily backups for size
           │   └─ If pattern: backup system is broken → investigate (B3)
           │
           ├─ "Integrity check failed"
           │   └─ SQLite file is corrupted
           │   └─ Check: is the daily backup itself corrupt, or did download corrupt it?
           │   └─ Download manually and test: sqlite3 file.db "PRAGMA integrity_check;"
           │
           └─ "usuarios table has 0 rows" (Change #14)
               └─ CRITICAL: possible data loss
               └─ Immediately check production DB:
                   curl -s -X POST ... /api/login
               └─ If login works: backup is bad, but prod DB is OK
               └─ If login fails: production DB may be empty → INCIDENT
                   └─ Restore from last known good backup artifact
```

---

#### B5. Security Workflow Failure

```
Security Scanning workflow fails
         │
         ▼
1. CHECK WHICH JOB FAILED
       │
       ├─ Dependency Audit (pip-audit)
       │   └─ A Python dependency has a known CVE
       │   └─ Read the log: which package? which CVE?
       │   └─ Check: is a patched version available?
       │       ├─ YES → Update in requirements.txt + requirements-prod.txt
       │       │        Test: docker compose exec backend pytest -q
       │       │        PR → review → merge
       │       └─ NO  → Add to ignore list with justification + expiry date
       │                (see Phase 2 report, "When the Security Workflow Fails" playbook)
       │
       ├─ Dependency Audit (npm audit)
       │   └─ An npm dependency has a high/critical vulnerability
       │   └─ Read the log: which package? is it a direct or transitive dep?
       │   └─ Direct dep → update in package.json
       │   └─ Transitive dep → check if parent package has update
       │   └─ No fix available → document and add to npm audit exceptions
       │
       ├─ Dependency Review (PR-only)
       │   └─ A PR introduces a new dependency with known vulnerability
       │   └─ Block the PR until the dependency is updated or justified
       │
       ├─ Secret Scan
       │   └─ Potential secret detected in code
       │   └─ CHECK IMMEDIATELY: is it a real secret or false positive?
       │       ├─ Real secret → rotate it NOW, then remove from code
       │       └─ False positive → add to .secrets.baseline exclusion
       │
       └─ CodeQL
           └─ Code quality or security issue found
           └─ Review findings in Security → Code scanning alerts
           └─ Fix or dismiss with justification
         │
         ▼
2. SEVERITY
   └─ Security findings are NOT blocking deploys (security.yml doesn't gate PRs to main)
   └─ BUT: dependency-review DOES run on PRs that touch dep files and can block merge
   └─ Treat high/critical findings as P1 — fix within 1 week
   └─ Treat medium findings as P2 — fix within 1 month
```

---

### Part C: Post-Rollback Verification Checklist

After any rollback or incident fix, run through this checklist:

```
☐ 1. Health Endpoint
      curl -s -o /dev/null -w "%{http_code}" https://api.pedidosfriosur.com/health
      Expected: 200

☐ 2. Login Flow
      curl -s -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=<admin>&password=<password>" \
        https://api.pedidosfriosur.com/api/login
      Expected: 200 with {"access_token": "..."}

☐ 3. Frontend Loads
      Open https://www.pedidosfriosur.com in browser
      Expected: login page renders, no blank screen

☐ 4. API Responds
      curl -s https://api.pedidosfriosur.com/api/productos \
        -H "Authorization: Bearer <token>"
      Expected: 200 with JSON array

☐ 5. Database Has Data
      (via admin panel or API)
      Check: usuarios count > 0
      Check: productos count > 0
      Check: clientes count > 0

☐ 6. CI Status
      GitHub → Actions → CI/CD Pipeline → latest run on main
      Expected: green ✅

☐ 7. Trigger Backup (if DB was involved)
      GitHub → Actions → Database Backup → Run workflow
      Expected: succeeds, artifact uploaded

☐ 8. Trigger Health Check
      GitHub → Actions → Weekly Health Check → Run workflow
      Expected: all jobs pass
```

---

### Part D: Communication Template

Use this template for internal incident updates. Keep it factual and short.

```
═══════════════════════════════════════════
INCIDENT UPDATE — [Chorizaurio/FrioSur]
═══════════════════════════════════════════
Status:    [INVESTIGATING | MITIGATED | RESOLVED]
Severity:  [P0-Critical | P1-High | P2-Medium]
Started:   YYYY-MM-DD HH:MM UTC
Updated:   YYYY-MM-DD HH:MM UTC

WHAT HAPPENED
[1-2 sentences. What broke? What did users see?]
Example: "Backend returned 500 on all API calls after
deploying commit abc1234. Users saw blank product lists."

IMPACT
- Who is affected: [all users / admin only / specific feature]
- Duration: [X minutes / ongoing]
- Data loss: [none / possible — investigating]

CURRENT STATUS
[What has been done so far?]
Example: "Rolled back Render deployment to previous version.
Backend health check returns 200. Investigating root cause."

ROOT CAUSE (if known)
[What caused it? Which commit/change?]
Example: "Migration script in commit abc1234 dropped a column
that the productos endpoint depends on."

NEXT STEPS
- [ ] [Action item 1]
- [ ] [Action item 2]
- [ ] Next update by: HH:MM UTC

TIMELINE
HH:MM  Deploy triggered from merge of PR #XX
HH:MM  First error reports
HH:MM  Render rollback initiated
HH:MM  Service restored
═══════════════════════════════════════════
```

---

### Part E: Quick Reference Card

Tape this to your mental wall:

| Situation | First Action (< 5 min) | Second Action (< 30 min) |
|-----------|----------------------|-------------------------|
| App is down | Render rollback (A1) | Diagnose + revert PR (A2) |
| CI failing on main | Check if Render deployed | Revert merge commit (A2) |
| Backup failed | Check secrets, re-run | Check disk space, backend health |
| Security scan failed | Read CVE details | Patch dep or add ignore with expiry |
| DB possibly corrupt | Check login + health | Restore from backup artifact |
| Workflow file broken | Revert workflow commit (A4) | Validate YAML locally |

---

*End of Phase 3 Governance Report.*
