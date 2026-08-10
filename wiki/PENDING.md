# AI Worker Platform — Pending Items

This file tracks unresolved architecture work that requires a decision or implementation before the platform can be considered production-ready.

## P-001 — Durable Queue and Restart Reconciliation

- Status: pending
- Priority: high
- Area: backend job lifecycle

### Limitation

Queue ownership exists only in memory. Restarting the backend loses queued and active runtime state even though job records remain in Firebase.

### Current implementation

- `backend/src/queue/jobQueue.js` stores queued job IDs in an array.
- Active and known job IDs are stored in process-local sets.
- `backend/src/services/workerStateService.js` stores execution phases in a process-local map.
- Firebase persists job records and status history, but startup does not rebuild or reconcile runtime ownership.

### Impact

- A persisted `queued` job may never run after a restart.
- A job recorded as running may no longer have an owning worker process.
- Cancellation can become inconsistent because the new process does not know the previous runtime owner.
- Users may see jobs permanently stuck in a non-terminal state.
- Starting multiple backend instances would allow each instance to maintain an independent and conflicting queue.

### Decision required

Choose the authoritative restart behavior:

1. Requeue interrupted jobs automatically when their inputs remain valid.
2. Mark interrupted jobs failed and require an explicit rerun.
3. Resume only workers with a proven continuation contract and fail the others safely.

The decision must also establish whether more than one backend instance may execute jobs concurrently.

### Proposed design direction

- Persist a runtime owner or lease with a bounded expiry.
- Reconcile all non-terminal jobs before accepting new work at startup.
- Use an atomic claim operation so only one runtime can own a job.
- Record every restart transition as a job event.
- Ensure reconciliation is idempotent across repeated startup attempts.
- Preserve the existing request idempotency and rerun contracts.

### Completion criteria

- Every persisted non-terminal status has deterministic startup handling.
- Queued jobs cannot be silently lost.
- Running jobs cannot remain active without a valid runtime owner.
- Restart behavior is covered for queued, running, cancelling, exporting, and packaging phases.
- Reconciliation publishes a safe user-facing explanation and an auditable event.
- Tests cover repeated restart and multiple-runtime claim attempts.

### Primary files

- `backend/src/server.js`
- `backend/src/queue/jobQueue.js`
- `backend/src/services/workerStateService.js`
- `backend/src/services/jobControlService.js`
- `backend/src/services/jobService.js`
- `backend/src/models/Job.js`
- `backend/src/websocket/eventPublisher.js`

### Validation evidence required

- Restart with queued jobs
- Restart during worker execution
- Restart during cancellation
- Restart during output packaging
- Repeated reconciliation without duplicate execution
- Competing runtime ownership attempt
- Job Detail and History correctly explaining the recovered terminal state

## P-002 — Current Structure to Thin Skill Wrapper Refactor

- Status: deferred
- Priority: high
- Area: platform and skill ownership boundary

### Intent

The target architecture is documented in [ARCHITECTURE.md](ARCHITECTURE.md), [PLAN.md](PLAN.md), and [SKILL_CONTRACT.md](SKILL_CONTRACT.md).

The target has not been implemented. The current application still contains worker-specific technical and domain behavior inside the platform. This section records the difference so the refactor can be performed later without describing the target design as current behavior.

### Flow difference

Current flow:

```text
Worker-specific frontend form
  -> worker-specific API payload
  -> platform domain prevalidation and parsing
  -> worker-specific branch in jobService
  -> worker-specific adapter and worker service
  -> Python engine
  -> platform worker-specific output validation and ingestion
  -> platform report and ZIP generation
  -> worker-specific result display
```

Target flow:

```text
Generic skill request
  -> generic request and file validation
  -> manifest-driven skill lookup
  -> generic isolated Python runner
  -> standalone skill owns all domain processing
  -> standard progress events and result.json
  -> platform validates only the standard contract
  -> generic status and file delivery
```

### Structural difference

| Area | Current structure | Target structure |
| --- | --- | --- |
| API | Shared routes with worker-specific payload expectations | Generic skill catalog and job request envelope |
| Job creation | `jobService.js` branches for MW, RAN, and PR Auditor | One manifest-driven `createJob()` path |
| Input handling | Platform parses workbook structure and domain fields | Platform treats domain files as opaque |
| Prevalidation | Platform performs generic and domain validation together | Platform validates transport; skill validates domain content |
| Execution | Separate adapters and services for each worker | One generic skill runner |
| Workspace | RAN and Auditor have specialized workspace services | One isolated workspace contract for every skill |
| Progress | Platform and worker services define worker phases | Skill emits standard events with skill-owned phase codes |
| Output validation | Platform contains RAN and worker-specific validators | Skill validates its own output before writing `result.json` |
| Output ingestion | Platform understands domain filenames and report types | Platform reads generic output entries from `result.json` |
| Reports | Platform generates some domain-facing reports | Skill generates every domain report |
| Persistence | Job model contains worker/domain-specific fields | Generic job fields plus versioned skill metadata/details |
| Frontend | Dedicated MW/RAN and Auditor payload logic | Manifest/schema-driven inputs where practical |
| Testing | Platform tests include domain fixtures and golden behavior | Platform uses synthetic skills; skill repositories own domain tests |

### Current backend structure involved

```text
backend/src/
|-- routes/
|   `-- jobRoutes.js
|-- services/
|   |-- jobService.js
|   |-- prevalidationService.js
|   |-- iepmsParser.js
|   |-- siteCodeParser.js
|   |-- siteFilteringService.js
|   |-- prWorkerService.js
|   |-- ranWorkerService.js
|   `-- prAuditorWorkerService.js
|-- workers/
|   |-- adapters/
|   |-- manifests/
|   |-- ranBomValidationService.js
|   |-- ranEccOutputValidationService.js
|   |-- ranOutputIngestionService.js
|   |-- ranWorkspaceService.js
|   |-- prAuditorOutputIngestionService.js
|   `-- prAuditorWorkspaceService.js
`-- models/
    `-- Job.js
```

These files are not automatically obsolete in their entirety. During migration, generic lifecycle and safety behavior must be retained while domain behavior moves into the owning skill.

### Current frontend structure involved

```text
frontend/src/
|-- views/
|   |-- PRCreatorView.vue
|   |-- PRAuditorView.vue
|   `-- shared/workerRuntime.js
|-- api/
|   `-- jobApi.js
`-- utils/
    `-- prAuditorResultUtils.js
```

The target should keep shared job submission, progress, history, cancellation, and download behavior while reducing worker-specific payload construction in the core frontend.

### Domain logic that must move into skills

- Workbook and worksheet validation
- Domain column and field validation
- IEPMS parsing and interpretation
- Site filtering and domain matching
- RAN BOM validation
- RAN output validation
- PR Auditor output interpretation
- Domain warning and review-required decisions
- Domain report generation
- Business summary metrics

The platform may retain generic file size, extension, checksum, path, timeout, process, and result-schema validation.

### Refactor sequence

1. Approve `SKILL_CONTRACT.md` version `1.0`.
2. Implement schemas, registry, and a generic runner using a synthetic skill.
3. Add generic job APIs without removing current worker APIs.
4. Migrate one existing skill and prove standalone and platform execution.
5. Repeat for the remaining skills.
6. Redirect frontend flows to the generic API.
7. Delete worker-specific platform code only after equivalent skill behavior is verified.
8. Remove temporary compatibility routes and fields after the agreed transition period.

### Migration guardrails

- Do not move generic security or lifecycle controls into skills.
- Do not delete current behavior before standalone skill tests prove parity.
- Do not update an engine fingerprint merely to bypass integrity checks.
- Keep old and new execution paths distinguishable during migration.
- Preserve job history provenance, including skill ID, skill version, and contract version.
- Migrate one skill at a time.
- Keep rollback possible until each skill migration is accepted.

### Completion criteria

- All production skills use one generic runner.
- The platform does not parse domain workbooks.
- The platform contains no MW, RAN, or PR Auditor calculation or validation branches.
- Skills produce standard events and result envelopes.
- Every skill runs standalone through Python.
- Platform contract tests use synthetic skills instead of domain fixtures.
- Each skill owns and passes its domain unit, integration, and golden tests.
- Existing supported user flows remain available through the generic API and frontend.
