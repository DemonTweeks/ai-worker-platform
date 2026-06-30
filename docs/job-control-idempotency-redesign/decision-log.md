# Decision Log

## 2026-06-30 - Phase 0 baseline

- The current implementation treats browser-session scope as a duplicate-prevention boundary through `submissionScopeId`.
- The queue implementation already supports global FIFO concurrency using `MAX_CONCURRENT_JOBS`; the redesign should preserve that instead of introducing per-session serialization.
- The frontend currently restores only one job per worker and uses that single restored job to lock the workbench.
- PR #20 review comments are cleared for the prior same-scope reservation model, but the new mission supersedes that model and requires multi-job support from the same browser session.
- The latest remote branch head introduced only `docs/.keep`; remove it from the branch so it does not remain in the final PR diff.

## Pending design decisions

- Final backend reservation shape for `workerId + idempotencyKey`.
- Safe API shape for current-session job restoration and selected-job switching.
- Orphaned persisted non-terminal job resolution path after runtime restart.
