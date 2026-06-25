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

## 2026-06-25 - Phase 0 RAN Engine Discovery

### Decision

Anchor the RAN adapter design to the pinned upstream pipeline scripts and workbook-backed web/API project source, not to the legacy interactive CLI menu.

### Why

At tag `v1.0.0` / commit `239910e2816153339a94881597bbb95355059741`, the upstream repository contains both a legacy CLI selection menu in `src/run_pipeline.py` and a dynamic FastAPI `/projects` implementation in `api/app.py`. The CLI exposes only eight hard-coded project names, while the workbook/API path derives projects from the General Item workbook and already includes additional live project columns. The mission explicitly requires dynamic and validated General Item project selection, so the platform must follow the workbook/API source of truth instead of the stale interactive menu.

### Impact

The RAN worker contract should validate General Item selections against parsed workbook project columns, preserve Standard PR non-interactive execution when no project is selected, and avoid copying or reusing the upstream FastAPI/web layer.

## 2026-06-25 - Key Upstream RAN Findings

### Decision

Record the pinned upstream RAN engine structure and artifact expectations as the authoritative compatibility baseline for Phase 1 engine integration.

### Why

The mission requires inspection of actual RAN engine inputs, outputs, configurations, imports, templates, samples, and project-selection source before implementing the submodule and adapter.

### Impact

The following upstream findings now guide the implementation:

- The pinned upstream repository root includes `src/`, `config/`, `input/`, `output/`, `api/`, `web/`, `build/`, `dist/`, `launcher.py`, and `launcher.exe`, but only `src/`, `config/`, and validated reference assets are eligible for isolated workspace copying under mission constraints.
- The main processing path is the four-step pipeline in `src/run_pipeline.py`: `src/simple_normalize.py`, `src/simple_calculation.py`, `src/simple_pr_generator.py`, and `src/simple_ecc_export.py`.
- `src/run_pipeline.py` invokes subprocesses using `["python", script_name]`, which is incompatible with the mission constraint against bare `python`; the platform adapter must replace this with explicit invocation of the platform-resolved interpreter.
- Standard PR is already supported non-interactively by running the pipeline with no selected project; General Item processing is enabled only when `SELECTED_PROJECT`, `GENERAL_ITEM_PROJECT`, or `--selected-project` is present for `src/simple_pr_generator.py`.
- Input file paths are fixed upstream through environment variables with defaults `input/BOM.xlsx` and `input/EPMS.xlsx` in `src/simple_normalize.py` and `src/simple_pr_generator.py`, so the platform must materialize per-job copies using those filenames inside an isolated workspace rather than letting jobs touch the submodule or a shared upstream `input/` folder.
- Output paths are fixed upstream to `output/simple_normalized.json`, `output/simple_calculated.json`, `output/simple_pr_output.json`, `output/general_pr_output.json`, `output/simple_pr_output_with_general_items.json`, `output/ECC_PR_Output.xlsx`, and `output/ECC_PR_Output_With_GeneralItems.xlsx`, plus `output/job_info.json` in the FastAPI wrapper.
- The primary workbook configuration comes from `config/MainConfig.xlsx`, which contains at least `MainRuleTable`, `Equipment_Normalization`, and `Calculation_Rules` sheets consumed by the four pipeline stages.
- General Item rules come from `config/GENERAL ITEM FOR ALL DU PROJECT Overall.xlsx`, with region sheets `Central`, `Sabah`, `Sarawak`, `Northern`, plus `EM Transportation Model`.
- Dynamic project selection in `api/app.py` reads project names from workbook columns starting at column index 4 across all sheets, filtering empty and `Unnamed` headers; this is the closest upstream source of truth for valid General Item options.
- The workbook currently exposes more projects than the legacy CLI menu, including the original eight names plus newer entries such as `Decomm Cabinet CR`, `Imacro BBU Swap`, `Decomm Reuse`, `2025 NIC revisit`, `Highways Add Sec`, `MSQos_2025`, and `Project Thanos`.
- `src/simple_pr_generator.py` applies region-sensitive General Item logic: Central rows always match, Northern matches `Province/State`, Sabah/Sarawak match through `City` plus the `EM Transportation Model` mapping derived from EPMS data.
- `src/simple_pr_generator.py` also supports `Optional` project flags gated by a combined quantity threshold over a fixed set of item keys such as `AAU`, `Antenna`, `Battery`, `BBU`, `Bracket`, `Cabinet`, `Power Module`, `Combiner`, `PadPower`, `Post`, `RRU`, `RRU Cage`, `Security Bar`, `Feeder 1/2`, `Feeder 1 5/8`, and `Feeder 7/8`.
- The upstream FastAPI and `web/index.html` layers write uploads directly to fixed shared files, expose a global `JOB_STATUS`, and mix PR generation with BOM comparison workflows; these are explicitly out of scope for reuse and confirm why the platform must integrate only the engine logic.
- The sample EPMS workbook uses sheet `data` with the real lookup header row at row 4, which matches the `header=3` assumptions in upstream code; the sample BOM workbook uses row 3 as the header row, matching the `header=2` assumptions in `src/simple_normalize.py`.

## 2026-06-25 - Prototype UX And ADR Checkpoint

### Decision

Use the existing platform routes and job surfaces as the only user-facing shell for RAN, with worker-aware branching added inside the platform rather than a second application shell.

### Why

Phase 0 discovery showed that the current platform already has coherent home, history, and job-detail flows, while the upstream RAN repo contains a fixed-file FastAPI/web prototype that the mission explicitly forbids reusing. A platform-native worker experience minimizes regression risk and aligns with the worker-registry architecture.

### Impact

The initial UX contract is now captured in `docs/ran-pr-worker-integration/prototype-ux-contract.md`, and the architectural boundary is captured in `docs/ran-pr-worker-integration/worker-skill-contract-adr.md`.

## 2026-06-25 - Superpowers Brainstorming Conflict

### Decision

Apply the `superpowers:brainstorming` skill as a methodology check, but do not block this autonomous mission on its normal interactive approval loop.

### Why

The brainstorming skill requires interactive clarification and user approval before design handoff, while the master prompt requires exactly one bounded autonomous continuation step per wake-up and explicitly says not to wait for routine approval for discovery, documentation, or checkpointing.

### Impact

This turn produced an internal design checkpoint and recorded the conflict. If the user later requests interactive design review, the documents created in this step can serve as the starting point.

## 2026-06-25 - Implementation Planning Checkpoint

### Decision

Store the implementation-oriented execution plan inside `docs/ran-pr-worker-integration/execution-plan.md` instead of the default Superpowers plans directory.

### Why

The master prompt says all mission state should remain inside `docs/ran-pr-worker-integration/`, which overrides the default `docs/superpowers/plans/...` location from the planning skill.

### Impact

The mission now has a single in-repo plan artifact that the heartbeat loop can reread directly before implementation steps.
