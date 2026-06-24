# AI Worker Runtime Error Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the worker Python runtime contract, fail fast on missing worker dependencies, surface actionable failure context directly in the product UI, and preserve existing PR Worker and Re-Ask behavior.

**Architecture:** Keep the business script untouched and move the runtime contract into the backend orchestration layer. Extend existing job error payloads with bounded structured fields, then render those fields through the current detail/history UI and the home view timeout banner without redesigning the workbench.

**Tech Stack:** Node.js, Express, Vue 2, Vite, Firebase-backed model compatibility layer, PowerShell, git worktree, project-local Python `.venv`

---

## Baseline File Map

- Modify: `backend/src/services/childProcessRunner.js`
- Modify: `backend/src/config/env.js`
- Modify: `backend/src/services/prWorkerService.js` only if the new runtime/preflight payload needs orchestration wiring
- Modify: `backend/scripts/integration-test.js`
- Modify: `backend/scripts/smoke-test.js` if shared config/runtime helpers need coverage at load time
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/components/detail/JobDetailSummary.vue`
- Modify: `frontend/src/components/history/JobHistoryCard.vue`
- Modify: `frontend/src/views/JobDetailView.vue` or add a focused detail component if the current summary block gets too crowded
- Modify: `frontend/src/api.js` only if timeout handling needs a reusable signal path
- Modify: `README.md`
- Modify: `.env.example`
- Create: `requirements-worker.txt`

## Task 1: Lock The Worker Runtime Contract In Tests

**Files:**
- Modify: `backend/scripts/integration-test.js`
- Modify: `backend/scripts/smoke-test.js` only if helper exports need a lightweight contract assertion

- [ ] Step 1: Add focused failing coverage for Python executable selection priority.
- [ ] Step 2: Add focused failing coverage for dependency preflight success and per-package failure.
- [ ] Step 3: Add a failing assertion that a preflight failure happens before the business script runs.
- [ ] Step 4: Add a failing assertion that the stored error includes a stable code, missing package list, recommended fix command, requested interpreter command, and actual interpreter path when available.
- [ ] Step 5: Run `npm --prefix backend test` and capture the initial failing evidence in `docs/ai-worker-runtime-error-visibility/verification-log.md`.

## Task 2: Implement Deterministic Python Resolution And Structured Preflight

**Files:**
- Modify: `backend/src/services/childProcessRunner.js`
- Modify: `backend/src/config/env.js`
- Modify: `backend/src/services/prWorkerService.js` only if runtime metadata must be passed through a higher layer

- [ ] Step 1: Introduce a resolver that checks `PYTHON_EXECUTABLE`, then repo-root `.venv`, then platform fallback command.
- [ ] Step 2: Add a lightweight probe that records both the candidate command/path and the actual interpreter path reported by the child process where available.
- [ ] Step 3: Add a dependency preflight using the same resolved runtime for exactly `pandas` and `openpyxl`.
- [ ] Step 4: Return a bounded structured dependency error that blocks business-script execution and includes safe remediation details.
- [ ] Step 5: Re-run `npm --prefix backend test` until the new runtime coverage passes.

## Task 3: Document And Verify The Local Worker Environment

**Files:**
- Create: `requirements-worker.txt`
- Modify: `README.md`
- Modify: `.env.example`

- [ ] Step 1: Add `requirements-worker.txt` with `pandas` and `openpyxl`.
- [ ] Step 2: Document the project-local `.venv` install and verification flow in `README.md`.
- [ ] Step 3: Document intentionally blank `PYTHON_EXECUTABLE=` in `.env.example`.
- [ ] Step 4: Create the feature-worktree `.venv`, install `requirements-worker.txt`, and verify imports with the explicit interpreter path.

## Task 4: Surface Root Cause Directly In Job Detail And History

**Files:**
- Modify: `frontend/src/components/detail/JobDetailSummary.vue`
- Modify: `frontend/src/components/history/JobHistoryCard.vue`
- Modify: `frontend/src/views/JobDetailView.vue` or a new focused detail component if needed

- [ ] Step 1: Add a compact failure summary for missing dependencies with root cause, package names, resolved interpreter, and safe repair command.
- [ ] Step 2: Keep technical diagnostics bounded and separated from the primary user-facing message.
- [ ] Step 3: Preserve successful job rendering and Re-Ask entry points.
- [ ] Step 4: Verify the UI route/build path with `npm --prefix frontend test`.

## Task 5: Correct The Timeout Banner UX

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/api.js` only if the timeout condition needs a shared discriminator
- Modify: any small supporting component only if the existing `ErrorBanner` cannot support the required behavior cleanly

- [ ] Step 1: Wire the request-timeout path to the required user-facing copy.
- [ ] Step 2: Reduce auto-dismiss timing to a safe 7-second path while preserving manual dismissal.
- [ ] Step 3: Confirm timeout messaging does not mark a job failed merely because the client request timed out.
- [ ] Step 4: Re-run `npm --prefix frontend test`.

## Task 6: Full Verification, Checkpointing, And Delivery

**Files:**
- Modify: `docs/ai-worker-runtime-error-visibility/verification-log.md`
- Modify: `docs/ai-worker-runtime-error-visibility/final-report.md`
- Modify: `docs/ai-worker-runtime-error-visibility/autonomous-run-state.json`
- Modify: `docs/ai-worker-runtime-error-visibility/autonomous-run-state.md`
- Create: `docs/ai-worker-runtime-error-visibility/COMPLETED` only after all gates pass

- [ ] Step 1: Run `npm --prefix backend test`.
- [ ] Step 2: Run `npm --prefix frontend test`.
- [ ] Step 3: Run the explicit `.venv` worker dependency verification commands.
- [ ] Step 4: Run final repo diff and submodule checks from the feature worktree.
- [ ] Step 5: Perform self-review, update final state, push the branch, and create the draft PR only if all master-prompt delivery gates pass.
