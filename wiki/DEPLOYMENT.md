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
