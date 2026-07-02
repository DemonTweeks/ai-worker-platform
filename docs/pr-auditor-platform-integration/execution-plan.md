# PR Auditor Platform Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for bounded inline execution. This mission plan tracks the autonomous bounded-step sequence in `- [ ]` form.

**Goal:** Integrate PR Auditor as a distinct top-level AI Worker Platform worker and finish with exactly one Draft PR against `main`.

**Architecture:** Mirror the existing worker-manifest plus adapter pattern used by `ran-pr`, but keep PR Auditor isolated from PR Creator behavior. The backend owns worker registration, validation, queueing, workspace isolation, safe summaries, downloads, and persistence; the engine remains an explicitly pinned external dependency invoked with explicit workbook paths only.

**Tech Stack:** Express backend, Vue 2 frontend, existing job queue/storage/websocket services, Python child-process runtime, Git submodule or equivalent engine pin metadata.

---

## Changed-File Allowlist

- `backend/`
- `frontend/`
- `docs/pr-auditor-platform-integration/`
- worker registry / manifests / adapters / services discovered under `backend/src/workers/`
- engine pin metadata only under `.gitmodules`, `skills/tx-pr-auditor`, and optional lock metadata if safety is approved

### Planned file-level change map

- Backend registration and payload flow:
  `backend/src/workers/workerTypes.js`,
  `backend/src/workers/workerRegistry.js`,
  `backend/src/workers/manifests/prAuditorManifest.js`,
  `backend/src/workers/adapters/prAuditorAdapter.js`,
  `backend/src/workers/adapters/prAuditorJobAdapter.js`,
  `backend/src/services/prevalidationService.js`,
  `backend/src/services/jobService.js`,
  `backend/src/models/Job.js`,
  `backend/src/models/JobFile.js`
- Backend isolation, output, and tests:
  `backend/src/workers/prAuditorWorkspaceService.js`,
  `backend/src/workers/prAuditorOutputIngestionService.js`,
  `backend/scripts/job-service-worker-payload-test.js`,
  new PR Auditor validation scripts under `backend/scripts/`
- Frontend launch, detail, and history:
  `frontend/src/views/HomeView.vue`,
  `frontend/src/views/JobDetailView.vue`,
  `frontend/src/views/JobHistoryView.vue`,
  `frontend/src/components/UploadPanel.vue`,
  `frontend/src/components/FinalSummary.vue`,
  `frontend/src/components/detail/JobDetailSummary.vue`,
  `frontend/src/components/detail/JobDetailFiles.vue`,
  `frontend/src/components/history/JobHistoryFilters.vue`,
  `frontend/src/components/history/JobHistoryCard.vue`,
  `frontend/src/api/jobApi.js`
- Docs and mission state:
  `docs/pr-auditor-platform-integration/*`
- Engine metadata only if later approved:
  `.gitmodules`,
  `skills/tx-pr-auditor`,
  optional lock metadata

## Bounded Steps

- [x] Step 1: Verify `origin/main`, inspect current worktrees, create `C:\dev\ai-worker-platform-pr-auditor` on `feature/pr-auditor-platform-integration`, inspect worker architecture, and inspect PR Auditor engine candidate safety.
- [x] Step 2: Define the dedicated PR Auditor worker contract, upload kinds, output contract, and changed-file allowlist details from discovered backend/frontend patterns.
- [x] Step 3: Register `pr-auditor` in backend worker types, manifest, registry, and job creation flow without changing MW or RAN behavior.
- [x] Step 4: Implement PR Auditor upload prevalidation, isolated workspace preparation, deterministic Python execution, and safe progress mapping.
- [x] Step 5: Implement approved output ingestion, safe structured audit summary persistence, history/detail/download integration, and cancellation handling.
- [x] Step 6: Add the dedicated top-level PR Auditor frontend entry point and three-upload launch flow with required notice text.
- [x] Step 7: Update active jobs, job detail, history, filters, and download presentation for PR Auditor-specific summaries.
- [ ] Step 8: Add synthetic backend and engine validation for happy path, missing upload, invalid workbook, concurrent isolation, cancellation, history reload, and download behavior.
- [ ] Step 9: Run MW PR and RAN PR regression validation plus build/test verification, then perform changed-scope review and review findings cleanup.
- [ ] Step 10: Record final report, create final checkpoint, push the feature branch, and open exactly one Draft PR after all gates pass.

## Immediate Next Step

- [ ] Execute bounded Step 8 only: add synthetic backend and engine validation for happy path, missing upload, invalid workbook, concurrent isolation, cancellation, history reload, and audit report download behavior.
