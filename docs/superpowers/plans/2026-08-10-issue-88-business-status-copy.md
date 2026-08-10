# Issue #88 Business Status Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present reconciliation-integrity failures as `Incomplete Result` and replace technical `Unaccounted` wording with `Sites Without Confirmed Result` across Issue #88 user surfaces.

**Architecture:** Keep backend lifecycle/error code/data fields unchanged. Add a frontend job-aware display helper that maps only `failed + RESULT_RECONCILIATION_INCOMPLETE` to the business-facing label `Incomplete Result`; all other statuses retain existing labels. Update reconciliation copy on History, Job Detail, and PR Creator Result Delivery.

**Tech Stack:** Vue 2.7, Vitest, existing frontend status utilities/components.

## Global Constraints

- Keep `RESULT_RECONCILIATION_INCOMPLETE` unchanged internally.
- Keep `unaccountedSiteCount` unchanged internally.
- Do not change backend reconciliation arithmetic.
- Do not change PR Auditor presentation.
- Generic failures must continue to display `Failed`.

---

### Task 1: Add job-aware business status display

**Files:**
- Modify: `frontend/src/utils/jobStatusUtils.js`
- Modify: `frontend/src/components/history/JobStatusBadge.vue`
- Test: `frontend/src/components/__tests__/resultReconciliation.spec.js`

- [ ] Add failing assertions that a reconciliation-integrity failure displays `Incomplete Result` while an ordinary failed job remains `Failed`.
- [ ] Add a job-aware status label helper based on `job.status` and `job.error.code`.
- [ ] Pass the job/error context into the history badge without changing ordinary status behavior.
- [ ] Run the targeted frontend test.

### Task 2: Replace technical reconciliation wording

**Files:**
- Modify: `frontend/src/components/detail/JobDetailSummary.vue`
- Modify: `frontend/src/components/history/JobHistoryCard.vue`
- Modify: `frontend/src/views/PRCreatorView.vue`
- Test: `frontend/src/components/__tests__/resultReconciliation.spec.js`
- Test: `frontend/src/views/__tests__/PRCreatorResultReconciliation.spec.js`

- [ ] Change `Unaccounted Sites`/`Unaccounted` labels to `Sites Without Confirmed Result`.
- [ ] Change incomplete-result explanation to `X of Y requested sites generated. Z sites have no confirmed result.`
- [ ] Ensure reconciled warning copy remains distinct from incomplete-result copy.
- [ ] Run targeted frontend tests and build when repository execution is available.

### Task 3: Review PR #89 wording consistency

**Files:**
- Review all changed frontend files in PR #89.

- [ ] Confirm no user-facing `Unaccounted` remains on Issue #88 surfaces.
- [ ] Confirm `Incomplete Result` appears only for reconciliation-integrity failures.
- [ ] Confirm internal backend names remain untouched.
- [ ] Update PR #89 description with the business-facing naming decision.
