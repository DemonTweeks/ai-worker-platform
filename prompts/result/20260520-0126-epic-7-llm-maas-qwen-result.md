# EPIC 7 LLM MaaS Qwen Result

- Date/time: 2026-05-20 01:26:37 +08:00
- Epic number: 7
- Task name: LLM / MaaS / Qwen Integration Layer
- Git branch: main
- Latest git status summary before archive: modified `.env.example`, backend config/routes/services/WebSocket event publisher; untracked `backend/src/llm/` modules and `backend/src/services/jobContextService.js`.

## Task Scope

Implemented only EPIC 7 backend LLM infrastructure: configuration, provider-neutral client, MaaS/Qwen-compatible provider adapter, prompt templates, progress wording, final summary wording, Re-Ask backend service, safe fallback behavior, health status, and worker/WebSocket integration. No frontend UI, Docker, admin UI, new worker types, cloud storage, or create-pr-cd business logic changes were made.

## Files Created / Modified

- Modified: `.env.example`
- Modified: `backend/src/config/env.js`
- Modified: `backend/src/routes/health.js`
- Modified: `backend/src/routes/jobRoutes.js`
- Modified: `backend/src/services/finalSummaryService.js`
- Modified: `backend/src/services/jobService.js`
- Modified: `backend/src/websocket/eventPublisher.js`
- Created: `backend/src/llm/llmTypes.js`
- Created: `backend/src/llm/llmUtils.js`
- Created: `backend/src/llm/promptTemplates.js`
- Created: `backend/src/llm/llmFallbackService.js`
- Created: `backend/src/llm/providers/qwenProvider.js`
- Created: `backend/src/llm/llmClient.js`
- Created: `backend/src/llm/progressWordingService.js`
- Created: `backend/src/llm/finalSummaryWordingService.js`
- Created: `backend/src/llm/reAskService.js`
- Created: `backend/src/services/jobContextService.js`

## Commands Executed

- `git status --short`
- `rg --files`
- `Get-Content docs/ai_worker_platform_mvp_task_list.md`
- `Get-Content docs/create_pr_cd_webapp_technical_design.md`
- `Get-Content docs/ai_worker_platform_adr.md`
- `node -e "... imports ok"`
- `node tmp-epic7-verify.js`
- `node tmp-epic7-provider-fail.js`
- `node -e "... LLM_NOT_CONFIGURED ..."`
- `npm start`
- `Invoke-RestMethod http://127.0.0.1:8000/health`
- `Invoke-RestMethod http://127.0.0.1:8000/api/jobs?limit=1`
- `Test-NetConnection 127.0.0.1 -Port 8000`
- `git diff --check`

## Test Results

- Backend imports passed.
- Backend starts with `LLM_ENABLED=false`.
- `/health` works and includes non-secret LLM status.
- MongoDB still connects.
- User job APIs still work.
- Admin protected route still returns 401 without token.
- EPIC 5 worker modules and EPIC 6 WebSocket modules import successfully.
- LLM disabled mode returns controlled `LLM_DISABLED`.
- Missing API key with `LLM_ENABLED=true` returns controlled `LLM_NOT_CONFIGURED`.
- Progress wording falls back when disabled.
- Progress wording falls back when provider fails.
- Final summary wording falls back when disabled.
- Final summary wording falls back when provider fails.
- Re-Ask missing question returns validation error.
- Re-Ask missing job returns not found.
- Valid Re-Ask with LLM disabled returns safe fallback answer and does not expose storage root.
- Worker execution still succeeds with LLM disabled.
- Worker execution still succeeds when provider fails.
- Temporary verification records and files were cleaned.

## LLM Configuration Summary

Added safe `.env.example` placeholders:

- `WS_MAX_PAYLOAD_BYTES=16384`
- `LLM_ENABLED=false`
- `LLM_PROVIDER=qwen`
- `LLM_BASE_URL=`
- `LLM_API_KEY=`
- `LLM_MODEL=Qwen3-235B-A22B`
- `LLM_TIMEOUT_MS=30000`
- `LLM_MAX_RETRIES=1`
- `LLM_PROGRESS_WORDING_ENABLED=true`
- `LLM_FINAL_SUMMARY_ENABLED=true`
- `LLM_REASK_ENABLED=true`

Backend startup does not require LLM credentials when disabled.

## Provider Implementation Summary

Implemented a provider-neutral `llmClient` and a MaaS/Qwen provider adapter using an OpenAI-compatible chat completions request shape. The adapter uses built-in `fetch`, timeout via `AbortController`, limited retry through client config, normalized responses, and safe controlled errors without exposing API keys.

## Prompt Template Summary

Added reusable templates for progress wording, final summary wording, and Re-Ask answers. Templates enforce English-only professional tone, provided-context-only answers, no invented data, no business-rule changes, and no exposure of secrets or internal paths.

## Progress Wording Summary

WebSocket `JOB_EVENT` messages now optionally include `aiMessage`, `messageSource`, and `llmStatus`. Event type, status, phase, progress, and deterministic message remain unchanged.

## Final Summary Wording Summary

Final summary generation now calls the wording service. Deterministic summary facts remain the source context, and fallback summary is used when LLM is disabled or unavailable.

## Re-Ask Backend Summary

`POST /api/jobs/:jobId/ask` now uses the EPIC 7 Re-Ask service instead of returning the previous dependency-not-ready response. It builds safe context from Job, JobFile metadata, WarningItem, ReviewRequiredItem, and worker state. It does not read raw Excel, execute jobs, modify data, or save Q&A.

## Fallback Behavior Summary

Fallback is deterministic and honest for disabled, not configured, provider error, timeout, or invalid provider response. LLM failures do not block worker completion, WebSocket event publishing, final summaries, or Re-Ask responses.

## Issues / Risks / Assumptions

- Real MaaS/Qwen call was not verified because no real base URL/API key was provided.
- Qwen adapter assumes an OpenAI-compatible `/chat/completions` endpoint, which is common for MaaS gateways but should be confirmed with internal platform documentation before production use.
- LLM-generated wording is treated as communication only; it cannot change job state, warnings, review decisions, generated files, or create-pr-cd behavior.

## Final Acceptance Status

EPIC 7 ACCEPTED — ready for EPIC 8

## Recommended Next Step

Proceed to EPIC 8: Vue2 frontend user portal, including upload/pre-validation flow, job creation, WebSocket client integration, progress display, Re-Ask panel, downloads, and job history navigation.
