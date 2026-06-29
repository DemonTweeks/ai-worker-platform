# Windows Local Development and Controlled Deployment Guide

**Status:** Current operating guide  
**Baseline:** `main` at and after `29cbd382c92222b4f555d1926f106e1c66837404`

## 1. Scope

This guide covers the supported Windows developer setup for both MW PR Worker and RAN PR Worker.

The recommended baseline is **local Node services plus one repository-root Python virtual environment**. Docker Compose remains available for controlled internal deployment, but it must be UAT-validated for the exact worker modes, persistence configuration and network environment before operational use.

## 2. Prerequisites

- Windows 11 or equivalent Windows development host
- Git
- Node.js 20 or later
- Python 3
- access to the repository and both submodules
- optional internal LLM endpoint and credentials only when LLM features are enabled

## 3. Clone and Initialize Worker Engines

New clone:

```powershell
git clone --recurse-submodules https://github.com/DemonTweeks/ai-worker-platform.git
cd ai-worker-platform
git submodule update --init --recursive
```

Existing clone:

```powershell
git fetch origin --prune
git switch main
git pull --ff-only origin main
git submodule sync --recursive
git submodule update --init --recursive
git status --short
git submodule status
```

Confirm both engine folders exist:

```text
skills/create-pr-cd
skills/create-pr-cd-ran
```

The RAN submodule must resolve to `239910e2816153339a94881597bbb95355059741` for the approved v1.0.0 baseline.

## 4. Local Environment Configuration

Create local-only configuration files:

```powershell
Copy-Item .env.example .env
@"
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws
"@ | Set-Content frontend\.env.local
```

Do not commit `.env`, `frontend/.env.local`, runtime storage, generated workbooks, ZIP files, Firebase exports or worker workspaces.

Review at minimum:

```text
FIREBASE_DB_URL
FIREBASE_DB_MOCK
STORAGE_ROOT
CREATE_PR_CD_ROOT
PYTHON_EXECUTABLE
MAX_CONCURRENT_JOBS
JOB_TIMEOUT_MINUTES
MAX_OUTPUT_FILES
FILE_RETENTION_DAYS
ADMIN_DEFAULT_USERNAME
ADMIN_DEFAULT_PASSWORD
JWT_SECRET
LLM_ENABLED and LLM_* values when used
```

Use strong non-default values for admin credentials and `JWT_SECRET` on any shared machine.

## 5. Deterministic Python Runtime

Create one repository-root virtual environment and use it for platform worker execution:

```powershell
py -3 -m venv .venv
$python = (Resolve-Path .\.venv\Scripts\python.exe).Path
& $python -m pip install --upgrade pip
& $python -m pip install -r requirements-worker.txt
& $python -m pip install -r skills\create-pr-cd\requirements.txt
Add-Content .env ('PYTHON_EXECUTABLE="' + $python + '"')
```

The application resolves Python in this order:

1. `PYTHON_EXECUTABLE`, when it resolves safely.
2. repository-root `.venv`.
3. a safely resolved `python` or `python3` PATH fallback.

The process runner uses `shell: false`. Do not rely on an unresolved bare executable command. A quoted Windows interpreter path with spaces is supported in `.env`.

## 6. Install and Run the Platform

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci

npm.cmd --prefix backend run dev
npm.cmd --prefix frontend run dev
```

Open:

```text
Frontend: http://localhost:3000
Backend health: http://localhost:8000/health
```

## 7. Local Verification

Baseline automated checks:

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix backend run test:preflight
git diff --check
```

RAN-sensitive checks after changes to RAN behavior, shared lifecycle services, runtime resolution, cancellation or outputs:

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

Run Firebase-backed tests that share a test backend serially.

## 8. Manual Worker UAT

### MW smoke

- create and complete an existing MW TI smoke run using the approved test scope
- verify progress, Job Detail, output downloads and ZIP

### RAN Standard PR

- upload a valid RAN BOM and EPMS workbook
- select Standard PR
- verify successful completion and usable ECC ZIP output

### RAN General Item PR

- upload valid RAN BOM and EPMS workbooks
- select General Item mode and a catalog-provided project only
- verify General Item output and ZIP

### RAN invalid-input safeguard

- upload EPMS workbook into BOM slot
- confirm it is blocked before queueing with a safe RAN BOM structure failure
- confirm no completed job, placeholder ECC workbook or successful ZIP is created

## 9. Docker Compose: Controlled Internal Deployment Only

The repository includes `docker-compose.yml` with `mongodb`, `backend` and `frontend` services. The backend image installs Python 3, `pandas` and `openpyxl`, and mounts `./skills` read-only.

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Do not treat Compose startup alone as production approval. Before using it operationally, validate on the target host:

- both MW and RAN workers can run with the mounted submodules
- RAN workspaces are isolated and writable under platform storage
- Python resolution and required packages are correct inside the backend container
- Firebase/job history behavior matches the intended persistence configuration
- ZIP/download and WebSocket behavior work through the actual frontend route
- credentials and `.env` are protected

### Important persistence note

The current platform job/history model is Firebase-backed. Docker Compose still provisions a MongoDB service as legacy deployment infrastructure. Do not assume the MongoDB volume is the authoritative job-history backup without verifying the active persistence configuration in the deployed code and environment.

## 10. Update Procedure

For a controlled upgrade:

```powershell
git fetch origin --prune
git switch main
git pull --ff-only origin main
git submodule sync --recursive
git submodule update --init --recursive
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
```

Then run the verification relevant to the changed scope before restarting services.

Never update the RAN submodule pointer independently of an approved platform compatibility change.

## 11. Troubleshooting

### Missing Python dependency

- verify `PYTHON_EXECUTABLE` points to the intended interpreter
- run the preflight test
- install `requirements-worker.txt` into that interpreter
- install MW engine requirements when MW execution requires them

### RAN job cannot start

- verify `skills/create-pr-cd-ran` exists and is pinned to the approved SHA
- run `git submodule update --init --recursive`
- verify BOM/EPMS files were placed in the correct fields
- run the RAN prevalidation and output-validation regression commands

### RAN output is rejected

This is an intentional safety control when ECC files are empty, header-only, placeholder-shaped or lack meaningful rows. Check the safe failure diagnosis and inputs; do not manually mark the job as completed.

### Job cancelled but shows failure

Cancellation precedence is regression-sensitive. Re-run the cancellation-related RAN tests before changing lifecycle code.

### Frontend cannot reach backend

- verify `VITE_API_BASE_URL` and `VITE_WS_URL` in `frontend/.env.local`
- verify backend health at `http://localhost:8000/health`
- confirm the frontend build/dev server was restarted after environment changes

## 12. Security and Cleanup Rules

- Never commit `.env`, `.env.local`, API keys, passwords, tokens or Firebase exports.
- Keep generated Excel output, ZIP files and `storage/ran-workspaces/` untracked.
- Do not expose backend or frontend directly to the internet without network, authentication and reverse-proxy review.
- Rotate `JWT_SECRET`, admin passwords and any leaked key immediately.
- Keep the RAN engine submodule read-only at runtime.
