# EPIC 3 Backend Core API Result

- Date/time: 2026-05-20 00:07:46 +08:00
- Epic number: EPIC 3
- Task name: Backend Core API Layer
- Git branch: main
- Latest git status summary before archive: backend API files modified/created; result archive pending

## Task Scope

Implemented only EPIC 3 backend core API foundations:

- Express API skeleton updates
- Job ID generator
- Upload and technical pre-validation API
- Create job API
- Job history and detail APIs
- Cancel API
- Individual download API
- ZIP download boundary response
- Re-Ask PR Worker boundary response

No EPIC 4+ work was implemented. No admin APIs, worker execution, queue manager, WebSocket, LLM client, frontend UI, storage redesign, or create-pr-cd business-rule changes were made.

## Files Created / Modified

Created:

- backend/src/middleware/errorHandler.js
- backend/src/middleware/uploadMiddleware.js
- backend/src/routes/jobRoutes.js
- backend/src/services/jobService.js
- backend/src/services/prevalidationService.js
- backend/src/utils/apiError.js
- backend/src/utils/jobIdGenerator.js
- prompts/result/20260520-0007-epic-3-backend-core-api-result.md

Modified:

- backend/src/app.js

Temporary verification file created and removed:

- backend/tmp-epic3-verify.js

## API Endpoints Implemented

- POST /api/jobs/prevalidate
- POST /api/jobs
- GET /api/jobs
- GET /api/jobs/:jobId
- POST /api/jobs/:jobId/cancel
- GET /api/jobs/:jobId/download/:fileId
- GET /api/jobs/:jobId/download-zip
- POST /api/jobs/:jobId/ask

## Implementation Summary

Job IDs use `PR-YYYYMMDD-XXX` and avoid collisions against MongoDB job records.

Pre-validation accepts `.xlsx` and `.xls`, checks file presence, extension, configured size limit, safe filename handling, stores a temporary upload, and returns a checklist plus worker explanation.

Create Job validates the prevalidated upload, validates generation scope, normalizes and deduplicates site codes, creates job folders, copies the uploaded file into the job input folder, creates `Job` and `JobFile` records, and leaves the job in `queued` status. Worker execution is deferred to EPIC 5.

History/detail APIs query persisted job data and related files, warnings, and review-required items. Detail responses include file availability without exposing raw absolute file paths.

Cancel supports queued jobs in EPIC 3. Running job cancellation returns a controlled dependency response because the worker state manager belongs to EPIC 5.

Download supports tracked individual files with job/file ownership checks, local file existence checks, retention checks, and safe path resolution. ZIP download returns a controlled not-ready response until the output/report layer creates ZIP files.

Re-Ask validates the job and question, retrieves structured job metadata, and returns a controlled not-ready response because LLM Q&A belongs to EPIC 7. It does not save Q&A.

## Commands Executed

- `Get-ChildItem -Name; Get-ChildItem docs -Name; Get-ChildItem backend\src -Recurse -File`
- `Get-Content docs\ai_worker_platform_mvp_task_list.md`
- `Get-Content docs\create_pr_cd_webapp_technical_design.md`
- `Get-Content docs\ai_worker_platform_adr.md`
- `Get-Content backend\src\app.js; Get-Content backend\src\server.js; Get-Content backend\src\config\env.js; Get-Content backend\src\routes\health.js; Get-Content backend\src\db\mongo.js`
- `Get-Content backend\src\models\index.js; Get-Content backend\src\models\Job.js; Get-Content backend\src\models\JobFile.js; Get-Content backend\src\models\ReviewRequiredItem.js; Get-Content backend\src\models\WarningItem.js; Get-Content backend\src\models\Asset.js`
- `Get-Content backend\src\services\storageService.js; Get-Content backend\src\utils\pathUtils.js`
- `rg --files agent-guideline\vscode-agent; rg -n "workflow|test|review|implementation|discipline" agent-guideline\vscode-agent`
- `rg --files skills\create-pr-cd | Select-Object -First 80; Get-ChildItem skills\create-pr-cd -Name`
- `Get-Content skills\create-pr-cd\README.md; Get-Content skills\create-pr-cd\create-pr-cd_SKILL.md`
- `node -e "require('./src/app'); require('./src/utils/jobIdGenerator'); require('./src/services/prevalidationService'); require('./src/services/jobService'); console.log('imports ok')"`
- `$env:MONGO_URI='mongodb://127.0.0.1:27017/ai_worker_platform_test'; node tmp-epic3-verify.js`
- `$env:MONGO_URI='mongodb://127.0.0.1:27017/ai_worker_platform_test'; npm start`
- `Invoke-RestMethod http://127.0.0.1:8000/health | ConvertTo-Json -Depth 6`
- `Stop-Process` for the backend process listening on port 8000 after smoke tests
- `git diff --check`
- Cleanup verification commands for storage temp/jobs and MongoDB EPIC 3 records

## Test Results

Passed:

- Import smoke test for app, job ID generator, prevalidation service, and job service
- Backend `npm start` smoke test
- `/health` smoke test with MongoDB connected and storage OK
- MongoDB-backed API verification using `MONGO_URI=mongodb://127.0.0.1:27017/ai_worker_platform_test`
- Temporary verification harness: 31 checks passed

Verification coverage:

- Job ID format
- Valid upload prevalidation
- Invalid file type rejection
- Oversized prevalidation behavior through service check
- Create job from valid prevalidated upload
- Invalid prevalidatedFileId rejection
- Empty `site_code` scope rejection
- Job folder creation
- Job record creation
- JobFile record creation
- Job list filtering/search
- Job detail response
- Missing job 404
- Individual tracked file download
- Wrong job/file pairing blocked
- Missing local file handled
- Expired file blocked
- Unsafe download identifier blocked
- ZIP controlled not-ready response
- Ask empty question validation
- Ask controlled LLM dependency response
- Queued job cancellation
- Completed job cancellation blocked

## Cleanup Summary

- Temporary script `backend/tmp-epic3-verify.js` removed.
- EPIC 3 MongoDB test records removed from `jobs` and `job_files`.
- EPIC 3 storage job folders removed.
- `storage/temp` contains only `.gitkeep`.
- No backend process left listening on port 8000.

## Issues / Risks / Assumptions

- EPIC 3 intentionally does not execute PR Worker jobs. Jobs remain `queued` until EPIC 5 implements queue and worker execution.
- Running-job cancellation is intentionally not implemented until EPIC 5 worker state management.
- ZIP download returns `ZIP_NOT_READY` until the output/report layer creates ZIP packages.
- Re-Ask returns dependency-not-ready until EPIC 7 LLM integration.
- Pre-validation is technical only in EPIC 3; workbook readability, sheet/column checks, and row-count parsing belong to later parser/worker validation layers unless explicitly moved forward.
- `prompts/` is ignored by `.gitignore`; this result archive must be force-added if it is included in the commit.

## Final Acceptance Status

EPIC 3 ACCEPTED — ready for EPIC 4

## Recommended Next Step

Proceed to EPIC 4 — Admin Portal Backend Layer.
