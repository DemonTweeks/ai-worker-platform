# AI Worker Platform - Deployment

## Branch Model

`main` is the deployable code line for both local and production use. The former production-only branch is an input to this refactor, not a runtime dependency. Launch scripts operate on the current checkout and pinned submodules without checking out, deleting, or creating branches.

## Environment Model

All variables live under `config/env/` in a combined backend/frontend profile:

| Profile | Tracked contract | Ignored runtime file | Frontend behavior |
| --- | --- | --- | --- |
| Local | `local.env.example` | `local.env` | `/`, hash routing, direct port 8000 API/WS; no Nginx |
| Production | `production.env.example` | `production.env` | `/fe/`, hash routing, same-origin UI/API/WS through Nginx |

The real files must never be committed. Production requires `AI_WORKER_MACHINE_ID`, `FIREBASE_DB_URL`, `ADMIN_DEFAULT_PASSWORD`, and `JWT_SECRET`; `LLM_API_KEY` is also required when LLM features are enabled.

## Windows

```powershell
.\launcher.ps1 -InstallDependencies
.\stop-services.ps1
```

`launcher.ps1` and its `launcher.bat` compatibility wrapper are production-only. Local development on `main` runs `npm.cmd --prefix backend run dev` and `npm.cmd --prefix frontend run dev` directly with `AI_WORKER_PROFILE=local`; it does not use the launcher or Nginx. The Admin deployment endpoint invokes the production launcher and records its handoff log in the configured deployment directory. Both profiles use the same UI and hash router; `VITE_APP_BASE` mounts it at `/` locally and `/fe/` in production. Backend health is served at `/api/health` through the existing production `/api/` proxy; production does not define a separate Nginx `/health` location.

## Linux

```bash
./deploy.sh --install
./stop-services.sh
```

`deploy.sh` is production-only and uses named `screen` sessions. Production requires the host Nginx configuration to use `frontend/nginx.conf`.

## Pin and approval release procedure

1. Inspect tracked/untracked changes; preserve private runtime files. Fetch and fast-forward the chosen platform release only when local work permits.
2. Run `git submodule update --init --recursive`: this uses recorded commits, NOT `.gitmodules` branch tips. Do not use `--remote` as an implicit production upgrade.
3. To upgrade a skill, first review/test/publish its commit in its own repository. Then update the platform gitlink and `backend/src/skills/approvedSkills.json` version/normalized hash together. Do not manually guess the hash; use `calculatePackageFingerprint` from `skillPackageService.js` and the declared include set. Text normalization and byte-exact binary assets both matter.
4. Initialize nested submodules and install requirements into the actual execution interpreter. Updating sibling MW does not update auditor's independently pinned generator.
5. Verify integrity and contract tests, inspect active/queued work and external recovery state, then stop/start deliberately. Keep ledger/snapshot files across deployment. Readiness checks and live version/catalog checks are separate from process creation.

`launcher.ps1` validates production env, syncs/initializes pins, optionally installs dependencies, builds frontend and starts backend/preview. It neither stops old listeners nor waits for readiness. The normal launcher does not run `pip install` unless `-InstallDependencies` is supplied. Backend execution chooses `PYTHON_EXECUTABLE`, then platform `.venv`, then system Python; Windows install logic independently chooses `.venv` or system Python. An override therefore needs explicit dependency installation.

## Windows restart and verification

```powershell
Set-Location C:\deployment\ai-worker-platform
# First inspect active/queued jobs and external mutation ledgers; do not interrupt live uploads.
.\stop-services.bat
if ($LASTEXITCODE -ne 0) { throw 'Stop failed' }
.\launcher.bat
if ($LASTEXITCODE -ne 0) { throw 'Launch failed' }
# Allow bounded startup time before concluding the backend failed.
Invoke-RestMethod http://localhost:8000/api/health
Invoke-RestMethod http://localhost:8000/api/skills
(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).StatusCode
```

Default frontend/backend ports are 3000/8000. Stop scripts target Node listeners on configured ports, not arbitrary services. HTTP `/` on backend is not its health route. Check same-origin `/fe/`, `/api/health` and `/api/skills` through the production host as well. Compare live version with checkout and approval; job `engineCommit=null` does not attest a Git revision.

One recorded restart's immediate health request failed before backend listening; a later restart passed. Do not restart repeatedly or claim a crash from one early connection refusal. Inspect `storage/logs/backend.stdout.log`, `backend.stderr.log`, `frontend.stdout.log`, `frontend.stderr.log`; use a bounded wait and verify listeners. The launcher-reported parent PID may differ from the actual listening Node PID.

## Queue and external recovery

Firebase leases, stable `AI_WORKER_MACHINE_ID`, per-start runtime ID and persistent workspaces are independent requirements. Default queue lease/heartbeat/reconcile intervals are 45/15/30 seconds; concurrency 2. Reconciliation is startup AND periodic. Expired running work is failed, not continued; valid leases remain active. A retryable platform error is not permission to repeat external submission. Inspect existing PSQ, imported lines, mutation intent and server state before recovery. Never erase a ledger to bypass an uncertain import/Submit.

iEPMS needs authenticated CDP on the backend host (not just the frontend browser) and corporate access. Persist `IEPMS_PR_UPLOAD_RUNTIME_ROOT`; blank CDP selection probes 19229, 19222, 19223, so configure a host port deliberately where sessions differ. Do not persist credentials in reports.

## Admin deployment and health limitations

Admin deploy HTTP 202 means asynchronous handoff, not success. Windows handoff runs stop/launcher and appends `deployment-handoff.log`; the in-memory guard ends when the child spawns, not at readiness. Validate service/catalog after handoff. Health's LLM reachability probe can call the provider and is cached for 60 seconds. Recorded Agnes degradation did not stop the core service or the W16 submission; do not assume current reachability from that historical observation.

Sources: `launcher.ps1`, `stop-services.ps1`, `backend/src/services/{childProcessRunner,deploymentService,healthService}.js`, `backend/src/server.js`, `backend/src/queue/jobQueue.js`, `frontend/nginx.conf`.
