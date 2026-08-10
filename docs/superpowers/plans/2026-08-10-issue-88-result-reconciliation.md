# Issue 88 Result Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent AI Worker Platform from presenting clean `COMPLETED` when a worker result is only partially reconciled against explicitly requested sites.

**Architecture:** Add a generic reconciliation contract at the platform boundary, persist it on `Job`, and make terminal-status evaluation consume that contract. MW-specific SOW logic remains in `create-pr-cd`; the platform only interprets generic business dispositions and renders consistent counts/status across History and Job Detail.

**Tech Stack:** Node.js 20+, Firebase-compatible model layer, Express backend, Vue frontend, existing Node script tests.

## Global Constraints

- Do not hard-code `Decom - Relo` or production site IDs in platform logic.
- Preserve existing MW, RAN PR, and PR Auditor lifecycle behavior.
- Keep existing status `completed_with_warning` rather than introducing a new enum unless strictly necessary.
- Clean `completed` requires `unaccountedCount === 0` when reconciliation data is available.
- Backward-compatible jobs without reconciliation metadata must continue to load.

---

### Task 1: Lock terminal status policy with a failing regression test

**Files:**
- Create: `backend/scripts/result-reconciliation-test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `determineFinalStatus(summary)` from `zeroOutputPolicyService`.
- Produces: regression expectations for reconciled success, review-required partial completion, and unreconciled partial result.

- [ ] Write tests for: fully reconciled result -> `completed`; review-required partial result -> `completed_with_warning`; `unaccountedCount > 0` -> reject clean completion with `RESULT_RECONCILIATION_INCOMPLETE`.
- [ ] Run the test and confirm the current implementation fails the new cases.
- [ ] Add the test script to backend package scripts.

### Task 2: Implement generic reconciliation normalization and status policy

**Files:**
- Create: `backend/src/services/resultReconciliationService.js`
- Modify: `backend/src/services/zeroOutputPolicyService.js`
- Modify: `backend/src/models/Job.js`

**Interfaces:**
- Produces `normalizeReconciliation(summary)` with counts: requested, generated, reviewRequired, approvedIgnored, duplicateBlocked, failed, unaccounted, accounted.
- `determineFinalStatus(summary)` consumes normalized reconciliation.

- [ ] Implement non-negative integer normalization and computed `accountedCount`/`unaccountedCount` when sufficient data exists.
- [ ] Preserve legacy zero-output behavior when reconciliation is absent.
- [ ] Return `completed_with_warning` for reconciled review/ignored/duplicate/failed dispositions with zero unaccounted.
- [ ] Throw `RESULT_RECONCILIATION_INCOMPLETE` when reconciliation reports unaccounted requested work.
- [ ] Persist reconciliation fields on Job with backward-compatible defaults.
- [ ] Run the regression test until green.

### Task 3: Persist and summarize reconciliation for MW jobs

**Files:**
- Modify: `backend/src/services/summaryBuilder.js`
- Modify: `backend/src/services/finalSummaryService.js`
- Modify: `backend/src/services/prWorkerService.js`

**Interfaces:**
- `buildAndSaveSummary` accepts optional worker reconciliation evidence and persists normalized counts.
- Final summary exposes requested/generated/review/ignored/duplicate/failed/unaccounted counts when available.

- [ ] Extend summary persistence with reconciliation fields without inferring generated site count from output file count.
- [ ] Pass structured reconciliation from the worker boundary when available; preserve legacy behavior otherwise.
- [ ] Make final summary wording explicit for partial/review/reconciliation states.
- [ ] Run backend regression and integration tests.

### Task 4: Render reconciliation consistently

**Files:**
- Modify: `frontend/src/components/history/JobHistoryCard.vue`
- Modify: `frontend/src/components/detail/JobDetailSummary.vue`
- Test: existing frontend component/view tests or focused new tests where appropriate.

**Interfaces:**
- Consumes persisted job reconciliation fields.
- Displays generated/accounted/unaccounted counts and a warning notice when business completion is not clean.

- [ ] Add generated/accounted/unaccounted metadata when reconciliation is available.
- [ ] Add visible reconciliation notice for partial/review results.
- [ ] Keep PR Auditor-specific presentation unchanged.
- [ ] Run frontend tests/build.

### Task 5: Verification and PR

**Files:**
- No production files beyond prior tasks.

- [ ] Run targeted backend reconciliation test.
- [ ] Run backend integration and worker compatibility tests.
- [ ] Run frontend tests/build.
- [ ] Review diff for worker-specific hard-coding and accidental lifecycle drift.
- [ ] Open PR against `main` with `Fixes #88` and link `Gumb-D/create-pr-cd#74` as the cross-repository dependency.
