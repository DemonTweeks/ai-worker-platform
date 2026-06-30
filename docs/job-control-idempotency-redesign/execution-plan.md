# PR #20 Job Queue Redesign Execution Plan

## Mission

Correct PR #20 from one-active-job-per-worker/browser-session behavior to idempotent submission plus global queue concurrency plus visible multi-job tracking.

## Constraints

- Keep `MAX_CONCURRENT_JOBS` as the only global capacity control.
- Duplicate detection must use `workerId + idempotencyKey`.
- `browserTabSessionId` is same-tab grouping/restoration metadata only.
- Do not merge, deploy, close #13, or close #16.
- Do not modify worker-engine logic outside queue-control integration needs.

## Phase Plan

1. Inspect the existing queue, job creation, restore, cancellation, and review context.
2. Redesign backend create/list/cancel behavior around idempotency keys and orphan recovery.
3. Redesign frontend session state around multi-job restoration and selected-job tracking.
4. Replace or extend backend and frontend tests for concurrency, duplicate replay, visibility, and cancellation.
5. Run the requested validation commands and browser UAT evidence before PR handoff.

## Immediate Findings

- Current duplicate protection is keyed by `submissionScopeId`, not request idempotency.
- `/api/jobs/prevalidate` blocks validation when any active scoped job exists.
- The queue already enforces global concurrency via `MAX_CONCURRENT_JOBS`.
- The Home view remembers one job per worker and locks the worker form while it is active.
- Latest remote branch head only added accidental `docs/.keep`, which must be removed.

## Current checkpoint

- The stale worker-state cancellation concern was confirmed and fixed: persisted non-terminal jobs now enter `cancelling` only when queue runtime ownership is present.
- Browser UAT has now confirmed same-tab active-job restoration and independent cross-tab active-job visibility by `browserTabSessionId`.
- The same UAT pass revealed and resolved a selected-job persistence leak: the Status route is now same-tab only instead of falling back to cross-tab `localStorage`.
- Controlled live UAT has now covered duplicate replay, MW+RAN coexistence under queue concurrency, queued cancellation, running cancellation with partial result, partial ZIP warning copy, and unchanged normal ZIP behavior.
- Completion audit passed against the Master Prompt acceptance gates, and the repository is now in `NO_OP_COMPLETED` state pending human review of Draft PR #20.
