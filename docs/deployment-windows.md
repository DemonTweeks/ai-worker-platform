# Windows Deployment Guide

This guide deploys the AI Worker Platform MVP on a Windows 11 Pro internal machine using Docker Desktop and Docker Compose.

## 1. Prerequisites

- Windows 11 Pro with virtualization enabled.
- Docker Desktop installed and running.
- Git installed.
- Network access to the internal MaaS/Qwen endpoint if `LLM_ENABLED=true`.
- Access to a valid MaaS/Qwen API key if LLM wording and Re-Ask should use the real provider.

## 2. Clone the Repository

```powershell
git clone https://github.com/DemonTweeks/ai-worker-platform.git
cd ai-worker-platform
```

## 3. Configure Environment

Create a local `.env` file from the safe sample:

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally. Do not commit `.env`.

Required values to review:

- `PORT`
- `BACKEND_HOST_PORT`
- `FRONTEND_HOST_PORT`
- `MONGO_URI`
- `STORAGE_ROOT`
- `CREATE_PR_CD_ROOT`
- `LLM_ENABLED`
- `LLM_PROVIDER`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_TIMEOUT_MS`
- `LLM_MAX_RETRIES`
- `MAX_UPLOAD_SIZE_MB`
- `MAX_ROW_COUNT`
- `MAX_SITE_CODES`
- `MAX_CONCURRENT_JOBS`
- `JOB_TIMEOUT_MINUTES`
- `FILE_RETENTION_DAYS`
- `MAX_OUTPUT_FILES`
- `WS_HEARTBEAT_INTERVAL_MS`
- `WS_MAX_PAYLOAD_BYTES`
- `ADMIN_DEFAULT_USERNAME`
- `ADMIN_DEFAULT_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

For Docker Compose, `MONGO_URI`, `STORAGE_ROOT`, and `CREATE_PR_CD_ROOT` are set inside `docker-compose.yml` so containers use Docker networking and mounted paths. Keep the sample values useful for local non-Docker development.

LLM notes:

- Put the real MaaS/Qwen API key only in local `.env`.
- Never commit `.env`.
- If `LLM_ENABLED=false`, the backend uses deterministic fallback wording.
- The frontend never receives the LLM API key.

## 4. Start the Stack

Build and start all services:

```powershell
docker compose up -d --build
```

Services:

- `frontend` on `http://localhost:3000` by default.
- `backend` on `http://localhost:8000` by default.
- `mongodb` on the internal Docker network only.

Use `FRONTEND_HOST_PORT` and `BACKEND_HOST_PORT` in `.env` to change host ports.

## 5. Verify Deployment

Check containers:

```powershell
docker compose ps
```

Check backend health:

```powershell
Invoke-RestMethod http://localhost:8000/health | ConvertTo-Json -Depth 10
```

Open the frontend:

```text
http://localhost:3000
```

For internal LAN access, use the Windows host IP:

```text
http://10.x.x.x:3000
```

Admin portal:

```text
http://localhost:3000/admin/login
```

Smoke checks:

- Normal user portal loads.
- `/health` shows backend, MongoDB, storage, queue, WebSocket, cleanup, and LLM status.
- Admin login succeeds with configured admin credentials.
- Upload/prevalidation accepts a valid iEPMS Excel file.
- WebSocket progress connects when a job is running.

## 6. Volumes and Runtime Data

Docker Compose creates persistent volumes:

- `mongo-data` for MongoDB.
- `storage` for uploaded files, generated outputs, reports, ZIP files, and admin assets.

The PR Worker skill is mounted read-only from:

```text
./skills
```

The backend reads the skill from:

```text
/app/skills/create-pr-cd
```

The backend writes runtime files under:

```text
/app/storage
```

## 7. Backup

Back up before upgrades or machine maintenance.

MongoDB dump:

```powershell
docker compose exec mongodb mongodump --archive=/tmp/ai-worker-platform.archive
docker compose cp mongodb:/tmp/ai-worker-platform.archive .\backup\ai-worker-platform.archive
```

Storage volume archive:

```powershell
docker run --rm -v ai-worker-platform_storage:/data -v ${PWD}\backup:/backup alpine tar czf /backup/storage.tgz -C /data .
```

Also keep a copy of:

- `.env` from the deployment machine.
- Any admin-uploaded source asset files if separately managed.
- The Git commit hash used for deployment.

Do not publish backups publicly. They may contain input Excel files, generated outputs, and operational metadata.

## 8. Restore Overview

Stop the stack:

```powershell
docker compose down
```

Restore storage:

```powershell
docker run --rm -v ai-worker-platform_storage:/data -v ${PWD}\backup:/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/storage.tgz -C /data"
```

Restore MongoDB:

```powershell
docker compose up -d mongodb
docker compose cp .\backup\ai-worker-platform.archive mongodb:/tmp/ai-worker-platform.archive
docker compose exec mongodb mongorestore --archive=/tmp/ai-worker-platform.archive --drop
```

Start the full stack:

```powershell
docker compose up -d
```

## 9. Stop, Restart, and Update

Stop containers without removing volumes:

```powershell
docker compose stop
```

Restart:

```powershell
docker compose restart
```

Stop and remove containers while keeping named volumes:

```powershell
docker compose down
```

Update deployment:

```powershell
git pull
docker compose up -d --build
```

## 10. Troubleshooting

Backend cannot connect to MongoDB:

- Check `docker compose ps`.
- Check backend logs with `docker compose logs backend`.
- Confirm Compose sets `MONGO_URI=mongodb://mongodb:27017/ai-worker-platform`.

Storage not writable:

- Check `/health` storage status.
- Confirm the `storage` volume is mounted to `/app/storage`.
- Check Docker Desktop file/volume permissions.

create-pr-cd not found:

- Confirm `./skills/create-pr-cd/scripts/generate_tss_pr_ecc.py` exists.
- Confirm backend has `CREATE_PR_CD_ROOT=/app/skills/create-pr-cd`.
- Check backend logs for path validation errors.

Python dependency missing:

- Rebuild backend with `docker compose build backend`.
- Backend image installs Python 3, pandas, and openpyxl for the existing PR Worker script.

Frontend cannot reach backend:

- Open `http://localhost:3000/health`; nginx proxies it to the backend.
- Confirm backend is healthy.
- Check frontend container logs.

WebSocket connection failed:

- Confirm `/ws` is proxied by nginx.
- Check backend WebSocket status in `/health`.
- Check browser network tools for failed `ws://.../ws` connection.

LLM configured but degraded:

- Confirm `LLM_ENABLED`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` in local `.env`.
- Confirm the Windows host can reach the internal MaaS/Qwen endpoint.
- Do not paste API keys into logs, screenshots, or tickets.

Admin login issue:

- Confirm `ADMIN_DEFAULT_USERNAME`, `ADMIN_DEFAULT_PASSWORD`, and `JWT_SECRET` are configured.
- Check backend logs for sanitized auth errors.
- Rotate `JWT_SECRET` if credentials may have leaked.

## 11. Security Notes

- Keep the deployment on the internal network.
- Do not expose MongoDB publicly.
- Do not expose frontend/backend ports to the internet without firewall and security review.
- Use a strong `JWT_SECRET`.
- Change `ADMIN_DEFAULT_PASSWORD` before use.
- Protect `.env` and backups.
- Do not put API keys in frontend files.
- Rotate credentials when operators change.

## 12. Known Limitations

- This is a local single-machine MVP deployment.
- It is not high availability.
- It is not a cloud production architecture.
- MongoDB is deployed without authentication for the internal MVP Docker network.
- Cleanup service is manual/testable; no automatic cleanup scheduler is enabled.
- Frontend environment values are build-time values, but the Docker image is configured to use nginx same-origin proxying by default.
