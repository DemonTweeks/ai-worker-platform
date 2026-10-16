# Handover — reviewed 2026-10-15

## Current truth
- Source: `https://github.com/Gumb-D/iepms-pr-upload-automation`.
- Published platform baseline `ec5fd9b` pins uploader `397010e` v0.3.1 (XLS/XLSX).
- The inspected host runs an uncommitted v0.3.2 fix plus modified approval. It is NOT contained in the published gitlink. [Exact snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md).
- Platform adapter calls `submit_request`, not draft-only `prepare_request`. It validates, imports, attaches, submits and verifies, then stops before tracker/IP writes. Generic production run/resume must not be substituted casually.

## Latest live evidence
- W14 job `PR-20261015-015`: existing draft `PSQ202610150909` / `1000121288`; zero server lines; all 7 imported rows failed; NOT submitted. Preserve unresolved IMPORT_ECC intent and existing draft.
- W15 job `PR-20261015-016`: local validation rejected `details!P2`; no draft created by this attempt. Original unchanged.
- W16 job `PR-20261015-019`: `PSQ202610150919` / `1000121298`; submitted=true, verified=true; exit 0. Tracker/IP stages were not run. Original unchanged.

## Validation / installation
Use the actual backend Python (host checked: `C:\Python314\python.exe`; use a virtual environment where configured):

```powershell
python -m pip install -r skills/iepms-pr-upload-automation/requirements.txt
# In an isolated/offline test environment; tests may need pytest and test-only xlwt:
python -m pytest skills/iepms-pr-upload-automation/tests -q
npm.cmd --prefix backend run test:iepms-skill-offline
npm.cmd --prefix backend run test:engine-integrity
npm.cmd --prefix backend run test:skill-fingerprint
```

Run tests with network access blocked/mocked; these commands are not permission for live PR mutations. v0.3.1 validation recorded 182 Python and 95 frontend tests; local v0.3.2 recorded 236 offline Python tests. Backend integrity and unavailable-CDP regression passed after local deployment. W16 is evidence for the XLSX submit-only path; failed W14 does not demonstrate successful XLS import.

## Recovery / deployment
Launchers initialize exact pins, not branch heads. Commit/publish skill changes, pin them, update approval and install dependencies before a reproducible release. Backend restart reloads approval JSON; do not restart while jobs are active. Preserve recovery snapshots/ledgers and backend-host CDP auth; never export credentials into reports.

Original workbooks remain unchanged in the inspected host's Downloads. Investigation evidence is host-local, not committed wholesale: see [snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md). Next actions are in [PENDING.md](PENDING.md); no blind retry of known drafts or submitted PRs.
