# Legacy/Archived Backend Files

This folder contains deprecated backend files that are no longer used.

## Contents

| File | Archived Date | Reason |
|------|---------------|--------|
| `auth.py.deprecated` | 2026-01-05 | Old authentication module. Auth logic has been consolidated into `main.py` with improved security (JWT with jti for revocation, rate limiting, password strength validation). |

## Current Auth Architecture

Authentication is now handled directly in `main.py`:
- `create_access_token()` - JWT creation with jti for logout support
- `get_current_user()` - Token validation with revocation check
- `get_admin_user()` - Admin-only access
- `/login`, `/logout`, `/refresh`, `/register` endpoints
- Token revocation stored in `revoked_tokens` table
