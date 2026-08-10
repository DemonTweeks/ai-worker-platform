# AI Worker Platform — Overall Analysis and Remediation Plan

> Status: analysis baseline, pending detailed discussion
> This plan records current architecture and proposed work. It is not authorization to implement every phase.

## 1. Goals

1. Restore a known and approved worker-engine baseline.
2. Make local and Windows host behavior consistent with the supported deployment scope.
3. Make job lifecycle transitions reliable across errors and process restarts.
4. Make outputs atomic, verifiable, and safe to download.
5. Establish a clean-checkout test gate covering all worker families.
6. Harden secrets, uploads, persistence access, and network boundaries.
7. Reduce coupling in the largest backend and frontend modules.

## 2. Current System Responsibilities

### Platform responsibilities

- Browser navigation and worker-specific input forms
- Workbook upload and prevalidation
- Job creation, idempotency, queueing, cancellation, and rerun
- Worker selection and adapter dispatch
- Per-job input, temporary, report, and output storage
- Progress events and WebSocket subscriptions
- Job history, details, summaries, warnings, and review-required items
- ZIP packaging and file downloads
- Admin login, auditing, health, and deployment handoff
- Optional LLM wording and re-ask responses

### Worker-engine responsibilities

- Business rules and configuration
- Input normalization and transformation
- TSS/TI/RAN/audit calculations
- Domain-owned templates and reference assets
- Domain output generation

The platform must keep the adapter boundary and must not reimplement domain calculations.

## 3. Folder Structure

```text
ai-worker-platform/
|-- backend/
|   |-- scripts/                  # executable backend and worker regression tests
|   `-- src/
|       |-- config/               # environment and runtime path resolution
|       |-- db/                   # Firebase REST persistence
|       |-- llm/                  # optional provider, fallback, wording, and re-ask
|       |-- middleware/           # admin auth, uploads, and error mapping
|       |-- models/               # Firebase-backed model compatibility API
|       |-- queue/                # in-memory job scheduling
|       |-- routes/               # health, jobs, and admin HTTP contracts
|       |-- services/             # orchestration, storage, reporting, execution
|       |-- websocket/            # subscriptions, heartbeat, and job events
|       `-- workers/
|           |-- adapters/         # job payload to engine invocation
|           |-- manifests/        # approved engine version and capability contract
|           `-- workerRegistry.js # worker lookup and adapter factory
|-- frontend/
|   |-- scripts/                  # route smoke test
|   `-- src/
|       |-- api/                   # job, admin, and re-ask HTTP clients
|       |-- components/            # shared, detail, history, and admin UI
|       |-- config/                # worker navigation
|       |-- services/              # auth state and WebSocket client
|       |-- utils/                 # status, formatting, and result helpers
|       `-- views/                 # worker, history, detail, dashboard, admin pages
|-- skills/
|   |-- create-pr-cd/              # MW engine submodule
|   |-- create-pr-cd-ran/          # RAN engine submodule
|   `-- tx-pr-auditor/             # PR Auditor engine submodule
|-- storage/                        # ignored runtime job and output data
|-- README.md
`-- wiki/
    |-- SUMMARIZE.md
    |-- HANDOVER.md
    `-- PLAN.md
```

## 4. Main Runtime Functions

### 4.1 Startup

File: `backend/src/server.js`

- `startServer()` verifies approved engine integrity before opening the HTTP server.
- It initializes WebSocket handling and storage.
- It checks Firebase reachability asynchronously.
- It currently has no persisted-job reconciliation step.

Planned changes:

- Add configuration validation before integrity checks.
- Add persistence health requirements based on environment.
- Reconcile interrupted jobs before accepting new work.
- Add graceful shutdown coordination for queue, workers, streams, and WebSockets.

### 4.2 Configuration

File: `backend/src/config/env.js`

- Resolves repo-relative engine and storage paths.
- Parses limits, WebSocket settings, LLM settings, and admin credentials.
- Uses a hard-coded Firebase URL when none is supplied.

Planned changes:

- Separate development defaults from required production configuration.
- Validate absolute Windows paths.
- Add all worker roots to `.env.example`.
- Fail production startup for missing persistence or insecure secrets.

### 4.3 Worker registration and integrity

Files:

- `backend/src/workers/workerRegistry.js`
- `backend/src/workers/manifests/*.js`
- `backend/src/services/engineIntegrityService.js`

Functions:

- `getWorkerManifest(workerId)` returns the declared contract.
- `getWorkerAdapter(workerId)` returns the execution adapter.
- `assertPlatformEngineIntegrity()` verifies approved commits and runtime files.

Planned changes:

- Resolve the MW commit decision.
- Make integrity requirements explicit and consistent for all three engines.
- Provide a documented promotion procedure that includes business regression evidence.

### 4.4 Prevalidation

Files:

- `backend/src/routes/jobRoutes.js`
- `backend/src/services/prevalidationService.js`
- `backend/src/middleware/uploadMiddleware.js`

Functions:

- `validateUpload()` validates and stores a reusable uploaded workbook.
- `getPrevalidatedUpload()` resolves the stored upload contract.
- `consumePrevalidatedUpload()` consumes its manifest for job creation.
- `releasePrevalidatedUpload()` deletes unused retained input.

Planned changes:

- Stream or spool large uploads instead of buffering the maximum size in memory.
- Validate MIME signature as well as file extension.
- Add rate and concurrency limits at the intended access boundary.
- Make test doubles export the complete module contract.

### 4.5 Job orchestration

File: `backend/src/services/jobService.js`

Current responsibilities include:

- MW, RAN, and PR Auditor job creation
- Idempotency and browser-tab ownership
- Input copying and metadata creation
- Queue insertion
- Cancellation and rerun
- Job history/detail serialization
- Download resolution and re-ask

Planned decomposition:

```text
services/jobs/
|-- jobCreationService.js         # shared creation transaction and idempotency
|-- mwJobPayloadService.js        # MW request contract
|-- ranJobPayloadService.js       # RAN request contract
|-- auditorJobPayloadService.js   # PR Auditor request contract
|-- jobQueryService.js            # list and detail reads
|-- jobControlService.js          # cancel and rerun
|-- jobDownloadService.js         # file and ZIP lookup
`-- jobSerializationService.js    # API response contracts
```

Do this only after integration tests protect existing behavior.

### 4.6 Queue and worker execution

Files:

- `backend/src/queue/jobQueue.js`
- `backend/src/services/workerStateService.js`
- `backend/src/workers/adapters/*.js`
- `backend/src/services/childProcessRunner.js`

Functions:

- `enqueueJob()` records a job in the in-memory queue and drains available slots.
- `drainQueue()` resolves the worker adapter and runs it.
- `cancelQueuedJob()` cancels queued work or requests active cancellation.
- Worker state functions publish phase transitions and cancellation state.

Planned changes:

- Persist queue ownership or rebuild it from authoritative job records.
- Add startup reconciliation according to the selected restart semantics.
- Add shutdown draining and child-process termination.
- Add lease/owner metadata if more than one backend instance may run.

### 4.7 Output collection and packaging

Files:

- `backend/src/services/outputCollector.js`
- `backend/src/services/reportGenerator.js`
- `backend/src/services/storageService.js`

Functions:

- `collectOutputs()` discovers engine output and registers metadata.
- `generateReportsAndPackage()` creates reports, summary, and ZIP.
- `createZipPackage()` currently streams an archive directly to its final path.
- Storage helpers constrain paths to the storage root.

Planned changes:

- Write to `<job>.zip.part` and rename only after successful close.
- Listen to errors from the archive, source streams, and output stream.
- Remove partial files on failure.
- Coordinate packaging with cleanup and cancellation.
- Register `JobFile` only after the final file exists and its metadata is verified.

### 4.8 Persistence

Files:

- `backend/src/db/firebaseClient.js`
- `backend/src/models/compatibility.js`
- `backend/src/models/*.js`

Current behavior:

- Models expose a query-chain compatibility interface over Firebase operations.
- Reads and writes are translated to Firebase REST calls.
- The client currently sends no Firebase authentication credential.

Firebase is the authoritative persistence backend. Avoid expanding the compatibility layer; instead, formalize authenticated access, namespace isolation, backup, recovery, and migration behavior.

### 4.9 Frontend runtime

Files:

- `frontend/src/router.js`
- `frontend/src/views/PRCreatorView.vue`
- `frontend/src/views/PRAuditorView.vue`
- `frontend/src/views/shared/workerRuntime.js`
- `frontend/src/services/websocketClient.js`

Current behavior:

- Worker pages share upload, selected-job, idempotency, notification, and WebSocket lifecycle logic.
- Browser session storage separates tabs.
- History and detail views recover persisted state through REST.

Planned decomposition:

```text
frontend/src/features/workers/
|-- shared/
|   |-- useWorkerJobRuntime.js
|   |-- usePrevalidatedUploads.js
|   `-- workerSessionStore.js
|-- mw-pr/
|-- ran-pr/
`-- pr-auditor/
```

Vue 2 does not have native Composition API in this project, so use mixins/services or plan a framework migration separately. Do not combine a behavior refactor with a Vue migration.

## 5. Detailed Phases

### Phase 0 — Confirm decisions and freeze baseline

Tasks:

- Resolve D1–D5 from `HANDOVER.md`.
- Record expected deployment topology and job-restart behavior.
- Capture submodule commits and representative golden input/output evidence.
- Define which tests are hermetic versus live/golden.

Exit criteria:

- No implementation depends on an unanswered architecture choice.

### Phase 1 — Restore engine integrity

Tasks:

- Restore or promote the MW engine.
- Verify declared runtime files and fingerprint.
- Run MW engine and platform regression flows.
- Update README and technical references.

Exit criteria:

- Clean checkout passes the integrity test and backend startup integrity gate.

### Phase 2 — Align configuration and deployment

Tasks:

- Fix RAN and Auditor Windows roots.
- Configure `RAN_WORKSPACE_ROOT` under platform storage.
- Configure Firebase explicitly for every supported runtime environment.
- Add production configuration validation.
- Add health checks for backend and frontend.

Exit criteria:

- Selected deployment targets start from documented clean commands.

### Phase 3 — Stabilize tests before deeper changes

Tasks:

- Create unique test storage roots.
- Default unit/integration tests to mock persistence.
- Fix Node shutdown and incomplete stubs.
- Include all backend suites in named aggregate gates.
- Restore frontend dependency install and test execution.
- Add CI.

Proposed commands:

```text
npm run test:unit
npm run test:integration
npm run test:workers
npm run test:live
npm test                 # unit + hermetic integration + worker contract tests
```

Exit criteria:

- The hermetic default gate passes from a clean checkout.
- Live/golden tests are explicit and documented.

### Phase 4 — Make lifecycle restart-safe

Tasks:

- Implement the chosen job reconciliation policy.
- Persist runtime owner/lease metadata if needed.
- Add graceful shutdown and interrupted-job events.
- Test queued, running, cancelling, packaging, and exporting states across restart.

Exit criteria:

- Every persisted non-terminal state has deterministic startup handling.

### Phase 5 — Make outputs atomic

Tasks:

- Harden ZIP streams and temporary output handling.
- Coordinate cleanup and worker completion.
- Add disk-error and missing-path tests.
- Verify download availability only for complete files.

Exit criteria:

- Output failures become terminal job failures or safe warnings, never process crashes.

### Phase 6 — Security hardening

Tasks:

- Remove default admin password/JWT secret.
- Select and enforce CORS origins.
- Apply the agreed user authentication boundary.
- Authenticate Firebase or constrain it through trusted infrastructure.
- Add rate, upload, and request limits.
- Review logging and error redaction.

Exit criteria:

- Production cannot start with known placeholder credentials.
- Threat-boundary tests cover unauthorized admin and job operations.

### Phase 7 — Decompose large modules

Tasks:

- Split `jobService.js` by lifecycle responsibility and worker payload.
- Split frontend runtime/session/upload concerns.
- Extract worker-specific forms and result presentation.
- Remove obsolete persistence compatibility naming after Firebase contracts are settled.

Exit criteria:

- Route and UI behavior remains unchanged.
- Each module has one clear responsibility and focused tests.

## 6. Testing Matrix

| Layer | Required coverage |
| --- | --- |
| Configuration | local and Windows paths; missing secrets; invalid limits |
| Integrity | approved commit, dirty engine, fingerprint mismatch, missing engine |
| Prevalidation | type, extension, limits, retained uploads, tab ownership |
| Job API | all worker payloads, idempotency, rerun, cancellation, history |
| Queue | concurrency, duplicate enqueue, restart, shutdown, cancellation race |
| Workers | MW TSS/TI, RAN standard/general, Auditor audit/summary |
| Storage | traversal, missing files, cleanup, retention, atomic ZIP |
| Persistence | mock contract plus explicit live integration |
| WebSocket | subscribe, reconnect, heartbeat, terminal status recovery |
| Frontend | routes, worker forms, retained uploads, detail/history, responsive UI |
| Deployment | Windows service health, engine paths, startup, writable storage |

## 7. Risks and Controls

| Risk | Control |
| --- | --- |
| New engine changes business output | Golden comparison and business approval before manifest update |
| Restart duplicates work | Idempotency plus persisted reconciliation/lease |
| Cleanup races packaging | Active operation guard and atomic temporary files |
| Live tests mutate shared Firebase | Unique namespace or isolated test database |
| Refactor changes behavior | Complete hermetic tests before decomposition |
| Developer and Windows service environments diverge | Explicit environment matrix and path tests |
| Default credentials reach production | Startup validation and secret injection |

## 8. Documentation Deliverables

Keep these documents current as decisions are made:

- `wiki/SUMMARIZE.md` — short current-state summary
- `wiki/HANDOVER.md` — coordination context, decisions, workstreams, and guardrails
- `wiki/PLAN.md` — detailed architecture and staged remediation plan
- `README.md` — supported setup, test, and deployment commands
- ADR updates — persistence, restart semantics, access boundary, and engine promotion
- Verification log — commands, versions, results, and skipped live checks

## 9. Next Discussion

Before implementation, discuss:

1. The exact goal for the next milestone.
2. Whether the new MW engine checkout is intentional.
3. The production persistence and deployment topology.
4. Expected job behavior after restart or deployment.
5. Authentication and network exposure requirements.
6. Which test data and golden outputs are approved for validation.

After these are answered, revise this plan into a committed execution sequence with scoped acceptance criteria.
