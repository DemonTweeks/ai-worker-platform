# EPIC 15 Testing and QA Result

- Date/time: 2026-05-20 09:01 Asia/Singapore
- Epic number: EPIC 15
- Task name: Testing and QA
- Git branch: main
- Latest git status summary before commit: EPIC 15 test scripts/docs modified or created; `.env` ignored and unmodified.

## 1. Task Scope

Implemented EPIC 15 only: backend smoke/integration test scripts, frontend route smoke test script, QA checklist, final MVP acceptance report, and final verification. No new product features or create-pr-cd business changes were implemented.

## 2. Test Framework / Scripts Summary

Added script-based tests using existing Node dependencies and built-in assertions:

- `backend/scripts/smoke-test.js`
- `backend/scripts/integration-test.js`
- `frontend/scripts/route-smoke.js`

Added package scripts:

- Backend: `npm run smoke`, `npm run test:integration`, `npm test`
- Frontend: `npm run smoke`, `npm test`

No new test framework dependency was added.

## 3. Backend Smoke Test Summary

Backend smoke test verifies imports and utility behavior:

- config/env
- Mongo module
- app/routes
- job/queue/worker services
- output/report services
- cleanup/health services
- WebSocket/LLM modules
- job ID generator
- site code parser
- path safety helpers
- asset version naming
- LLM disabled fallback

Result: passed.

## 4. API Integration Test Summary

Backend integration test starts the Express app on a random local port with WebSocket attached and uses `MONGO_URI=mongodb://127.0.0.1:27017/ai_worker_platform_test`.

Verified:

- `GET /health`
- `GET /api/jobs`
- invalid upload/prevalidation rejection
- invalid `prScope` rejection
- valid prevalidation
- create job
- job detail polling
- ZIP download
- Re-Ask fallback
- admin protected route 401
- invalid admin login rejection
- valid admin login
- asset upload and activation
- audit log list

Result: passed.

## 5. Worker E2E Test Summary

The integration test created controlled active asset records from existing skill input files and ran real backend job flow.

Verified:

- TSS job completed with warnings.
- TI job completed.
- ZIP download succeeded.
- ZIP signature was valid.
- ZIP contained `ECC_Output/`.
- ZIP contained `Summary.json`.
- Warning report was included when generated.

Result: passed.

## 6. WebSocket Test Summary

Verified:

- connect to `/ws`
- malformed message returns `ERROR`
- invalid job returns `ERROR`
- valid job subscribe returns `SUBSCRIBED`
- `JOB_EVENT` is received
- reconnect and resubscribe returns `SUBSCRIBED`

Result: passed.

## 7. LLM Test Summary

Automated QA ran with `LLM_ENABLED=false` to avoid secrets and external dependency. Verified disabled/fallback behavior through direct LLM client smoke and Re-Ask fallback.

Real MaaS/Qwen success was previously verified in EPIC 7 local verification. EPIC 15 did not print or expose API keys.

Result: fallback path passed; real provider not re-tested in EPIC 15.

## 8. Resource Protection Test Summary

Verified:

- invalid Excel rejected
- invalid `prScope` rejected
- cleanup dry-run identifies candidates and deletes nothing
- cleanup actual run deletes only controlled expired terminal-job file
- active job file remains
- controlled test metadata/files are cleaned up

Earlier EPIC 13 verified oversized upload, row count, site-code limit, timeout, active asset protection, and expired download behavior. EPIC 15 regression retained cleanup checks.

Result: passed.

## 9. Frontend Build / Route Smoke Summary

Frontend `npm test` runs production build and route smoke.

Verified HTTP 200 for:

- `/`
- `/history`
- `/jobs/QA15-ROUTE-SMOKE`
- `/admin/login`
- `/admin/assets`
- `/admin/audit-logs`
- `/admin/health`

Also checked route HTML does not expose `LLM_API_KEY` text.

Result: passed.

## 10. Deployment Verification Summary

Static `docker-compose.yml` YAML lint passed.

Docker runtime verification remains pending because Docker CLI/Desktop is unavailable in this environment; `docker --version` returned command not recognized.

Deployment verification checklist is documented in `docs/qa-checklist.md` and `docs/deployment-windows.md`.

## 11. Final MVP Acceptance Report Summary

Created `docs/mvp-acceptance-report.md` covering overview, accepted EPIC list, commit hashes, architecture, user/admin flows, worker execution, LLM, WebSocket, reports, resource protection, deployment readiness, limitations, risks, and readiness decision.

## 12. Bug Fixes, if any

Only QA harness fixes were made:

- Smoke test now opens/closes the test Mongo connection before using DB-backed helpers.
- Frontend route smoke uses a Windows-safe preview spawn/cleanup path.
- Integration test uses the canonical skill input workbook with the expected `data` sheet.
- Integration WebSocket test uses a valid `PR-...` job ID and explicit socket termination.
- Integration cleanup filter now removes both `QA15...` and `PR-QA15...` test records.

No product behavior or create-pr-cd business logic was changed.

## 13. Files Created / Modified

Created:

- `backend/scripts/smoke-test.js`
- `backend/scripts/integration-test.js`
- `frontend/scripts/route-smoke.js`
- `docs/qa-checklist.md`
- `docs/mvp-acceptance-report.md`
- `prompts/result/20260520-0901-epic-15-testing-qa-result.md`

Modified:

- `backend/package.json`
- `frontend/package.json`

## 14. Commands Executed

- `rg --files`
- `rg -n "EPIC 15|15.1|15.2|15.3|15.4|15.5|Testing|QA|Acceptance" docs`
- Read task/design/ADR/deployment/result docs and relevant backend/frontend files.
- `npm run smoke` in backend.
- `npm run test:integration` in backend.
- `npm test` in backend.
- `npm test` in frontend.
- `npx --yes yaml-lint docker-compose.yml`
- `docker --version`
- Test cleanup verification query against `ai_worker_platform_test`.
- Port checks for local test servers.
- `git status --short --ignored .env`
- `git diff -- skills/create-pr-cd`

## 15. Test Results

Passed:

- Backend smoke test.
- Backend API integration test.
- Real TSS worker E2E.
- Real TI worker E2E.
- ZIP content checks.
- WebSocket connect/error/subscribe/event/reconnect.
- Re-Ask fallback.
- Admin auth/assets/audit API checks.
- Cleanup dry-run and controlled actual cleanup.
- Frontend production build.
- Frontend route smoke.
- Docker Compose YAML lint.
- Secret safety checks.
- Test data cleanup verification.

Not verified:

- Docker Compose runtime build/up because Docker CLI/Desktop is unavailable in this environment.
- Real MaaS/Qwen call in EPIC 15; previously verified in EPIC 7 and intentionally avoided here to keep automated QA secret-free.

## 16. Known Limitations

- Docker runtime must be verified on the actual Windows 11 Pro Docker Desktop host.
- MVP is single-machine/internal, not high availability.
- Cleanup service is manual/testable; no automatic scheduler.
- Real LLM success depends on internal network access and valid local `.env`.

## 17. Final Acceptance Status

EPIC 15 ACCEPTED — MVP READY FOR CONTROLLED INTERNAL UAT

## 18. Recommended Next Step

Run the documented Docker/UAT checklist on the target Windows 11 Pro Docker Desktop machine, then begin controlled internal UAT with business users.
