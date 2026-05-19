# EPIC 13 Resource Protection and Cleanup Result

- Date/time: 2026-05-20 06:42 Asia/Singapore
- Epic number: EPIC 13
- Task name: Resource Protection and Cleanup
- Git branch: main
- Latest git status summary before commit: EPIC 13 source/config/UI files modified; `.env` ignored and unmodified.

## 1. Task Scope

Implemented EPIC 13 only: hard limit enforcement, job timeout hardening, cleanup dry-run/actual policy, expired-file metadata/download handling, and minimal health/admin visibility. EPIC 14+ work was not implemented.

## 2. Hard Limit Enforcement Summary

Existing protections were confirmed for upload size, site-code count, parser row count, and queue concurrency. Added documented `MAX_OUTPUT_FILES=200` configuration and output collection enforcement.

## 3. Upload Size Limit Summary

Multer upload size limit was already configured from `MAX_UPLOAD_SIZE_MB`. Prevalidation also rejects oversized file metadata with a clear failure checklist.

## 4. Row Count Limit Summary

Prevalidation now inspects workbook row count using the same iEPMS parser logic and rejects over-limit Excel files before job creation. Worker parser enforcement remains in place.

## 5. Site Code Limit Summary

Existing `MAX_SITE_CODES` job creation validation was verified. All-sites mode remains unaffected.

## 6. Queue Concurrency Summary

Existing FIFO queue continues to respect `MAX_CONCURRENT_JOBS`; health exposes active and queued counts.

## 7. Job Timeout Handler Summary

Child process runner already used `JOB_TIMEOUT_MINUTES`. It now performs controlled termination with a SIGTERM/SIGKILL fallback and exports `runCommand` for controlled verification. Worker failure stores timeout metadata on the job when `WORKER_TIMEOUT` occurs.

## 8. Cleanup Policy Summary

Added `backend/src/services/cleanupService.js` with:
- `getCleanupPlan({ dryRun, now })`
- `runCleanup({ dryRun, now })`
- `getCleanupStatus()`

Cleanup only considers tracked `JobFile` records, only deletes files for terminal jobs, skips active job statuses, resolves paths inside the configured storage root, skips symlinks and non-files, keeps metadata forever, and defaults to dry-run when called that way. No automatic scheduler was added.

## 9. Dry-Run Cleanup Summary

Controlled dry-run found one expired terminal-job file candidate and one active-job skipped file. Dry-run deleted nothing.

## 10. Actual Cleanup Verification Summary

Controlled actual cleanup deleted only the expired terminal-job test file, preserved the active job file, preserved an active asset file, marked JobFile metadata unavailable/expired, and made download return `410 FILE_EXPIRED`.

## 11. Expired File UI Summary

Job Detail file display now distinguishes File Expired, Removed by cleanup, Missing, Available, and Unavailable. Download Panel now explains when a ZIP is expired or removed by retention cleanup.

## 12. Backend Changes

- Added `MAX_OUTPUT_FILES` config.
- Added JobFile cleanup metadata fields.
- Added Job timeout metadata fields.
- Added cleanup service.
- Hardened child-process termination.
- Added output file count limit enforcement.
- Added prevalidation row-count inspection.
- Added expired/unavailable file fields and `410 FILE_EXPIRED` behavior.
- Added cleanup status to `/health`.

## 13. Frontend Changes, if any

Updated Admin Health Dashboard cleanup/retention visibility and Job Detail/Download expired-file messaging.

## 14. Files Created / Modified

- `.env.example`
- `backend/src/config/env.js`
- `backend/src/models/Job.js`
- `backend/src/models/JobFile.js`
- `backend/src/services/cleanupService.js`
- `backend/src/services/childProcessRunner.js`
- `backend/src/services/healthService.js`
- `backend/src/services/iepmsParser.js`
- `backend/src/services/jobService.js`
- `backend/src/services/outputCollector.js`
- `backend/src/services/prWorkerService.js`
- `backend/src/services/prevalidationService.js`
- `frontend/src/components/DownloadPanel.vue`
- `frontend/src/components/detail/JobDetailFiles.vue`
- `frontend/src/views/admin/AdminHealthView.vue`

## 15. Commands Executed

- `rg --files`
- `rg -n "EPIC 13|13.1|13.2|13.3|13.4|Resource Protection|Cleanup|timeout|retention|MAX_UPLOAD|MAX_ROW|MAX_SITE" docs`
- Read task/design/ADR and relevant backend/frontend files.
- `node -e "require(...)"` backend import checks.
- `npm run build` in frontend.
- Started backend with `MONGO_URI=mongodb://127.0.0.1:27017/ai_worker_platform_test`.
- `Invoke-RestMethod http://127.0.0.1:8000/health`
- `Invoke-RestMethod http://127.0.0.1:8000/api/jobs`
- Admin protected route check returned 401 without token.
- Controlled Node verification for cleanup dry-run/actual deletion.
- Controlled Node verification for row limit, upload size, site-code limit, output-file limit, valid prevalidation, and child-process timeout.
- `npm run dev -- --host 127.0.0.1 --port 5173`
- Frontend dev server HTTP 200 check.
- `npm test` in backend/frontend; both reported missing test script.
- Test cleanup record count query returned zero EPIC13 test records.

## 16. Test Results

Passed:
- Backend imports successfully.
- Backend starts.
- `/health` works and includes cleanup status.
- `/health` does not expose API key or raw Mongo credentials.
- Frontend builds successfully.
- Frontend dev server starts and returns HTTP 200.
- Existing user job list API works.
- Admin protected API returns 401 without token.
- Upload size limit rejects oversized file metadata.
- Row count limit rejects at prevalidation.
- Site-code limit rejects too many site codes.
- Valid upload/prevalidation still works.
- Output file limit rejects over-limit generated output count.
- Controlled child process timeout reports `timedOut=true`.
- Cleanup dry-run deletes nothing.
- Cleanup actual run deletes only expired safe test file.
- Cleanup skips active job files.
- Cleanup preserves active asset file.
- Cleanup metadata remains after physical deletion.
- Expired download returns `410 FILE_EXPIRED`.
- No create-pr-cd files were modified.
- `.env` remained ignored and uncommitted.

Not applicable / limited:
- No full real worker timeout job was forced because a controlled child-process timeout covered the timeout handler without running a long PR Worker job.
- `npm test` scripts do not exist in backend or frontend.

## 17. Deletion Safety Verification Result

Verified with controlled data: deletion occurred only for a terminal expired `JobFile` under storage root. Active job file and active asset file remained. No source, docs, `.env`, or skill files were deleted.

## 18. UI / Expired Download Verification Result

Frontend build/dev smoke passed. Expired-file UI behavior was verified by code path and backend detail/download metadata. Browser manual click testing was not performed.

## 19. Test Data / Cleanup Summary

Temporary EPIC13 jobs, job files, asset metadata, and controlled storage files were removed. Follow-up query returned zero EPIC13 test jobs/files/assets.

## 20. Issues / Risks / Assumptions

- Cleanup is service-only and manual/testable; no automatic scheduler was added because the task did not require a recurring destructive job.
- Disk/user storage cleanup is limited to tracked `JobFile` records; orphan folder cleanup was intentionally not added to avoid unsafe deletion.
- LLM health was degraded during verification due provider response validation, but this is outside EPIC 13 and did not affect cleanup/resource protection.

## 21. Final Acceptance Status

EPIC 13 ACCEPTED — ready for EPIC 14

## 22. Recommended Next Step

Proceed to EPIC 14 deployment layer when ready.
