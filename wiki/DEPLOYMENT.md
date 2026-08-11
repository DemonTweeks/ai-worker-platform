# AI Worker Platform - Deployment

## Branch Model

`main` is the deployable code line for both local and production use. The former production-only branch is an input to this refactor, not a runtime dependency. Launch scripts operate on the current checkout and pinned submodules without checking out, deleting, or creating branches.

## Environment Model

All variables live under `config/env/` in a combined backend/frontend profile:

| Profile | Tracked contract | Ignored runtime file | Frontend behavior |
| --- | --- | --- | --- |
| Local | `local.env.example` | `local.env` | `/`, history routing, direct port 8000 API/WS |
| Production | `production.env.example` | `production.env` | `/fe/`, hash routing, same-origin API/WS through Nginx |

The real files must never be committed. Production requires `AI_WORKER_MACHINE_ID`, `FIREBASE_DB_URL`, `ADMIN_DEFAULT_PASSWORD`, and `JWT_SECRET`; `LLM_API_KEY` is also required when LLM features are enabled.

## Windows

```powershell
.\launcher.ps1 -Profile local -InstallDependencies
.\launcher.ps1 -Profile production -InstallDependencies
.\stop-services.ps1
```

`launcher.bat` is a compatibility wrapper. With no argument it launches local mode; `launcher.bat production` launches production. The Admin deployment endpoint invokes the production form explicitly and records its handoff log in the configured deployment directory. Backend health is served at `/api/health` through the existing `/api/` proxy; production does not define a separate Nginx `/health` location.

## Linux

```bash
./deploy.sh local --install
./deploy.sh production --install
./stop-services.sh
```

The shell launcher uses named `screen` sessions. Production requires the host Nginx configuration to use `frontend/nginx.conf`.
