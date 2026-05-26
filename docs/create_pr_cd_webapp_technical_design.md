# Technical Design Document: AI Worker Platform - PR Worker MVP

## 1. Document Purpose

This document describes the current technical design for the **AI Worker Platform** with **PR Worker / create-pr-cd** as the first MVP worker. It separates implemented behavior from disabled, deferred, and future platform direction so the document can be used for development, operations, and production-hardening planning.

Core principle:

```text
create-pr-cd = deterministic business correctness
Express backend = orchestration, storage, queue, API, WebSocket
Vue WebApp = business user interface
LLM = optional wording, explanation, and re-ask support
OpenClaw = future trigger channel
```

## 2. Current Implementation Snapshot

| Area | Current implementation |
| --- | --- |
| Repository | Single repo with `frontend/`, `backend/`, `skills/create-pr-cd/`, `storage/`, `docker/`, `docs/`, root `docker-compose.yml`, and `.env.example` |
| Backend runtime | Node.js >= 20, Express.js |
| Backend entry | `backend/src/server.js` |
| Express app | `backend/src/app.js` |
| Mounted backend routes | `/health`, `/api/jobs`, `/api/admin` |
| WebSocket | Initialized from `backend/src/server.js` |
| Startup checks | Storage initialization and Firebase Realtime Database connection check |
| Docker database service | `mongodb` service is defined in root `docker-compose.yml` |
| Current model layer note | Source contains Firebase-backed model compatibility classes; align persistence before production |
| Queue | In-memory FIFO queue in `backend/src/queue/jobQueue.js` |
| Queue durability | Not durable across backend restart |
| Concurrency | Controlled by `MAX_CONCURRENT_JOBS` |
| Worker execution | `backend/src/services/prWorkerService.js` runs `create-pr-cd` through a child process |
| Frontend | Vue 2.7, Vue Router 3, Vite |
| Frontend entry | `frontend/src/main.js` |
| Frontend router | `frontend/src/router.js` |
| Admin assets | Listing shell implemented; upload/activation disabled |

## 3. Product Positioning

### Implemented

The current product is an internal browser application for PR/ECC generation from iEPMS workbook uploads. It supports upload prevalidation, scoped job creation, asynchronous execution, job progress, result review, and downloads.

### Future

The broader platform direction remains a multi-skill AI Worker Platform. PR Worker is the first worker; future workers may include BOQ Worker, EHS Reviewer, L1 Checker, PAC Worker, MW Planning Checker, and Site Navigator Worker.

## 4. High-Level Architecture

```text
Business User
  -> Browser
  -> Vue 2 WebApp
  -> HTTP / WebSocket
  -> Express.js Backend
  -> In-memory FIFO Queue
  -> PR Worker Service
  -> create-pr-cd child process
  -> Output collection, reports, ZIP, final summary
  -> WebApp result UI
```

### Implemented Backend Responsibilities

- REST API routing.
- Public health endpoint.
- WebSocket server and job event publishing.
- Upload prevalidation.
- Job record creation and listing.
- Job detail and download endpoints.
- In-memory FIFO queue management.
- Cancellation request handling.
- iEPMS workbook parsing.
- Site filtering.
- Child process execution of `skills/create-pr-cd`.
- Output collection.
- Summary and final summary saving.
- Report and ZIP generation.
- Admin login/logout and audit log retrieval.

### Deferred/Future Responsibilities

- Durable queue and restart recovery.
- Full normal-user authentication and per-job access control.
- Re-enabled or intentionally removed Admin asset management.
- Production-grade persistence decision and migration.
- OpenClaw trigger integration.
- Multi-skill registry and onboarding.

## 5. Technology Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | Vue 2.7, Vue Router 3, Vite |
| Backend | Express.js, Node.js >= 20 |
| Realtime | `ws` WebSocket server |
| Upload handling | `multer` |
| Excel parsing/output | `xlsx`, `exceljs` |
| ZIP packaging | `archiver` |
| Admin auth | JWT and bcrypt |
| Worker integration | Child process execution |
| Deployment | Docker Compose with `frontend`, `backend`, `mongodb` |
| Storage | Local storage mounted at `/app/storage` in backend container |
| LLM | Optional provider configuration, default model name `Qwen3-235B-A22B` |

## 6. Repository Structure

Current structure:

```text
ai-worker-platform/
|-- frontend/
|   |-- src/
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
|-- backend/
|   |-- src/
|   |   |-- app.js
|   |   |-- server.js
|   |   |-- routes/
|   |   |-- queue/
|   |   |-- services/
|   |   |-- websocket/
|   |   |-- models/
|   |   |-- middleware/
|   |   |-- llm/
|   |   `-- config/
|   `-- package.json
|-- skills/
|   `-- create-pr-cd/
|-- storage/
|   |-- jobs/
|   |-- assets/
|   |-- outputs/
|   `-- temp/
|-- docker/
|-- docs/
|-- docker-compose.yml
`-- .env.example
```

There is no `frontend/vue2-app` directory in the current implementation; the Vue app uses `frontend/src` directly.

## 7. Frontend Design

### Implemented Routes

| Route | Purpose |
| --- | --- |
| `/` | PR Worker upload and generation page |
| `/history` | Job history |
| `/jobs/:jobId` | Job detail |
| `/admin/login` | Admin login |
| `/admin/health` | Admin health console |
| `/admin/assets` | Admin asset listing shell |
| `/admin/audit-logs` | Admin audit log view |

Admin routes are protected by a frontend route guard using `isAdminAuthenticated()`.

### Implemented User Experience

- Upload panel for iEPMS workbook prevalidation.
- Site scope selection using site codes or all sites.
- PR scope support in the job creation payload.
- Job progress display from backend state/events.
- Job history and detail pages.
- Download panel for generated files and ZIP package.
- Re-ask panel connected to `POST /api/jobs/:jobId/ask`.
- Admin health, assets, and audit log screens.

## 8. Backend API Design

### Implemented User APIs

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

### Implemented Admin APIs

```http
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/assets
GET  /api/admin/audit-logs
```

`GET /api/admin/assets` currently returns:

```json
{
  "activeByType": {},
  "items": []
}
```

### Disabled Admin Asset APIs

```http
POST /api/admin/assets/upload
POST /api/admin/assets/:version/activate
```

These routes exist but return `ASSET_MANAGEMENT_DISABLED`. Business assets are owned by `skills/create-pr-cd` and are not user-manageable through the Admin Portal at the moment.

### Health API

```http
GET /health
```

The frontend route `/admin/health` calls the public `/health` endpoint. There is no implemented `GET /api/admin/health` route.

## 9. Job Execution Design

### Implemented Job Flow

```text
1. User uploads iEPMS workbook for prevalidation.
2. Backend validates upload constraints and workbook structure.
3. User creates a job with generation scope and PR scope.
4. Backend stores the uploaded input and creates job metadata.
5. Job is queued in the in-memory FIFO queue.
6. Worker parses the iEPMS workbook.
7. Worker filters site rows.
8. Worker runs create-pr-cd as a child process.
9. Worker collects generated outputs.
10. Worker builds and saves summary data.
11. Worker saves final summary wording.
12. Worker generates reports and ZIP package.
13. Backend publishes WebSocket job events.
14. Job is marked completed, completed with warning, failed, cancelled, or cancelled with partial result.
```

### Implemented Statuses

```text
queued
validating
filtering_sites
loading_assets
generating
exporting
waiting_for_user_input
completed
completed_with_warning
failed
cancelled
cancelled_with_partial_result
```

### Cancellation

Queued jobs can be cancelled before execution. Running jobs receive a cancellation request and stop at worker checkpoints. If partial outputs exist, the job can be marked `cancelled_with_partial_result`.

## 10. Queue Design

### Implemented

The queue is an in-memory FIFO queue:

```text
queuedJobIds[]
activeJobIds Set
knownJobIds Set
```

`MAX_CONCURRENT_JOBS` controls how many jobs run at once.

### Limitation

The queue is not durable. A backend restart loses in-memory queue state and active execution state.

### Future Production Hardening

Replace or back the current queue with a durable queue mechanism so queued/running jobs can recover after process or host restart.

## 11. Child Process Execution

### Implemented

`backend/src/services/prWorkerService.js` delegates generation to the child process runner. The worker receives the filtered input path, generation scope, site codes, PR scope, and cancellation callback.

The backend remains the orchestration layer:

```text
Express backend
  -> parse/filter input
  -> spawn create-pr-cd
  -> capture result
  -> collect outputs
  -> generate platform reports/summaries
```

### Design Rationale

Child process execution keeps the platform loosely coupled from the deterministic `create-pr-cd` skill and reduces blast radius if the skill process fails.

## 12. Storage and Output Design

### Implemented

Runtime storage is rooted at `STORAGE_ROOT`. Docker mounts the named `storage` volume to `/app/storage`.

Tracked file types include uploaded input, filtered input, generated outputs, reports, and ZIP package. Downloads are served through backend routes rather than direct filesystem paths.

The job flow includes:

- Output collection.
- Summary generation.
- Final worker summary saving.
- Report generation.
- ZIP generation.

### Deployment Mounts

Root `docker-compose.yml` mounts:

```yaml
volumes:
  - storage:/app/storage
  - ./skills:/app/skills:ro
```

`CREATE_PR_CD_ROOT` points to `/app/skills/create-pr-cd` in Docker.

## 13. Admin Portal Design

### Implemented

- Admin login with configured default credentials.
- JWT-protected admin routes after login.
- Admin logout.
- Audit log listing.
- Asset listing route and frontend view.
- Health console frontend route.

### Disabled

Admin asset upload and activation are disabled and return `ASSET_MANAGEMENT_DISABLED`.

### Deferred Decision

Asset management should be either:

1. Re-enabled with validation, versioning, activation, rollback, and audit semantics; or
2. Removed from the Admin Portal and documented as repository-managed inside `skills/create-pr-cd`.

Until then, business assets are owned by `skills/create-pr-cd`.

## 14. Health Dashboard

### Implemented

Frontend route:

```text
/admin/health
```

Backend route used by the health console:

```http
GET /health
```

The health response includes service-level information from the backend health service, including backend status, Firebase connection status, storage status, LLM configuration status, queue state, WebSocket state, disk information, and cleanup settings where available.

### Not Implemented

```http
GET /api/admin/health
```

Do not document `/api/admin/health` as implemented unless a route is added.

## 15. WebSocket Design

### Implemented

The WebSocket server is initialized from `backend/src/server.js`. Job events are published by backend services during queueing, validation, filtering, generation, output collection, completion, cancellation, and failure.

Configuration:

| Variable | Purpose |
| --- | --- |
| `WS_HEARTBEAT_INTERVAL_MS` | Heartbeat interval |
| `WS_MAX_PAYLOAD_BYTES` | Maximum WebSocket payload size |

### Design Intent

Clients subscribe to job updates and use HTTP APIs to reload canonical job state when needed.

## 16. LLM Design

### Implemented / Configuration-Dependent

LLM behavior is controlled by:

```text
LLM_ENABLED
LLM_PROVIDER
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
LLM_TIMEOUT_MS
LLM_MAX_RETRIES
LLM_PROGRESS_WORDING_ENABLED
LLM_FINAL_SUMMARY_ENABLED
LLM_REASK_ENABLED
```

When enabled and configured, LLM support can provide progress wording, final summary wording, and re-ask responses. When disabled or unavailable, fallback behavior must preserve deterministic job execution.

### Design Boundary

The LLM must not generate ECC business output or replace `create-pr-cd` business logic. It is for wording, explanation, and user interaction around structured job data.

## 17. Security Design

### Implemented

- Admin login endpoint.
- JWT-protected admin routes after login.
- Password hashing support.
- Upload middleware and configured upload size limits.
- Backend-controlled file download routes.
- Path safety helpers for storage paths.

### Current Limitation

Normal users do not authenticate. They can access job creation, job history, job detail, and downloads on the internal deployment.

### Future

Add normal-user authentication, job ownership, authorization, session management, and audit requirements before broader network exposure.

## 18. Environment and Limits

Important variables:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Backend runtime mode in Docker |
| `PORT` | Backend port |
| `FIREBASE_DB_URL`, `FIREBASE_DB_MOCK` | Firebase check/model settings |
| `MONGO_URI` | Provided in Docker Compose for MongoDB |
| `STORAGE_ROOT` | Runtime file storage root |
| `CREATE_PR_CD_ROOT` | Path to the skill root |
| `WS_HEARTBEAT_INTERVAL_MS`, `WS_MAX_PAYLOAD_BYTES` | WebSocket heartbeat and payload limits |
| `LLM_ENABLED`, `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | LLM provider configuration |
| `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES` | LLM request limits |
| `LLM_PROGRESS_WORDING_ENABLED`, `LLM_FINAL_SUMMARY_ENABLED`, `LLM_REASK_ENABLED` | Optional LLM behavior |
| `MAX_UPLOAD_SIZE_MB` | Upload size limit |
| `MAX_ROW_COUNT` | Workbook row limit |
| `MAX_SITE_CODES` | Site code count limit |
| `MAX_CONCURRENT_JOBS` | Concurrent worker limit |
| `JOB_TIMEOUT_MINUTES` | Worker timeout |
| `MAX_OUTPUT_FILES` | Output file limit |
| `FILE_RETENTION_DAYS` | File retention horizon |
| `ADMIN_DEFAULT_USERNAME`, `ADMIN_DEFAULT_PASSWORD` | Initial admin credentials |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Admin token configuration |

## 19. Deployment Design

### Implemented Docker Compose

The root `docker-compose.yml` defines:

```text
mongodb
backend
frontend
```

Backend environment includes the documented runtime, LLM, WebSocket, limit, admin, and JWT settings. Backend ports map `${BACKEND_HOST_PORT:-8000}:8000`; frontend ports map `${FRONTEND_HOST_PORT:-3000}:3000`.

### Current Internal Access

Typical internal URLs:

```text
Frontend: http://localhost:3000
Backend health: http://localhost:8000/health
```

For Windows/internal machine deployment details, see `docs/deployment-windows.md`.

## 20. OpenClaw Future Integration

### Future Only

OpenClaw remains a future integration channel. It should call the same backend job APIs and should not duplicate `create-pr-cd` business logic.

Future flow:

```text
OpenClaw trigger
  -> Backend job API
  -> Same queue and PR Worker execution
  -> Result link and conversational response
```

## 21. Multi-Skill Platform Direction

### Future Only

The platform should remain designed as:

```text
AI Worker Platform
  -> PR Worker as MVP
  -> additional workers later
```

Future multi-skill capabilities should include:

- Skill registry.
- Worker metadata and routing.
- Common job lifecycle.
- Common storage and audit patterns.
- Worker-specific UI panels only where needed.
- Shared observability and health model.

## 22. Known Gaps vs Original Design

| Original design item | Current state |
| --- | --- |
| Admin-managed PR Model, Contract Info, ECC Template | Disabled; assets owned by `skills/create-pr-cd` |
| Asset upload and activation | Routes return `ASSET_MANAGEMENT_DISABLED` |
| `/api/admin/health` | Not implemented |
| Durable queue | Not implemented; queue is in memory |
| Full MongoDB-backed persistence | Docker includes MongoDB, but current source includes Firebase-backed model compatibility |
| Normal-user login and access control | Not implemented |
| HTTPS/reverse proxy | Not part of current compose stack |
| OpenClaw integration | Future only |
| Multi-skill platform | Future direction only |
| Admin account management | Deferred |

## 23. Production Hardening Recommendations

1. Durable queue: replace the process-memory queue with a durable queue and recovery model.
2. Normal-user authentication/access control: add user identity, job ownership, and download authorization.
3. HTTPS / reverse proxy: deploy behind HTTPS with appropriate hostnames, headers, and timeout settings.
4. Health endpoint coverage: decide whether to add authenticated admin health APIs or keep `/health` public with safe content.
5. Storage cleanup verification: test retention cleanup, expired-file behavior, and ZIP/report availability.
6. MongoDB and storage backup strategy: decide persistence ownership, then define backup/restore for metadata and files.
7. Centralized logging: add structured logs and operational log retention.
8. Admin account management: support account rotation, password changes, and least-privilege access if multiple admins are needed.
9. Asset management decision: either implement validated versioned asset management or remove disabled UI/API paths.

## 24. MVP Completion Definition

The current MVP foundation is considered aligned when it can:

```text
1. Serve the Vue WebApp.
2. Accept iEPMS upload prevalidation.
3. Create PR Worker jobs.
4. Queue jobs with MAX_CONCURRENT_JOBS.
5. Parse and filter iEPMS workbook rows.
6. Execute create-pr-cd as a child process.
7. Collect outputs.
8. Generate summaries, reports, and ZIP packages.
9. Publish WebSocket job events.
10. Support job detail, history, cancellation, and downloads.
11. Provide admin login/logout and audit logs.
12. Show health information through /admin/health using /health.
13. Clearly communicate disabled Admin asset management.
14. Document that queue durability and broader platform capabilities are future hardening.
```
