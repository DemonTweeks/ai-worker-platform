# Issue 84 Dashboard UI Polish Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the valid PR #87 frontend polish on current main while preserving Status navigation and Issue #88 reconciliation behavior.

**Architecture:** Use current `main` as the authoritative baseline. Replay non-conflicting PR #87 files directly; for overlapping files, apply only the timestamp/test deltas. Merge sticky-header behavior into the current App shell without removing selected-job Status navigation.

**Tech Stack:** Vue 2, Vue Router, Vitest, Vue Test Utils, Vite, GitHub Actions.

## Global Constraints

- Preserve platform-global Health / Dashboard / Status / History / Admin navigation.
- Preserve same-tab `selectedJobId` behavior and `awp:selected-job-changed` event handling.
- Preserve current-main Issue #88 reconciliation UI.
- Preserve Active Jobs no-horizontal-scroll behavior; content, including timestamps, must wrap safely within fixed-width cards when needed.
- No worker business-rule changes.
- Browser-local timestamp formatting must use shared formatter utilities.

---

### Task 1: Rebuild App shell and navigation tests

**Files:** `frontend/src/App.vue`, `frontend/src/__tests__/App.spec.js`, `frontend/src/__tests__/AppNavigation.spec.js`, `frontend/src/styles.css`

- [ ] Add sticky-header scroll/focus behavior while retaining Status navigation and selected-job synchronization.
- [ ] Keep navigation tests asserting Status remains global and same-tab selected-job behavior works.
- [ ] Keep sticky-header regression coverage.

### Task 2: Replay dashboard and date formatting polish

**Files:** `frontend/src/views/DashboardView.vue`, `frontend/src/views/__tests__/DashboardView.spec.js`, `frontend/src/utils/formatUtils.js`, `frontend/src/utils/__tests__/formatUtils.spec.js`, `frontend/src/components/detail/__tests__/JobDetailMetadata.spec.js`, `frontend/src/views/PRAuditorView.vue`, `frontend/src/active-jobs-no-scroll.css`

- [ ] Replay PR #87 changes onto current main.
- [ ] Preserve responsive Active Jobs layout with no horizontal scrolling; keep timestamps compact but allow safe wrapping in narrow fixed columns.

### Task 3: Apply minimal timestamp/test deltas to files changed by PR #89

**Files:** `frontend/src/views/PRCreatorView.vue`, `frontend/src/views/shared/workerRuntime.js`, `frontend/src/views/admin/AdminHealthView.vue`, `frontend/src/views/__tests__/AdminHealthView.spec.js`, `frontend/src/views/__tests__/PRCreatorRanRetention.spec.js`, `frontend/src/views/__tests__/PRCreatorView.spec.js`

- [ ] Start from current-main content.
- [ ] Apply only formatter imports/usages, ISO console timestamp generation, and local `flushPromises` helpers from PR #87.
- [ ] Verify Issue #88 reconciliation presentation remains present.

### Task 4: Validate and merge replacement

- [ ] Run frontend unit tests.
- [ ] Run production build and route smoke.
- [ ] Run `git diff --check`.
- [ ] Review changed files against PR #87 and current main.
- [ ] Open replacement PR linked to Issue #84 and explain supersession of #87.
- [ ] Require no unresolved actionable review blocker and a mergeable head before squash merge.
- [ ] Close PR #87 as superseded after replacement merges.
