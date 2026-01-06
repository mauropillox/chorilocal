Git history purge plan (safe workflow)

Goal
- Remove sensitive secrets (keys, tokens, `.env` contents, DB dumps) from git history.

Important notes
- This operation rewrites history and requires a forced push. All collaborators must coordinate: they will need to re-clone or reset local branches.
- Back up the repository (mirror clone) before starting:

  git clone --mirror <repo-url> repo-mirror.git

High-level approach (recommended: `git filter-repo`)

1) Identify offending files/strings
   - Use `.secrets.history.txt` (generated earlier) and `git log --all -p | grep` to list commits/paths.

2) Prepare a mapping of paths to remove or replacement values.
   - Example: `data/ventas.db`, `.env`, `backups/`.

3) Install `git-filter-repo` (locally) and test on a mirror clone.
   - On Debian/Ubuntu: `sudo apt install git-filter-repo` or pipx install

4) Dry-run and test commands (on mirror):

   # remove files entirely from history
   git filter-repo --invert-paths --paths data/ventas.db --paths .env --paths backups/

   # or to replace a secret string in all files
   git filter-repo --replace-text replacements.txt

   `replacements.txt` example:
     literal:OLD_SECRET_TOKEN==>REMOVED_BY_ADMIN

5) Verify the result in the mirror (check `git log --all -p` and search for the secret strings).

6) Push rewritten branches to remote (force) **only when ready and coordinated**:

   git push --force --all origin
   git push --force --tags origin

7) Instruct collaborators to re-clone or run the provided recovery steps.

Alternative: BFG Repo-Cleaner
- BFG is easier for removing large files or files by path. Example:

  bfg --delete-files data/ventas.db repo-mirror.git

Post-purge steps
- Rotate secrets that were removed (done already).
- Update `.gitignore` to avoid re-adding files.
- Add pre-commit secret scanning and protect main branch with 2FA and limited push access.

I can prepare the exact `git filter-repo` commands and a `replacements.txt` based on the precise commits/paths found in `.secrets.history.txt` — tell me to proceed and I will generate the commands (no pushes performed by me unless you ask explicitly).
