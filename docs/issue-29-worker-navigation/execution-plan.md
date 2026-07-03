# Issue 29 Worker Navigation Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for bounded inline execution. This file tracks the autonomous bounded-step sequence in `- [ ]` form.

**Goal:** Make PR Creator and PR Auditor independent top-level worker routes with route-driven navigation and dedicated pages, while preserving MW PR and RAN PR as internal PR Creator modes.

**Architecture:** Split the current route-agnostic worker selector out of `HomeView.vue` into route-owned worker pages. Add a centralized worker navigation registry plus a header `WorkerNavigation` component so the route, active state, refresh behavior, and future worker expansion all come from router-aware metadata instead of local button state.

**Tech Stack:** Vue 2, Vue Router 3, Vite, Vitest.

---

## Current Route Model

- `/` currently renders `HomeView.vue`.
- `HomeView.vue` currently owns one combined launch surface for MW PR, RAN PR, and PR Auditor.
- `App.vue` currently exposes only global navigation (`Dashboard`, `Status`, `History`, `Admin`) plus a health indicator.
- `frontend/src/router.js` currently has no dedicated worker routes.
- `frontend/src/views/__tests__/HomeView.spec.js` currently verifies combined worker behavior inside the monolithic `HomeView`.

## Route Migration Decision

Decision: treat `/workers/pr-creator` and `/workers/pr-auditor` as the authoritative worker-entry routes, and convert `/` into a compatibility redirect to `/workers/pr-creator`.

Rationale:

1. This preserves an existing valid launch entry point without leaving duplicate worker forms on both Dashboard and the new worker routes.
2. It keeps the route, not local component state, as the source of truth for which top-level worker page is active.
3. It minimizes scope by preserving the rest of the platform routes unchanged while giving future workers one obvious registration path.

Constraints:

- No worker launch form should remain on a separate dashboard route after the redirect is in place.
- PR Creator remains the owner of MW PR and RAN PR internal mode switching only.
- PR Auditor must render from its own page and must not expose PR Creator controls or wording.

## Bounded Steps

- [x] Step 1: Fetch `origin`, verify `feature/pr-auditor-platform-integration`, record the source SHA, create `C:\dev\ai-worker-platform-worker-navigation`, and confirm the clean feature branch baseline.
- [x] Step 2: Copy the Master Prompt into the repo docs, create the persistent mission state bundle, inspect router/app/home/tests/scripts, and document the route migration decision.
- [x] Step 3: Run baseline frontend tests before implementation, record the results, and create the documentation baseline checkpoint.
- [x] Step 4: Add a failing test suite for worker routes and header worker navigation behavior.
- [x] Step 5: Implement the worker navigation registry, header worker navigation, dedicated worker routes, and compatibility redirect with minimal shared-shell changes.
- [x] Step 6: Extract route-owned `PRCreatorView` and `PRAuditorView` pages, remove the cross-worker selector, and keep MW/RAN as internal PR Creator modes only.
- [x] Step 7: Update route, app-shell, and worker-page tests until they pass green, then run the frontend unit suite.
- [x] Step 8: Run build, smoke test, browser UAT, diff checks, and changed-file review; update mission logs and prepare the Draft PR.
