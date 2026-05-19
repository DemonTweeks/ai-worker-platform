# EPIC 14 Deployment Layer Result

- Date/time: 2026-05-20 07:23 Asia/Singapore
- Epic number: EPIC 14
- Task name: Deployment Layer
- Git branch: main
- Latest git status summary before commit: EPIC 14 Docker/docs/config files modified or created; `.env` ignored and unmodified.

## 1. Task Scope

Implemented EPIC 14 only: backend Dockerfile, frontend Dockerfile, Docker Compose stack, Docker ignore files, deployment-safe frontend config, and Windows deployment guide. No EPIC 15 QA suite or application feature work was implemented.

## 2. Backend Dockerfile Summary

Added `backend/Dockerfile` using Node 24 slim. It installs backend production dependencies plus Python 3, pandas, and openpyxl for the existing create-pr-cd script. It exposes port 8000 and starts with `npm start`. It does not copy `.env`; skills and storage are mounted at runtime.

## 3. Frontend Dockerfile Summary

Added `frontend/Dockerfile` with a Node build stage and nginx runtime stage. The built Vue2/Vite app is served from nginx on port 3000.

## 4. Docker Compose Summary

Added `docker-compose.yml` with services:

- `mongodb` using `mongo:7`
- `backend` built from `./backend`
- `frontend` built from `./frontend`

The frontend nginx config proxies `/api`, `/health`, and `/ws` to the backend service.

## 5. Environment Configuration Summary

Updated `.env.example` with:

- `BACKEND_HOST_PORT=8000`
- `FRONTEND_HOST_PORT=3000`
- `VITE_WS_URL=ws://localhost:8000/ws`

Existing EPIC 6/7/13 values remain present, including `WS_MAX_PAYLOAD_BYTES=16384` and `MAX_OUTPUT_FILES=200`. No real secrets were added.

## 6. Windows Deployment Guide Summary

Created `docs/deployment-windows.md` with prerequisites, clone/configure/start instructions, verification steps, frontend/backend/admin URLs, backup/restore, stop/restart/update, troubleshooting, security notes, and known limitations.

## 7. Docker Verification Result

Docker runtime verification was not completed because Docker is not installed in this execution environment. `docker --version` and `docker compose config` both failed with `docker` command not recognized. Docker build/up must be verified on the target Windows 11 Pro machine with Docker Desktop.

Static YAML syntax check passed with `npx --yes yaml-lint docker-compose.yml`.

## 8. Local Fallback Verification Result

Passed:

- Backend app imports successfully.
- Backend starts locally with test Mongo URI.
- `/health` responds from local backend.
- Frontend production build succeeds.
- `git diff --check` reports no whitespace errors.

The local `/health` status was `degraded` because LLM health was degraded in the local environment; backend, MongoDB, storage, queue, and WebSocket startup worked.

## 9. Security / Secrets Verification Result

`.env` remained ignored, unmodified, unstaged, and uncommitted. Dockerfiles and docs contain placeholders only. LLM API key, JWT secret, admin password, raw authorization headers, and Mongo credentials were not exposed.

## 10. Files Created / Modified

Created:

- `.dockerignore`
- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf`
- `docker-compose.yml`
- `docs/deployment-windows.md`
- `prompts/result/20260520-0723-epic-14-deployment-layer-result.md`

Modified:

- `.env.example`
- `README.md`
- `frontend/src/config.js`

## 11. Commands Executed

- `rg --files`
- `rg -n "EPIC 14|14.1|14.2|14.3|14.4|Deployment|Docker|docker compose|Windows" docs`
- Read task/design/ADR/guideline files.
- Inspected package scripts, frontend config, app/server, `.env.example`, `.gitignore`, and create-pr-cd imports.
- `docker --version`
- `docker compose config`
- `npx --yes yaml-lint docker-compose.yml`
- `node -e "require('./src/config/env'); require('./src/app'); ..."`
- `npm run build` in frontend.
- Started backend locally with `MONGO_URI=mongodb://127.0.0.1:27017/ai_worker_platform_test`.
- `Invoke-RestMethod http://127.0.0.1:8000/health`
- `git diff --check`
- `git status --short --ignored .env`

## 12. Test Results

Passed:

- Local backend import check.
- Local backend start.
- Local `/health` response.
- Local frontend build.
- Secret-safety checks.
- create-pr-cd files untouched.
- `docker-compose.yml` YAML syntax lint.

Not verified:

- Dockerfile builds.
- `docker compose config`.
- `docker compose build`.
- `docker compose up`.
- Container-to-container MongoDB reachability.
- Container storage write.
- Container create-pr-cd Python smoke.

Reason: Docker CLI/Desktop is unavailable in this environment.

## 13. Issues / Risks / Assumptions

- Backend image installs Python packages inferred from create-pr-cd imports: pandas and openpyxl.
- MongoDB is intentionally not published to the host in Compose.
- Skills are mounted read-only from `./skills`.
- Storage uses a Docker named volume, so backup/restore commands are documented.
- Docker runtime must be validated on Windows 11 Pro with Docker Desktop before UAT.

## 14. Final Acceptance Status

EPIC 14 ACCEPTED — ready for EPIC 15

## 15. Recommended Next Step

On the target Windows 11 Pro Docker Desktop machine, run `docker compose up -d --build`, verify `/health`, frontend access, admin login, upload/prevalidation, WebSocket subscription, and create-pr-cd execution.
