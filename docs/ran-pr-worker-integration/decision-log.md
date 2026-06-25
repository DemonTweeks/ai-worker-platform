# Decision Log

## 2026-06-25 - Mission Initialization

### Decision

Use the master prompt at `C:\dev\codex-prompts\ran-pr-worker-integration-master-automation-prompt.md` as the sole mission authority and store all resumable progress in `docs/ran-pr-worker-integration/`.

### Why

The user explicitly directed that the master prompt is authoritative and that the thread must not rely on memory or duplicate the mission logic in conversation state.

### Impact

Every manual continuation and heartbeat wake-up must reread the master prompt and the persistent state file before taking further action.

## 2026-06-25 - Workspace Isolation Handling

### Decision

Work in the user-specified repository checkout `C:\dev\ai-worker-platform-ran-pr` on `feature/ran-pr-worker-integration` rather than creating an additional worktree.

### Why

The mission instructions explicitly confirmed the active workspace and branch. That direct instruction takes precedence over creating a new worktree, while still preserving isolation by remaining off `main`.

### Impact

Phase 0 will continue in-place on the requested feature branch, and the state log records that no extra worktree was created.

## 2026-06-25 - Bounded Step Discipline

### Decision

Use a narrow one-step continuation model for this session: initialize the mission state bundle and defer deeper discovery to the next bounded step.

### Why

The master prompt requires exactly one bounded autonomous continuation step per wake-up or manual continuation.

### Impact

This checkpoint sets up resumable state without mixing in architecture or implementation changes prematurely.

## 2026-06-25 - Phase 0 MW Flow Discovery

### Decision

Treat the current MW implementation as a single-worker baseline that must be wrapped rather than rewritten when introducing the worker registry.

### Why

The existing code path is tightly coupled around `workerType: 'pr-worker'`, a single engine root at `skills/create-pr-cd`, Firebase-backed `Job` and `JobFile` records, filesystem-backed job storage under `storage/jobs/<jobId>/`, and in-memory queue/runtime state. Preserving external behavior means the integration must keep these routes, payload shapes, history records, download behavior, and safe-error surfaces stable for the existing MW flow while moving the execution engine behind a shared contract.

### Impact

The future registry and adapter work needs to preserve the current HTTP and UI contract while extracting the execution-specific logic now concentrated in `jobService`, `jobQueue`, `prWorkerService`, and `childProcessRunner`.

## 2026-06-25 - Key Discovery Findings

### Decision

Record the current MW flow as the authoritative baseline for Phase 1 and Phase 2 integration work.

### Why

The mission requires inspection of the actual MW execution path, persistence/history path, uploads, downloads, ZIP flow, cancellation, Job Detail, WebSocket, and safe-error handling before architecture changes.

### Impact

The following baseline findings now guide the implementation:

- Frontend job creation starts in `frontend/src/views/HomeView.vue`, which prevalidates an uploaded Excel file, then creates a job with `prevalidatedFileId`, `generationScope`, `siteCodes`, and `prScope`.
- Backend routes are stable under `/api/jobs` in `backend/src/routes/jobRoutes.js`, including prevalidate, create, list, detail, cancel, ZIP download, file download, and re-ask.
- Upload prevalidation stores the raw workbook in `storage/temp` with a manifest sidecar, validates extension/size/row count, and returns a resumable `prevalidatedFileId` from `backend/src/services/prevalidationService.js`.
- Job creation in `backend/src/services/jobService.js` copies the uploaded file into `storage/jobs/<jobId>/input/`, writes `job-request.json` under the job temp folder, creates Firebase `Job` and `JobFile` records, and enqueues the job.
- Queueing is currently in-memory in `backend/src/queue/jobQueue.js`, with queue membership and active execution not durably persisted across process restarts.
- Execution is currently MW-specific in `backend/src/services/prWorkerService.js`, which validates the workbook, filters rows, runs a Python preflight, runs the child process, collects outputs, generates reports and ZIP packaging, updates Firebase state, and emits websocket events.
- The current MW engine launcher in `backend/src/services/childProcessRunner.js` is hardwired to the existing engine root `skills/create-pr-cd` and script `scripts/generate_tss_pr_ecc.py`, which is a major coupling point that the RAN adapter must not inherit.
- Cancellation for queued jobs is immediate in the in-memory queue, while running-job cancellation is cooperative through `workerStateService` and periodic polling in the child-process runner.
- Persistent job metadata lives in Firebase paths `jobs/<jobId>` and `job_files/<jobId>/<fileId>` via `backend/src/models/Job.js`, `backend/src/models/JobFile.js`, and `backend/src/db/firebaseClient.js`.
- Realtime status is split: durable job status lives in Firebase, but phase/progress/heartbeat/cancellation-request state lives only in memory through `backend/src/services/workerStateService.js` and websocket publication in `backend/src/websocket/eventPublisher.js` and `backend/src/websocket/server.js`.
- Download behavior is filesystem-backed and path-checked: detail and download endpoints resolve tracked files under the storage root, while ZIP delivery depends on `zip_package` `JobFile` records created by `backend/src/services/outputCollector.js`.
- Cleanup and retention are platform-owned in `backend/src/services/cleanupService.js`, which deletes tracked files only for terminal jobs and marks them unavailable in Firebase rather than deleting job history.
- Job History currently filters only `workerType: 'pr-worker'` in `frontend/src/views/JobHistoryView.vue`, and Job Detail currently expects the existing detail payload shape in `frontend/src/views/JobDetailView.vue`.
- Safe failure visibility already exists: `jobService` redacts paths, argument values, and secrets before surfacing worker stderr in failure diagnosis payloads rendered by `frontend/src/components/detail/FailureDiagnosis.vue`.
