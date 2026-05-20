# AI Worker Platform MVP QA Checklist

Use this checklist for controlled internal UAT on the Windows 11 Pro deployment host.

## Automated Checks

Run backend checks:

```powershell
cd backend
$env:MONGO_URI="mongodb://127.0.0.1:27017/ai_worker_platform_test"
npm test
```

Run frontend checks:

```powershell
cd frontend
npm test
```

Expected:

- Backend smoke test passes.
- Backend integration test passes.
- Frontend build passes.
- Frontend route smoke passes.
- Test records and files are cleaned up.

## User Portal Manual UAT

- Open `/`.
- Verify normal users do not need login.
- Upload a valid iEPMS export.
- Run prevalidation.
- Select `TSS`.
- Select specific site code mode.
- Enter lowercase, duplicate, and unmatched site codes.
- Create job.
- Confirm WebSocket progress updates appear.
- Confirm fallback message appears if AI wording is unavailable.
- Confirm final summary appears.
- Confirm warnings and REVIEW_REQUIRED sections are understandable.
- Download ZIP.
- Open ZIP and confirm `ECC_Output/` and `Summary.json` are present.
- Repeat a valid job with `TI` if test data supports it.
- Ask a Re-Ask question and confirm response source/status is visible.

## Job History / Detail Manual UAT

- Open `/history`.
- Search by job ID.
- Filter by status.
- Filter by PR scope.
- Open a completed job detail page.
- Confirm job metadata, scope, generation scope, counts, files, warnings, review-required items, and timeline are visible.
- Confirm ZIP and individual downloads work for available files.
- Confirm expired/unavailable files show disabled download state.
- Open a running job detail page if practical and confirm live updates.

## Admin Portal Manual UAT

- Open `/admin/login`.
- Verify invalid login fails.
- Log in with configured admin credentials.
- Open `/admin/assets`.
- Upload PR Model, Contract Info, and ECC Template test assets.
- Activate one version per asset type.
- Confirm active indicators update.
- Open `/admin/audit-logs`.
- Confirm login, upload, and activation audit entries exist.
- Open `/admin/health`.
- Confirm backend, MongoDB, storage, LLM, queue, WebSocket, disk, and cleanup cards render.
- Log out and confirm admin pages redirect to login.

## Resource Protection Manual UAT

- Oversized upload is rejected.
- Too many Excel rows are rejected.
- Too many site codes are rejected.
- Invalid PR scope is rejected.
- Cleanup dry-run reports candidates and deletes nothing.
- Controlled actual cleanup deletes only expired terminal-job files.
- Active job files remain.
- Active asset files remain.
- Expired file download returns safe error.

## Docker Deployment Checklist

Run on the Windows 11 Pro Docker Desktop host:

```powershell
docker --version
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Verify:

- Frontend opens at `http://localhost:3000`.
- Backend health opens at `http://localhost:8000/health`.
- Frontend can load health through nginx proxy at `http://localhost:3000/health`.
- Admin login works.
- Asset upload/activation works.
- User upload/prevalidation works.
- Real PR Worker job execution works.
- WebSocket progress works.
- Re-Ask works.
- ZIP download works.
- Cleanup dry-run works.

Backup/restore:

- Back up MongoDB volume.
- Back up storage volume.
- Protect `.env`.
- Restore on a clean stack before relying on backups operationally.

## Security Checklist

- `.env` is not committed.
- LLM API key is not visible in frontend bundle.
- Admin password is not stored in frontend.
- JWT token is not printed in logs.
- MongoDB is not publicly exposed.
- Deployment ports are limited to the internal network/firewall.
- Backups are stored securely.
