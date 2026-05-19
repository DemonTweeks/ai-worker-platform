# EPIC 8 Frontend User Portal Result

- Date/time: 2026-05-20 02:00:43 +08:00
- Epic number: 8
- Task name: Vue2 Frontend User Portal
- Git branch: main
- Latest git status summary before archive: modified backend progress wording service and frontend shell/API/styles/HomeView; untracked frontend API, component, service, utility, config files; `.env` remains ignored.

## Task Scope

Implemented only EPIC 8 normal-user Vue2 portal plus a small EPIC 7 WebSocket LLM wording follow-up. No EPIC 9/admin UI/health dashboard/Docker work/create-pr-cd changes were implemented. `.env` was not modified, printed, staged, or committed.

## Files Created / Modified

- Modified: `backend/src/llm/progressWordingService.js`
- Modified: `frontend/src/App.vue`
- Modified: `frontend/src/api.js`
- Modified: `frontend/src/styles.css`
- Modified: `frontend/src/views/HomeView.vue`
- Created: `frontend/.env.example`
- Created: `frontend/src/config.js`
- Created: `frontend/src/api/jobApi.js`
- Created: `frontend/src/api/reAskApi.js`
- Created: `frontend/src/services/websocketClient.js`
- Created: `frontend/src/utils/statusUtils.js`
- Created: `frontend/src/utils/formatUtils.js`
- Created: `frontend/src/components/ErrorBanner.vue`
- Created: `frontend/src/components/LoadingButton.vue`
- Created: `frontend/src/components/UploadPanel.vue`
- Created: `frontend/src/components/ScopeSelector.vue`
- Created: `frontend/src/components/SiteSelector.vue`
- Created: `frontend/src/components/JobProgress.vue`
- Created: `frontend/src/components/JobEventTimeline.vue`
- Created: `frontend/src/components/FinalSummary.vue`
- Created: `frontend/src/components/DownloadPanel.vue`
- Created: `frontend/src/components/ReAskPanel.vue`

## Commands Executed

- `git status --short`
- `rg --files`
- `Get-Content docs/...`
- `Get-Content frontend/...`
- `Get-Content backend/src/routes/jobRoutes.js`
- `Get-Content backend/src/websocket/...`
- `Get-Content backend/src/llm/...`
- `npm run build`
- `node -e "require('./src/app'); ..."`
- `npm start`
- `npm run dev`
- `Invoke-RestMethod http://127.0.0.1:8000/health`
- `Invoke-WebRequest http://127.0.0.1:3000/`
- `node tmp-epic8-e2e.js`
- `Test-NetConnection 127.0.0.1 -Port 8000`
- `Test-NetConnection 127.0.0.1 -Port 3000`
- `git diff --check`

## Test Results

- Frontend build passed with Vite.
- Frontend dev server started and served HTTP 200.
- Backend imports passed.
- Backend started successfully.
- `/health` worked and did not expose secrets.
- Admin protected route returned 401 without token.
- User job list endpoint worked.
- No create-pr-cd files were modified.
- `.env` remained ignored.
- Controlled API/WebSocket flow passed 8 checks: prevalidation, create job, real WebSocket completion event, displayable event message, job detail outputs, Re-Ask answer, ZIP download, and cleanup.

## Frontend Flow Summary

The Vue2 portal now supports the normal user PR Worker flow: upload/prevalidate, select displayed PR scope, select all-sites or site-code mode, create job, monitor realtime progress, review final summary, download ZIP output, and ask a job-related Re-Ask question.

## API Integration Summary

Frontend API modules call the accepted backend endpoints:

- `GET /health`
- `POST /api/jobs/prevalidate`
- `POST /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/jobs/:jobId/download-zip`
- `POST /api/jobs/:jobId/ask`

No fake endpoints or fake responses were added.

## WebSocket Integration Summary

Added a frontend WebSocket client for `/ws` with subscribe, reconnect, status handling, and message handling for `SUBSCRIBED`, `JOB_EVENT`, `JOB_HEARTBEAT`, and `ERROR`. WebSocket remains observe-only.

## Re-Ask Integration Summary

Added a Re-Ask panel that posts to `/api/jobs/:jobId/ask`, displays answer text, `answerSource`, and `llmStatus`, and handles loading/empty question states.

## Download Integration Summary

Added ZIP download panel using the existing backend `download-zip` endpoint. The UI shows the download action only when a tracked available ZIP package exists in job detail output metadata.

## EPIC 7 WebSocket LLM Follow-Up Result

Fixed and verified. The issue was caused by too small a progress wording max token budget for the MaaS/Qwen reasoning response. The fix increased progress wording `maxTokens` to 500 while keeping deterministic job state unchanged. Controlled `JOB_EVENT` verification returned `messageSource=llm`, `llmStatus=success`, and non-empty `aiMessage`. The frontend also handles fallback when `llmStatus` is not `success` or `aiMessage` is missing.

## Issues / Risks / Assumptions

- The TSS/TI frontend selector is present for the user flow, but the current backend create-job API does not accept a TSS/TI field. The UI does not send an invented field; current worker execution still follows existing backend behavior.
- Browser interaction was verified by build/dev-server/API checks, not full manual browser automation, because no browser automation tool is available in this session.
- Local real LLM behavior depends on the user's ignored `.env`; no secrets were printed or committed.

## Final Acceptance Status

EPIC 8 ACCEPTED — ready for EPIC 9

## Recommended Next Step

Proceed to EPIC 9: Job History / Job Detail layer, including persistent history navigation, detail page polish, filtering/search, and fuller result review UI.
