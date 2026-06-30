# PR #20 Job Control Reliability Final Report

## Outcome

PR #20 now satisfies the mission objective:

`idempotent submission + global queue concurrency + visible multi-job tracking + safe cancellation and orphan recovery`

The branch remains Draft and was not merged or deployed.

## Requirement Audit

### Product decisions

- `browserTabSessionId` is generated per tab, stored in `sessionStorage`, used for same-tab Active Jobs restore only, and is not used as a duplicate boundary.
  Evidence:
  - `frontend/src/views/HomeView.vue`
  - browser UAT in `validation-log.md`
- Duplicate protection uses only `workerId + idempotencyKey`.
  Evidence:
  - backend create flow and concurrency/idempotency tests
  - live replay evidence for `PR-20260630-007`
- `MAX_CONCURRENT_JOBS` remains the only queue-wide capacity control.
  Evidence:
  - queue health during live UAT showed 2 active + 1 queued under `MAX_CONCURRENT_JOBS = 2`
- Active Jobs remain visible, selectable, trackable, and cancellable without blocking creation of additional legitimate jobs.
  Evidence:
  - same-tab restoration UAT
  - live mixed MW/RAN UAT
- Queue ownership is authoritative for cancellation; stale `workerState` does not keep orphaned jobs stuck.
  Evidence:
  - stale worker-state reproduction and regression coverage

### Automated verification

All required commands passed and are recorded in `validation-log.md`:

- `npm.cmd --prefix backend test`
- `npm.cmd --prefix frontend test`
- `npm.cmd --prefix frontend run build`
- `npm.cmd --prefix backend run test:job-control-concurrency`
- `npm.cmd --prefix backend run test:job-prevalidate-guard`
- `npm.cmd --prefix backend run test:job-service-workers`
- `npm.cmd --prefix backend run test:ran-worker-service`
- `npm.cmd --prefix backend run test:ran-live-runtime`
- `git diff --check`

### Browser UAT acceptance gates

1. RAN Job A plus RAN Job B from the same tab:
   Passed through controlled live same-tab UAT bound to one real `browserTabSessionId`.
2. Both appear in Active Jobs:
   Passed.
3. Same idempotency key replays to the same Job:
   Passed for MW `PR-20260630-007`.
4. MW and RAN can run/queue together:
   Passed.
5. Refresh restores multiple active tab jobs:
   Passed.
6. Cancel a queued Job:
   Passed for `PR-20260630-010`.
7. Cancel a running Job:
   Passed for `PR-20260630-009`.
8. Orphaned persisted non-terminal recovery:
   Passed through controlled backend reproduction and regression test.
9. Partial cancelled ZIP wording:
   Passed.
10. Normal completed ZIP behavior unchanged:
   Passed.
11. RAN semantic BOM and ECC protections remain intact:
   Passed through the existing backend verification suite, including `test:ran-live-runtime` and `test:ran-worker-service`.

## Final State

- Branch: `fix/job-control-duplicate-guard-and-cancellation`
- Draft PR: `#20`
- Worktree: clean
- Runtime directory `storage/ran-workspaces/`: untouched and ignored
- Completion marker: present

## Notes

- Cross-tab active-job aggregation remains intentionally out of scope until authenticated user/workspace identity exists.
- Future heartbeat runs should perform read-only `NO_OP_COMPLETED`.
