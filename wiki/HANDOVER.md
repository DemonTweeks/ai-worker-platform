# AI Worker Platform — Agent Handover

> Audience: a main implementation agent coordinating focused workstreams
> Status: provisional; confirm the pending product and infrastructure decisions before implementation

## Objective

Bring the current repository from a functional MVP baseline to a reproducible, restart-safe, and deployable release without moving business rules out of the worker engines.

## Repository State at Handover

- Branch: `main`, aligned with `origin/main` at the parent repository level.
- Pre-existing modification: `skills/create-pr-cd` is checked out at `048931a5` instead of the parent repository's approved `7971f90` gitlink.
- Do not discard, reset, or overwrite that submodule change without explicit user direction.
- The backend is intentionally blocked by engine integrity verification in this state.
- No `AGENTS.md` was found during the analysis.
- Frontend dependencies are not installed in the current workspace.

## Non-Negotiable Boundaries

1. Worker engines own business rules, configurations, templates, and transformations.
2. Platform code may validate contracts and orchestrate engines, but must not duplicate engine-owned rules.
3. Preserve user changes and unrelated dirty worktree state.
4. Never solve an integrity mismatch by blindly replacing the approved hash.
5. Tests must use isolated storage and mock persistence unless a live integration environment is explicitly requested.
6. Do not expose secrets, uploaded workbooks, generated outputs, or raw worker tracebacks.

## Decisions Required From the User

These choices affect the implementation direction and should be resolved first:

### D1 — MW engine baseline

- Restore `skills/create-pr-cd` to approved `7971f90`; or
- Promote `048931a5` after business regression validation.

### D2 — Firebase persistence controls

- Firebase is authoritative. Confirm its authentication mechanism, environment isolation, backup policy, recovery objectives, and migration expectations.

### D3 — Restart semantics

- Requeue interrupted jobs automatically;
- Mark interrupted jobs failed and require rerun; or
- Resume only jobs whose worker supports safe continuation.

### D4 — Deployment scope

Docker support has been removed. Confirm the supported Windows host topology, process supervision, and deployment handoff.

### D5 — Access boundary

- Trusted internal network with admin-only management; or
- Authenticated user access for all job APIs.

## Suggested Workstreams

The main agent may delegate these after D1–D5 are settled. Workstreams A and B are blocking; C–F can be developed in parallel once their contracts are agreed.

### Workstream A — Engine Baseline and Integrity

Scope:

- Confirm the intended MW submodule commit.
- Run engine-owned regression tests and representative platform integration tests.
- If promoting, calculate the runtime fingerprint from the declared runtime files.
- Update `mwPrManifest.js`, the gitlink, documentation, and integrity tests together.
- Verify MW TSS and TI flows, duplicate handling, unmatched sites, warnings, review-required output, and ZIP contents.

Acceptance:

- `assertPlatformEngineIntegrity()` passes from a clean checkout.
- The server starts with all three expected engines available.
- Business output is reviewed, not merely hash-matched.

### Workstream B — Deployment and Persistence Alignment

Scope:

- Validate Windows paths for every worker engine and workspace.
- Harden Firebase configuration, authentication, isolation, backup, and recovery behavior.
- Remove unused services and compatibility aliases where safe.
- Pass required persistence settings explicitly.
- Add Windows service health checks and startup dependency behavior.
- Remove default production credentials.

Acceptance:

- A clean Windows deployment starts and passes `/health` without relying on a hard-coded external database URL.
- MW, RAN, and PR Auditor execution resolve the configured local engine paths.

### Workstream C — Queue Recovery and Lifecycle

Scope:

- Define persisted queue ownership and interrupted-job behavior.
- Reconcile `queued`, active, cancelling, and exporting jobs at startup.
- Make enqueue/cancel/rerun idempotent across restart boundaries.
- Ensure worker child processes are terminated cleanly on shutdown.
- Preserve WebSocket recovery through persisted job events.

Acceptance:

- Restart tests cover queued and active jobs.
- No job remains permanently active without an owning runtime.
- Reconciliation emits an auditable status event and safe user-facing explanation.

### Workstream D — Output and Storage Reliability

Scope:

- Handle both archive and output stream errors during ZIP creation.
- Write ZIPs to a temporary file and atomically publish completed packages.
- Prevent cleanup from deleting a workspace while packaging is active.
- Validate file existence before registering downloadable metadata.
- Make integration cleanup wait for all worker and stream handles.

Acceptance:

- Missing directories, disk errors, cancellation, and cleanup races do not crash Node.
- Failed packages are not exposed as downloadable files.
- Integration tests leave no tracked or runtime residue.

### Workstream E — Test and CI Gate

Scope:

- Make backend tests default to mock Firebase unless explicitly marked live.
- Include all PR Auditor and RAN regression scripts in the main gate.
- Fix incomplete module stubs and Node 24 shutdown behavior.
- Give each test run a unique storage root and job namespace.
- Install frontend dependencies with `npm ci`, then run unit, build, and route smoke tests.
- Add CI for backend, frontend, and engine integrity.

Acceptance:

- One documented command runs the complete hermetic suite.
- Live Firebase and golden worker tests are separate, explicit gates.
- CI runs from a clean checkout and publishes actionable failure output.

### Workstream F — Security and Maintainability

Scope:

- Fail startup when production admin credentials or JWT secrets are absent/unsafe.
- Restrict CORS and define authentication for job APIs.
- Add upload content/type checks, rate limits, and memory constraints.
- Redact external database errors and sensitive details.
- Decompose `jobService.js`, `PRCreatorView.vue`, and `workerRuntime.js` by worker and lifecycle responsibility.

Acceptance:

- Known default secrets cannot start a production deployment.
- Upload and job endpoints match the agreed trust boundary.
- Refactoring preserves route contracts and existing test behavior.

## Dependency Order

```text
D1 engine decision
    -> A engine baseline
    -> E complete regression gate

D2 + D4 deployment decisions
    -> B deployment/persistence
    -> E deployment and integration gates

D3 restart decision
    -> C queue recovery
    -> D cleanup/package coordination

D5 access decision
    -> F security hardening
```

## Key Files

- `backend/src/server.js` — startup and integrity gate
- `backend/src/config/env.js` — runtime paths and configuration
- `backend/src/workers/workerRegistry.js` — worker registration
- `backend/src/workers/manifests/` — approved engine contracts
- `backend/src/workers/adapters/` — platform-to-worker execution boundary
- `backend/src/services/jobService.js` — job API orchestration
- `backend/src/queue/jobQueue.js` — in-memory queue
- `backend/src/services/outputCollector.js` — output discovery, reports, and ZIPs
- `backend/src/db/firebaseClient.js` — persistence transport
- `frontend/src/views/shared/workerRuntime.js` — shared browser job lifecycle
- `.env.example` — supported runtime configuration contract
- `backend/package.json` — incomplete default backend test gate

## Verification Commands

Use Windows executable shims in PowerShell because `npm.ps1` may be blocked by execution policy.

```powershell
git status --short --branch
git submodule status
$env:FIREBASE_DB_MOCK='true'
npm.cmd --prefix backend test
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend test
```

Do not claim a complete pass while engine integrity is unresolved or while the omitted suites remain outside the default gate.

## Required Completion Report

For every implemented workstream, report:

- Decision and scope implemented
- Files changed
- Tests run and exact results
- Remaining risks or skipped live tests
- Repository and submodule status
- Migration, rollback, or deployment instructions where applicable
