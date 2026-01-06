# Legacy/Archived Files

This folder contains deprecated files that are no longer used in production but are kept for historical reference.

## Contents

| File | Original Location | Archived Date | Reason |
|------|------------------|---------------|--------|
| `deploy.sh.old` | `/deploy.sh.old` | 2026-01-05 | Replaced by current `deploy.sh` which is cleaner and has no duplicate code sections |
| `deploy_new.sh` | `/deploy_new.sh` | 2026-01-05 | Transitional file, superseded by current `deploy.sh` |
| `docker-compose.yml.bak.20251223_123843` | `/` | 2026-01-05 | Backup of docker-compose.yml from Dec 23, 2025 before container health checks were added |

## Why Archived (Not Deleted)

These files were archived instead of deleted because:
1. They contain historical context that may be useful for understanding past configurations
2. No active documentation or scripts reference them (verified via grep)
3. They may contain useful snippets if rollback is ever needed

## Safe to Delete?

After 30 days, if no issues arise, these files can be safely deleted:
```bash
rm -rf scripts/legacy/
```

## Verification Performed

Before archiving, we verified:
```bash
# No references in documentation
grep -r "deploy.sh.old\|deploy_new.sh" --include="*.md" --include="*.sh" --include="*.yml"
# Result: No matches

# Current deploy.sh is the active script
ls -la deploy.sh  # Shows current version
```
