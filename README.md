# AI Worker Platform

## Project Overview

AI Worker Platform is the internal platform foundation for browser-based AI worker workflows. The first MVP worker is **PR Worker**, which wraps the existing `skills/create-pr-cd` business logic behind a Vue web app, an Express API, asynchronous job execution, WebSocket progress updates, and downloadable results.

The platform goal is to let business users generate PR/ECC outputs without VS Code, Git, Codex, terminal access, or local runtime setup.

## Current MVP Scope

| Area | Current state |
| --- | --- |
| Worker | PR Worker / `create-pr-cd` only |
| Frontend | Vue 2.7, Vue Router 3, Vite |
| Backend | Node.js >= 20, Express.js |
| Execution | Async job flow with in-memory FIFO queue |
| Realtime | WebSocket server initialized by `backend/src/server.js` |
| Storage | Local `storage/` tree mounted into the backend container |
| Deployment | Root `docker-compose.yml` with `mongodb`, `backend`, and `frontend` services |
| Admin | Login/logout, asset listing shell, audit logs, health UI |
| LLM | Configuration-dependent through `LLM_ENABLED` and related settings |

## Implemented Architecture

```text
Business user
  -> Vue 2 web app
  -> Express REST API + WebSocket
  -> In-memory FIFO job queue
  -> PR Worker orchestration service
  -> create-pr-cd child process
  -> Local output collection, reports, ZIP, summaries
```

Backend startup performs storage initialization and a Firebase Realtime Database connection check. Docker Compose also provisions MongoDB and passes `MONGO_URI` to the backend container; the current source still contains a Firebase-backed model compatibility layer, so persistence should be reviewed before production hardening.

## Repository Structure

```text
ai-worker-platform/
|-- frontend/              # Vue 2.7 + Vite web app
|-- backend/               # Express API, queue, worker orchestration, WebSocket
|-- skills/create-pr-cd/   # Existing PR/ECC generation skill and business assets
|-- storage/               # Runtime storage placeholders for jobs, assets, outputs, temp
|-- docker/                # Deployment support artifacts
|-- docs/                  # Product, architecture, deployment, QA documentation
|-- docker-compose.yml     # Root Docker Compose stack
`-- .env.example           # Local environment template
```

## Backend Capabilities

| Capability | Implementation |
| --- | --- |
| Entry point | `backend/src/server.js` |
| Express app | `backend/src/app.js` |
| Mounted routes | `/health`, `/api/jobs`, `/api/admin` |
| Job queue | In-memory FIFO queue in `backend/src/queue/jobQueue.js` |
| Concurrency | Controlled by `MAX_CONCURRENT_JOBS` |
| Worker execution | `backend/src/services/prWorkerService.js` |
| Skill integration | `create-pr-cd` executed as a child process |
| WebSocket | Initialized from `server.js`; publishes job events |
| Upload validation | File size, workbook readability, row count, required structure |
| Job handling | Creation, queueing, cancellation, failure handling, summaries, reports, downloads |

Implemented job flow:

```text
Upload prevalidation
  -> Job creation
  -> Queueing
  -> iEPMS workbook parsing
  -> Site filtering
  -> create-pr-cd child process execution
  -> Output collection
  -> Summary generation
  -> Final summary saving
  -> Report and ZIP generation
  -> WebSocket job event publishing
```

## Frontend Capabilities

The frontend entry point is `frontend/src/main.js`; routes are defined in `frontend/src/router.js`.

| Route | Purpose |
| --- | --- |
| `/` | PR Worker upload and job creation |
| `/history` | Job history |
| `/jobs/:jobId` | Job detail, outputs, summary, re-ask panel |
| `/admin/login` | Admin login |
| `/admin/health` | Health console using the public `/health` backend route |
| `/admin/assets` | Asset listing view |
| `/admin/audit-logs` | Admin audit log view |

Admin routes use the frontend auth guard based on `isAdminAuthenticated()`.

## Job Lifecycle

1. User uploads an iEPMS workbook for prevalidation.
2. User selects `site_code` with site codes or `all_sites`.
3. Backend creates a job and stores the uploaded file under `storage/`.
4. Job enters the in-memory FIFO queue.
5. Worker parses the workbook and filters rows by site scope.
6. Backend runs `skills/create-pr-cd` as a child process.
7. Outputs are collected, reports and ZIP package are generated, and a final summary is saved.
8. WebSocket events update the UI throughout execution.
9. User downloads individual files or the ZIP package.

## Admin Capabilities and Current Limitations

| Feature | Status |
| --- | --- |
| `POST /api/admin/login` | Implemented |
| `POST /api/admin/logout` | Implemented |
| `GET /api/admin/assets` | Implemented, currently returns an empty asset structure |
| `GET /api/admin/audit-logs` | Implemented |
| Asset upload | Disabled; returns `ASSET_MANAGEMENT_DISABLED` |
| Asset activation | Disabled; returns `ASSET_MANAGEMENT_DISABLED` |

Business assets are currently owned by `skills/create-pr-cd` and are not user-manageable through the Admin Portal.

## Environment Variables

Core variables from `.env.example` and Docker Compose:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Backend runtime mode in Docker |
| `PORT` | Backend port, default `8000` |
| `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` | Docker host port bindings |
| `FIREBASE_DB_URL`, `FIREBASE_DB_MOCK` | Firebase Realtime Database connection/check settings |
| `MONGO_URI` | Provided by Docker Compose for the MongoDB service |
| `STORAGE_ROOT` | Backend storage root |
| `CREATE_PR_CD_ROOT` | Path to `skills/create-pr-cd` |
| `WS_HEARTBEAT_INTERVAL_MS`, `WS_MAX_PAYLOAD_BYTES` | WebSocket runtime limits |
| `LLM_ENABLED`, `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | LLM provider configuration |
| `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES` | LLM request behavior |
| `LLM_PROGRESS_WORDING_ENABLED`, `LLM_FINAL_SUMMARY_ENABLED`, `LLM_REASK_ENABLED` | Optional LLM features |
| `MAX_UPLOAD_SIZE_MB`, `MAX_ROW_COUNT`, `MAX_SITE_CODES` | Upload and request limits |
| `MAX_CONCURRENT_JOBS`, `JOB_TIMEOUT_MINUTES` | Worker execution limits |
| `MAX_OUTPUT_FILES`, `FILE_RETENTION_DAYS` | Output and retention limits |
| `ADMIN_DEFAULT_USERNAME`, `ADMIN_DEFAULT_PASSWORD` | Initial admin credentials |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Admin token signing and expiry |
| `VITE_API_BASE_URL`, `VITE_WS_URL` | Frontend API and WebSocket targets |

## Local Development

1. Copy `.env.example` to `.env` and adjust local values.
2. Install and run the backend:

```bash
cd backend
npm install
npm run dev
```

3. Install and run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend health is available at `http://localhost:8000/health`.
Frontend runs at `http://localhost:3000`.

Useful checks:

```bash
cd backend
npm test

cd ../frontend
npm test
```

## Local Python Worker Runtime

The PR Worker backend launches the Python-based `create-pr-cd` worker from this repository and expects a project-local virtual environment for worker dependencies.

Recommended local setup on Windows:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-worker.txt
.\.venv\Scripts\python.exe -c "import pandas, openpyxl; print('worker deps OK')"
```

If you need the backend to use a specific interpreter, set `PYTHON_EXECUTABLE` in `.env` to that Python path. When it is blank, the backend checks the repository root `.venv` first and then falls back to the platform default command.

## Docker Deployment

The root `docker-compose.yml` defines:

| Service | Purpose |
| --- | --- |
| `mongodb` | MongoDB 7 service with `mongo-data` volume |
| `backend` | Express API and worker runner |
| `frontend` | Built Vue app served on port `3000` |

Backend mounts:

```text
storage:/app/storage
./skills:/app/skills:ro
```

Start the stack:

```bash
docker compose up -d --build
```

Windows deployment notes are in `docs/deployment-windows.md`.

## API Summary

User/job APIs:

```http
POST /api/jobs/prevalidate
POST /api/jobs
GET  /api/jobs
GET  /api/jobs/:jobId
POST /api/jobs/:jobId/cancel
GET  /api/jobs/:jobId/download-zip
GET  /api/jobs/:jobId/download/:fileId
POST /api/jobs/:jobId/ask
```

Admin APIs:

```http
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/assets
GET  /api/admin/audit-logs
```

Disabled admin asset APIs:

```http
POST /api/admin/assets/upload
POST /api/admin/assets/:version/activate
```

Health:

```http
GET /health
```

There is no implemented `GET /api/admin/health` route; the Admin Health frontend reads `/health`.

## Current Limitations / Known Gaps

- The queue is in memory only and is not durable across backend restarts.
- Normal users do not have authentication or per-user access control.
- Admin asset upload and activation are disabled.
- Business assets remain inside `skills/create-pr-cd`.
- Docker Compose provisions MongoDB, but the current model compatibility layer is Firebase-backed; persistence ownership should be aligned.
- HTTPS and reverse proxy deployment are not included in the MVP stack.
- Health coverage is available at `/health`; admin-specific health API coverage is not implemented.
- File retention and cleanup behavior should be verified operationally.
- LLM behavior depends on `LLM_ENABLED` and provider configuration.

## Future Roadmap

- Durable production queue with restart recovery.
- Normal-user authentication, authorization, and job ownership.
- HTTPS/reverse proxy deployment profile.
- Production logging, monitoring, backup, and restore strategy.
- Explicit decision on MongoDB vs Firebase-backed persistence.
- Admin account management.
- Re-enabled or intentionally removed Admin asset management.
- OpenClaw integration as an additional trigger channel.
- Multi-skill platform capabilities: worker registry, skill onboarding, and additional workers beyond PR Worker.
