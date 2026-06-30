# Decision Log

## 2026-06-30 - Phase 0 baseline

- The current implementation treats browser-session scope as a duplicate-prevention boundary through `submissionScopeId`.
- The queue implementation already supports global FIFO concurrency using `MAX_CONCURRENT_JOBS`; the redesign should preserve that instead of introducing per-session serialization.
- The frontend currently restores only one job per worker and uses that single restored job to lock the workbench.
- PR #20 review comments are cleared for the prior same-scope reservation model, but the new mission supersedes that model and requires multi-job support from the same browser session.
- The latest remote branch head introduced only `docs/.keep`; remove it from the branch so it does not remain in the final PR diff.

## 2026-06-30 - Final redesign decisions

- `browserTabSessionId` replaces `submissionScopeId`/`browserSessionId` terminology and is generated once per browser tab, stored in `sessionStorage`, and used only for same-tab active-job grouping and restoration.
- `idempotencyKey` is the only duplicate boundary, keyed by `workerId + idempotencyKey`.
- Repeated create requests with the same idempotency key return the same persisted Job safely instead of `409 ACTIVE_JOB_EXISTS`.
- Global queue concurrency remains controlled only by `MAX_CONCURRENT_JOBS`; unrelated jobs from the same tab or worker continue independently.
- Prevalidation is never blocked by another active job.
- The frontend keeps worker forms available while showing a shared Active Jobs workbench for the current `browserTabSessionId`.
- Cancellation resolves orphaned non-terminal persisted jobs to a safe terminal state when no live runtime ownership remains.
- Cross-tab active-job aggregation remains explicitly out of scope for PR #20 until authenticated user or workspace identity exists.

## 2026-06-30 - Stale worker-state cancellation follow-up

- The cancellation path must not treat orphaned `workerState` presence as proof that a job is still runtime-owned.
- Queue ownership is the only authority for whether a persisted non-terminal job should move into `cancelling`; stale `workerState` without queue ownership must resolve through orphan recovery instead.
- Regression coverage now includes a persisted `generating` job with stale `workerState` and no queue ownership, and the expected terminal outcome is immediate `cancelled` with cancellation-completed audit state.
