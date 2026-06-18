# AI Worker Style Refresh Revision 2 Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the homepage into a Productized Workbench while preserving the real PR Creator workflow.

**Architecture:** Keep the implementation scoped to `HomeView.vue` and `styles.css`. Restructure the homepage template into product hero, primary workbench, support/status, chat, and console regions while leaving data flow, API calls, routes, and business logic unchanged.

**Tech Stack:** Vue single-file components, existing frontend CSS, existing npm and Python test suites.

---

## Task 1: Capture Baseline Evidence

**Files:**
- Create screenshots under `docs/ai-worker-style-refresh/revision-2/browser-evidence`
- Modify: `docs/ai-worker-style-refresh/revision-2/verification-log.md`

- [ ] Start the local app if it is not already running.
- [ ] Capture desktop homepage before screenshot.
- [ ] Record screenshot path in `verification-log.md` and `autonomous-run-state.json`.

## Task 2: Restructure HomeView Into Productized Workbench

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/styles.css`

- [ ] Replace the four equal-card first screen with a hero/workbench layout.
- [ ] Preserve all existing bindings, methods, computed values, and event handlers.
- [ ] Keep upload, validation, scope, site code, and create job controls above the fold.
- [ ] Move download/result status into a supporting workbench panel.
- [ ] Keep AI Chatbox and Worker Console visible as operational sections.

## Task 3: Responsive and Visual Polish

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] Add spacious desktop layout rules for the Productized Workbench.
- [ ] Add mobile rules that stack panels without text overlap.
- [ ] Avoid one-note palette and keep ZTE blue as identity accent rather than the only visual theme.
- [ ] Remove homepage viewport locking if it prevents responsive page flow.

## Task 4: Verification and Evidence

**Files:**
- Modify: `docs/ai-worker-style-refresh/revision-2/verification-log.md`
- Modify: `docs/ai-worker-style-refresh/revision-2/before-after-screenshots.md`
- Modify: `docs/ai-worker-style-refresh/revision-2/autonomous-run-state.json`

- [ ] Run `npm --prefix frontend test`.
- [ ] Run backend tests with `C:\dev\ai-worker-platform.venv\Scripts\python.exe`.
- [ ] Browser-check `/`, `/history`, `/jobs/QA15-ROUTE-SMOKE`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, and `/admin/health`.
- [ ] Capture desktop after, mobile after, and operational section screenshots.
- [ ] Set `acceptance_status` to `pending_human_visual_review` only after verification and screenshot evidence are ready.

## Task 5: Git Checkpoint

**Files:**
- All intended Revision 2 changes.

- [ ] Check changed file scope.
- [ ] Confirm backend and submodules are unchanged.
- [ ] Confirm no secrets, runtime files, generated caches, `node_modules`, `dist`, or `.env` files are staged.
- [ ] Commit a checkpoint after intended changes are verified.
