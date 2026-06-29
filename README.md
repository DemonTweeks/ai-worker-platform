# AI Worker Platform

AI Worker Platform is an internal web platform for running approved business-domain workers through a shared, browser-based job lifecycle.

The current baseline provides two PR worker families:

| Worker | Worker ID | Business-rule owner | Current capability |
| --- | --- | --- | --- |
| MW PR Worker | `mw-pr` | `skills/create-pr-cd` | Existing MW TSS/TI PR and ECC workflow |
| RAN PR Worker | `ran-pr` | Pinned `skills/create-pr-cd-ran` submodule | Standard PR and General Item PR |

**Current merged baseline:** RAN PR Worker merged through PR #17 at `29cbd382c92222b4f555d1926f106e1c66837404`.

## What the Platform Owns

The platform owns the shared product and runtime responsibilities:

- Vue frontend, worker selection, uploads, live progress and download UX
- Express API, queue dispatch, cancellation and timeout lifecycle
- per-job workspaces, file metadata, ZIP packaging and output collection
- Firebase-backed job history, Job Detail and audit metadata
- WebSocket progress events
- safe user-facing errors, warnings and failure diagnosis
- controlled Python interpreter resolution and dependency preflight

Worker engines own their domain business rules, configurations, templates and input/output transformations. The platform must not duplicate or modify engine-owned rules.

## RAN PR Worker Baseline

The RAN engine is a read-only pinned Git submodule:

```text
skills/create-pr-cd-ran
v1.0.0
239910e2816153339a94881597bbb95355059741
```

RAN v1 supports:

- BOM upload and semantic BOM prevalidation
- EPMS upload
- Standard PR
- General Item PR, using a configuration-derived and backend-validated project selection
- isolated execution of normalize → calculation → PR generation → ECC export
- ECC output validation, ZIP download, History and Job Detail

RAN BOM Comparison is **not implemented**. It must not be presented as an available action, route or menu item.

### Lifecycle safeguards

The RAN integration protects against false success:

- wrong BOM structures are rejected before queueing
- placeholder, header-only and empty ECC workbooks are rejected
- invalid outputs do not contribute to output count or successful ZIP creation
- zero valid outputs become `failed`, unless cancellation semantics apply
- cancelled jobs with valid partial output become `cancelled_with_partial_result`
- RAN Python stages inherit the platform job timeout when no explicit valid timeout exists

## Architecture

```mermaid
flowchart LR
  U[Business User] --> UI[Vue Platform UI]
  UI --> API[Express API]
  API --> Q[Platform Queue and Job Service]
  Q --> WR[Worker Registry]
  WR --> MW[MW PR Adapter]
  WR --> RAN[RAN PR Adapter]
  MW --> MWE[MW Engine]
  RAN --> WS[Per-job RAN Workspace]
  RANEngine[Read-only RAN Engine Submodule] --> WS
  WS --> PY[Resolved Python Runtime]
  PY --> OUT[Validated Outputs]
  MWE --> OUT
  OUT --> STORE[Platform Storage and ZIP]
  OUT --> HISTORY[Firebase-backed History and Job Detail]
  Q --> WSS[WebSocket Progress]
  WSS --> UI
  STORE --> UI
  HISTORY --> UI
```

## Repository Layout

```text
ai-worker-platform/
├─ frontend/                    # Vue application
├─ backend/                     # Express API, queue, workers and services
├─ skills/
│  ├─ create-pr-cd/             # MW engine assets
│  └─ create-pr-cd-ran/         # Pinned RAN engine submodule (read-only)
├─ storage/                     # Platform runtime storage; generated content is untracked
├─ docs/                        # Current documentation, architecture and historical evidence
├─ requirements-worker.txt      # Shared Python runtime dependencies
└─ .env.example                 # Safe local configuration template
```

## Local Development (Windows)

### 1. Clone with worker engines

```powershell
git clone --recurse-submodules https://github.com/DemonTweeks/ai-worker-platform.git
cd ai-worker-platform
git submodule update --init --recursive
```

For an existing clone:

```powershell
git pull --ff-only origin main
git submodule sync --recursive
git submodule update --init --recursive
```

### 2. Configure local environment

```powershell
Copy-Item .env.example .env
@"
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws
"@ | Set-Content frontend\.env.local
```

Keep `.env`, `frontend/.env.local`, runtime workspaces and generated outputs untracked.

### 3. Create a deterministic Python runtime

```powershell
py -3 -m venv .venv
$python = (Resolve-Path .\.venv\Scripts\python.exe).Path
& $python -m pip install --upgrade pip
& $python -m pip install -r requirements-worker.txt
& $python -m pip install -r skills\create-pr-cd\requirements.txt
Add-Content .env ('PYTHON_EXECUTABLE="' + $python + '"')
```

The backend resolves Python in this order: `PYTHON_EXECUTABLE`, repository `.venv`, then a safely resolved system interpreter. Do not pass unresolvable bare commands into runtime execution.

### 4. Install and run Node services

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci

npm.cmd --prefix backend run dev
npm.cmd --prefix frontend run dev
```

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`

## Verification

Run the normal platform checks:

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix backend run test:preflight
git diff --check
```

Run the RAN-focused regression checks when RAN behavior, shared lifecycle services, Python execution or output handling changes:

```powershell
npm.cmd --prefix backend run test:ran-output-validation
npm.cmd --prefix backend run test:ran-placeholder-runtime
npm.cmd --prefix backend run test:ran-golden
npm.cmd --prefix backend run test:ran-history-reload
npm.cmd --prefix backend run test:ran-concurrency
npm.cmd --prefix backend run test:ran-invalid-safe-errors
npm.cmd --prefix backend run test:ran-worker-service
npm.cmd --prefix backend run test:ran-routes
```

Firebase-backed tests that share a test backend must run serially.

## Operational Rules

- Do not update the RAN submodule without explicit approval.
- Do not edit RAN business logic in `skills/create-pr-cd-ran` from the platform repository.
- Do not execute RAN jobs in the upstream fixed `input/` or `output/` folders.
- Keep RAN workspaces isolated under platform-owned storage.
- Treat output validation, cancellation precedence, timeouts, safe errors and final-summary ordering as regression-sensitive lifecycle areas.
- Do not commit generated Excel files, ZIPs, Firebase exports, `.env` files or runtime workspaces.

## Documentation

Start with [docs/README.md](docs/README.md).

Current operational references:

- [Platform Architecture and Operating Baseline](docs/AI_Worker_Platform_Technical_Architecture_and_Business_Logic_Reference_v0.1.md)
- [RAN PR Worker Integration Technical Reference](docs/AI_Worker_Platform_RAN_PR_Worker_Integration_Technical_Reference.md)
- [Windows Local Development and Deployment Guide](docs/deployment-windows.md)
- [QA and UAT Checklist](docs/qa-checklist.md)

Historical project plans, autonomous-run logs, prior acceptance evidence and design records remain in `docs/` as evidence. They are not current operating instructions unless explicitly labeled as such.
