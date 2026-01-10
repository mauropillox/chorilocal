# Cost Optimization Guide: Reduce CI/CD from $30/month to ~$0

**Problem:** Render charges for CI pipeline minutes after 500 free minutes  
**Current Cost:** $30/month for 500 additional minutes  
**Target:** $0-5/month using optimizations below

---

## ✅ Changes Made (Immediate Savings)

### 1. **render.yaml Created** (MUST ADD TO RENDER DASHBOARD)

This file tells Render to:
- Only build backend when `backend/**` files change
- Only build frontend when `frontend/**` files change  
- Skip builds for docs/markdown changes

**Action Required:**
1. Go to Render Dashboard → Settings
2. Look for "Blueprint" or "Infrastructure as Code"
3. Point it to `render.yaml` in your repo
4. OR manually configure build filters in each service:
   - Backend → Settings → Build & Deploy → **Build Filter**
   - Paths: `backend/**`
   - Ignored: `docs/**, frontend/**, **.md`

### 2. **GitHub Actions Optimized**

- ✅ Skip CI on docs/markdown changes (`paths-ignore`)
- ✅ Only run backend tests when backend code changes
- ✅ Only run frontend build when frontend code changes

---

## 💰 Cost Breakdown & Optimizations

| Change | Monthly Savings | Effort |
|--------|----------------|--------|
| **Skip docs-only commits** | ~$8-12 | ✅ Done |
| **Path-based build filters** | ~$10-15 | ✅ Done (needs Render config) |
| **Use [skip ci] in commits** | ~$3-5 per commit | Manual |
| **Disable Render auto-deploy** | ~$15-20 | 5 min setup |
| **Manual deploys only** | ~$25-30 | Workflow change |

---

## 🎯 Recommended Strategy: Hybrid Approach

### Option A: **Keep Auto-Deploy, Add Filters** (Recommended)
**Cost:** ~$5-10/month  
**Effort:** 5 minutes

1. ✅ **Done:** GitHub Actions skips docs changes
2. ✅ **Done:** `render.yaml` created with path filters
3. **TODO:** Configure in Render Dashboard (see below)
4. **Habit:** Use `[skip ci]` in commit messages when appropriate

```bash
# Skip CI for docs/minor changes
git commit -m "docs: update README [skip ci]"
git commit -m "chore: fix typo [skip ci]"

# Run CI only for backend
git commit -m "[backend] fix: SQLite timeout"

# Run CI only for frontend  
git commit -m "[frontend] feat: new dashboard widget"
```

### Option B: **Manual Deploys Only**
**Cost:** $0/month  
**Effort:** 10 minutes setup + manual deploy per release

1. Render Dashboard → Each service → Settings
2. **Build & Deploy** → Disable "Auto-Deploy"
3. Deploy manually via Render Dashboard when ready
4. Or use Render API/CLI

**Pros:** Zero CI cost, full control  
**Cons:** Must remember to deploy, slower iteration

---

## 📋 Setup Instructions for Render Dashboard

### Configure Build Filters (Do This Now!)

**Backend Service:**
1. Render Dashboard → `chorilocal-backend` → Settings
2. Scroll to **Build & Deploy** section
3. Find **Build Filter** or **Auto-Deploy** settings
4. Set:
   - **Included Paths:** `backend/**`
   - **Ignored Paths:** `docs/**, frontend/**, *.md, README.md`
5. Save

**Frontend Service:**
1. Render Dashboard → `chorilocal-frontend` → Settings
2. Same section: **Build & Deploy**
3. Set:
   - **Included Paths:** `frontend/**`
   - **Ignored Paths:** `docs/**, backend/**, *.md, README.md`
4. Save

**Expected Result:**
- Pushing only docs changes = 0 builds
- Pushing only backend changes = 1 build (backend)
- Pushing only frontend changes = 1 build (frontend)
- Before: Every push = 2 builds (both services)

---

## 🛠️ Additional Optimizations

### 3. Use [skip ci] in Commit Messages

GitHub Actions respects `[skip ci]`, `[ci skip]`, or `[skip actions]`:

```bash
# These will NOT trigger any CI
git commit -m "docs: update changelog [skip ci]"
git commit -m "chore: cleanup comments [skip ci]"
git commit -m "style: format code [skip ci]"
```

### 4. Batch Commits Before Pushing

Instead of:
```bash
git commit -m "fix typo"
git push  # triggers CI
git commit -m "another fix"
git push  # triggers CI again
git commit -m "final fix"
git push  # triggers CI again
```

Do:
```bash
git commit -m "fix typo"
git commit -m "another fix"
git commit -m "final fix"
git push  # triggers CI once
```

### 5. Consider Render's "Preview Environments" Setting

Render may be building preview environments for PRs. If you don't need them:

1. Render Dashboard → Service Settings
2. **Pull Request Previews** → Disable

---

## 📊 Expected Savings

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Docs-only commits | 2 builds | 0 builds | 100% |
| Backend-only changes | 2 builds | 1 build | 50% |
| Frontend-only changes | 2 builds | 1 build | 50% |
| Full-stack changes | 2 builds | 2 builds | 0% |

**Realistic Estimate:**
- 70% of your commits are single-service changes
- 500 minutes used → ~200 minutes after optimization
- $30/month → ~$5-10/month

---

## 🚀 Advanced: Move to GitHub Actions Only

If you want **$0 CI cost** but keep auto-deploy:

1. **Disable Render CI entirely**
2. **Use GitHub Actions to build & push Docker images**
3. **Trigger Render deploy via API**

This requires:
- Docker Hub or GitHub Container Registry
- Render Deploy Hook URL
- GitHub Actions secrets

**Setup time:** ~1 hour  
**Monthly cost:** $0

---

## ✅ Action Checklist

- [ ] Configure Render build filters (5 min)
- [ ] Test: push docs-only change, verify no build
- [ ] Habit: use `[skip ci]` for non-code changes
- [ ] Optional: disable auto-deploy, deploy manually
- [ ] Monitor usage: Render Dashboard → Billing → Pipeline Minutes

---

## 📞 Need Help?

If CI minutes are still high after these changes, check:
1. Are there scheduled builds? (Render Settings → Build & Deploy)
2. Are PRs triggering preview environments?
3. Are builds failing and retrying? (Check logs)

**Target:** <200 pipeline minutes/month (free tier covers this)

## Cost Optimization Test

This commit should NOT trigger any builds on Render (0 builds = $0).

Test performed on: Sat Jan 10 10:48:26 -03 2026

