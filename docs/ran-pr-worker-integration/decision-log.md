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

## 2026-06-25 - Task 1 Worker Foundation

### Decision

Keep the first implementation checkpoint intentionally narrow: pin the upstream RAN submodule and add worker metadata/config scaffolding before introducing any execution-path behavior changes.

### Why

This reduces risk while establishing the pinned engine source and the shared registry/manifests that later tasks will build on.

### Impact

Subsequent implementation steps can now refer to the registered `mw-pr` and `ran-pr` identities, the pinned submodule path, and explicit RAN engine/workspace config roots.

## 2026-06-25 - Task 2 Workspace And Catalog Scope

### Decision

Keep Task 2 limited to workbook-derived project parsing and isolated workspace staging, without yet coupling those services into job creation or execution dispatch.

### Why

This preserves a clean checkpoint boundary between shared preparation services and the later adapter/registry behavior changes in Tasks 3 and 4.

### Impact

The next implementation step can consume tested catalog and staging primitives instead of mixing parsing, staging, and execution logic together.

## 2026-06-25 - Task 3 Execution Foundation Scope

### Decision

Keep this Task 3 checkpoint limited to the reusable execution foundation: explicit Python stage launching, an initial `ranPrAdapter` skeleton, registry wiring for the RAN adapter, and persistent job/file metadata fields.

### Why

The execution plan separates adapter/runtime groundwork from later output ingestion, safe-error shaping, and queue/route dispatch changes. Preserving that boundary makes it easier to verify the explicit-interpreter constraint and job metadata behavior without entangling broader backend rewiring in the same step.

### Impact

The next bounded continuation can focus on RAN output ingestion and failure handling using the new adapter/runner seam, while Task 4 can later switch queue dispatch over to the worker registry with less risk.

## 2026-06-25 - Task 3 Output Ingestion Scope

### Decision

Keep this continuation focused on platform-owned output ingestion for the approved RAN ECC workbooks, and make the existing summary/package layer count those tracked files without yet reshaping route payloads or the broader failure model.

### Why

The adapter could already run the upstream stage sequence, but without a storage-ingestion seam the platform had no durable RAN outputs to expose or package. Narrowing this step to approved file ingestion preserves the bounded-step rule while moving the RAN path closer to the platform contract used by Job Detail and ZIP downloads.

### Impact

The next bounded continuation can focus specifically on safe RAN error conversion and backend coverage, building on a durable output model rather than mixing output plumbing and failure semantics together.

## 2026-06-25 - Task 3 Safe Failure Scope

### Decision

Keep this continuation limited to safe, worker-aware failure shaping for the RAN adapter path and direct backend coverage of those diagnostics, without yet moving queue dispatch, route payloads, or frontend behavior.

### Why

The platform already had hardened MW error visibility, but the new RAN adapter path needed equivalent stage-aware summaries and diagnosis that avoid leaking raw paths while still surfacing actionable context. Tightening only that seam keeps the wake-up bounded and gives the future registry integration a safer failure contract to build on.

### Impact

The next continuation can either finish any remaining direct adapter-path coverage or move into Task 4 with RAN failure presentation already aligned to platform safety expectations.

## 2026-06-25 - Task 3 Direct Adapter Coverage Scope

### Decision

Keep this continuation focused on direct backend coverage for the RAN adapter’s successful and cooperative-cancellation paths, and wire that coverage into the backend test command without yet switching the runtime dispatch over to the worker registry.

### Why

The adapter already had execution, ingestion, and failure-shaping pieces, but Task 3 still lacked direct evidence that those seams behave correctly in success and cancellation scenarios. Adding a focused mock-driven adapter test closes that gap while preserving the bounded-step rule and avoiding premature Task 4 coupling.

### Impact

The next continuation can enter Task 4 with the RAN adapter seam covered across success, cancellation, output ingestion, and safe failure behavior.

## 2026-06-25 - Task 4 Registry Dispatch Scope

### Decision

Keep this Task 4 continuation narrowly focused on introducing the MW adapter and routing queue execution through the worker registry, without yet changing create-route payloads, history/detail serialization, or frontend behavior.

### Why

The registry and RAN adapter already existed, but queued execution still bypassed them by calling the legacy MW runner directly. Switching only the queue dispatch seam to registry-owned adapter resolution creates the backend execution spine for both workers while keeping the wake-up bounded and limiting regression risk.

### Impact

The next continuation can focus on worker-aware backend payloads and job-creation behavior, building on a queue that already resolves execution through explicit registered adapters.

## 2026-06-26 - Task 4 Worker-Aware Payload Scope

### Decision

Keep this continuation limited to making backend create/list/detail payloads explicitly worker-aware, while leaving the existing MW create route behavior intact as the default-compatible path and deferring full RAN create-body handling to the next step.

### Why

The queue can now resolve adapters through the registry, but the backend API contract still looked MW-only. Exposing `workerId`, display name, engine audit metadata, and RAN run metadata in the shared payloads moves the platform contract toward dual-worker support without forcing a larger create-route rewrite in the same bounded step.

### Impact

The next continuation can focus directly on the first backend RAN create flow, building on payloads that already represent worker identity and audit metadata consistently in create/list/detail responses.

## 2026-06-26 - Task 4 First RAN Create Path Scope

### Decision

Add the first backend `ran-pr` create path by extending the existing job service and prevalidation manifest contract, while preserving the legacy MW route body and response shape for `mw-pr`.

### Why

The worker registry and payload serialization were already in place, but the backend still could not create a queued RAN job with tracked BOM and EPMS inputs. Extending the prevalidation manifest with an explicit `uploadKind` lets the platform distinguish MW exports from RAN BOM/EPMS workbooks safely without duplicating upload infrastructure, while keeping the bounded step focused on service-layer creation rather than full end-to-end route coverage.

### Impact

The backend can now queue the first `ran-pr` jobs with validated `runMode` and `selectedProject` metadata, audited engine pinning, and tracked `ran_bom_upload` / `ran_epms_upload` files. The next continuation should exercise this new API seam through route/integration coverage and then continue deeper into backend lifecycle behavior.

## 2026-06-26 - Task 4 Route Coverage And BOM Hardening Scope

### Decision

Use a focused backend route test to exercise `ran-pr` prevalidation and create behavior end-to-end, and tighten `ran-bom` prevalidation so the API rejects unreadable Excel payloads before issuing resumable file ids.

### Why

The prior step added service-layer RAN creation, but the API contract still lacked direct route coverage and left a real validation gap: `ran-bom` uploads accepted arbitrary `.xlsx`-named blobs because they were not required to look like actual Excel workbooks. A route-level TDD slice closes both issues in one bounded continuation without yet pulling in the full RAN execution lifecycle.

### Impact

The backend now has explicit route evidence for upload-kind handling and `ran-pr` create serialization, and unreadable BOM payloads are stopped before job creation. The next continuation can move on to shared queue lifecycle, progress, and cancellation behavior for RAN jobs.

## 2026-06-26 - Task 4 RAN Runtime Lifecycle Scope

### Decision

Introduce a dedicated `ranWorkerService` runtime wrapper and repoint the worker registry to it, instead of letting queued `ran-pr` jobs call the raw engine adapter directly.

### Why

The raw RAN adapter can execute the engine and ingest approved outputs, but it does not own platform job status, worker-state phases, websocket event publication, final summary persistence, or packaging behavior. The platform already treats MW execution through a worker-service layer, so mirroring that separation for RAN is the smallest aligned way to make queued RAN jobs participate in the shared lifecycle contract without overloading the engine adapter itself.

### Impact

Queued `ran-pr` jobs now have a platform runtime seam for lifecycle status, stage progress, cancellation results, and packaged completion outputs. The next continuation should exercise that runtime through higher-level route or integration coverage so Job Detail and websocket consumers are proven end-to-end against a live RAN execution path.

## 2026-06-26 - Task 4 Terminal Status Ordering For Live RAN Detail

### Decision

Delay the durable terminal status update for successful and cancelled-with-partial-result `ran-pr` jobs until after report generation and ZIP packaging complete.

### Why

The new live route/runtime integration test proved that `ranWorkerService` could mark a job `completed` before `generateReportsAndPackage(...)` finished. That let HTTP detail polling observe a terminal job whose `zip_package` record was not yet available, even though websocket completion was only emitted after packaging. Terminal detail should represent a ZIP-ready completed job, not an intermediate packaging window.

### Impact

`ran-pr` job detail now stays in a non-terminal lifecycle status until summary/ZIP artifacts are ready, keeping route polling, websocket completion, and download availability aligned for consumers such as Job Detail.

## 2026-06-26 - Task 4 Running Cancellation Event Semantics

### Decision

Do not emit `JOB_CANCELLED` from the queue layer when a running job merely receives a cancellation request; instead, refresh subscribed clients via heartbeat state and reserve `JOB_CANCELLED` for the real terminal cancellation path.

### Why

The new live cancellation integration test proved that the queue layer was publishing `JOB_CANCELLED` while the active `ran-pr` job still had status `generating`. That leaked a terminal-sounding websocket event before the worker had actually stopped or packaged its partial outputs, which breaks the same route/event/detail parity guarantees we just established for completion.

### Impact

Subscribed clients can still see cancellation requested immediately through `workerState.cancellationRequested` and heartbeat updates, while the first `JOB_CANCELLED` event now means the job is actually terminal and any partial-result ZIP is ready.

## 2026-06-26 - Task 5 Home-View Scope And Project Source

### Decision

Start Task 5 with a single worker-aware home-view slice that adds RAN BOM/EPMS uploads, run-mode handling, and workbook-backed General Item selection, supported by a small backend `ran-projects` route instead of duplicating workbook parsing logic in the frontend.

### Why

The backend already owns validated project derivation through `ranProjectCatalogService`, and the UX contract requires dynamic General Item projects without arbitrary user strings. Reusing that backend source keeps the frontend thin, preserves validated project names, and lets the first frontend slice stay focused on launch-input branching while preserving the existing MW workbench as the default path.

### Impact

The home route can now launch both MW and RAN jobs through the platform workbench using worker-aware payloads and validated project choices. The next frontend continuation can move beyond launch inputs into history badges/filters and job-detail audit rendering without reopening the launch contract.

## 2026-06-26 - Task 5 History And Detail Scope

### Decision

Extend the existing shared History and Job Detail surfaces with worker-aware filters, labels, and audit metadata instead of creating any RAN-specific route, page, or alternate detail experience.

### Why

The mission requires unified platform history and Job Detail, and the backend already supplies worker identity plus engine audit fields on the shared job payloads. Reusing those shared surfaces keeps MW behavior intact, avoids UI fragmentation, and lets the frontend prove worker-aware rendering with the smallest possible change set.

### Impact

History can now be filtered by worker and shows which worker produced each job, while Job Detail exposes the RAN audit metadata needed for traceability. The next continuation can leave the launch/history/detail UI path in place and move into Phase 4 verification work such as golden checks, regression coverage, and persistence proof.

## 2026-06-26 - Phase 4 Validation Depends On The Existing MW Fixture Submodule

### Decision

Initialize the existing `skills/create-pr-cd` submodule in this workspace before treating backend full-suite validation results as authoritative Phase 4 evidence.

### Why

The backend integration script still uses the legacy MW sample workbook at `skills/create-pr-cd/Info/input/site_pr_po_view.xlsx` to exercise the preserved MW flow. In this workspace the gitlink existed but the submodule was uninitialized, so the first backend suite failure was an environment precondition issue rather than a RAN regression. Initializing the submodule restores the already-tracked fixture source without changing any pinned contents or business logic.

### Impact

Phase 4 backend validation can now be trusted in this workspace, and the next bounded verification step can move on to the golden/business-result checks instead of spending more time on suite bootstrapping.

## 2026-06-26 - Golden Comparison Uses The Pinned Swap/Modernize Sample Project

### Decision

Use the workbook-backed project `CD consolidation 2023 (Swap/ Modernize)` for the first General Item golden comparison, and compare the platform-generated ECC workbooks against the pinned upstream sample ECC workbooks by logical row content rather than Excel binaries.

### Why

The upstream sample output bundle already records that project in `skills/create-pr-cd-ran/output/job_info.json`, and the mission explicitly requires logical business-result verification instead of binary workbook comparison. Matching sheet names, headers, row counts, quantities, General Item presence, and the full logical row set gives stronger evidence than file hashes while still honoring the mission constraint.

### Impact

The branch now has a repeatable golden-test command that proves the real platform execution path reproduces both the Standard PR and General Item sample business outputs. The next bounded verification step can move to persistence/history reload and workspace-isolation coverage.
