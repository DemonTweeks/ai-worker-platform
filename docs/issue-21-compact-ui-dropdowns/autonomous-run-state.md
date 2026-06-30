# Issue #21 Autonomous Run State

- Status: `blocked`
- Completed: `false`
- Acceptance status: `pending`
- Baseline: `e2365800ec5a45638bc6d92ba15893b8e23c367d`
- Branch: `fix/compact-ui-dropdowns`
- Worktree: `C:\dev\ai-worker-platform-dropdowns`
- Goal: complete the compact dropdown UI fix for Issue #21 only
- Next action: `BLOCKED_ACTIVE_JOB_UAT_ENVIRONMENT`

## Precondition

PR #22 was verified on `origin/main` before Issue #21 work began.

- `git log -1 --oneline` on refreshed `main` returned `e236580 feat(llm): add Agnes provider and reliable Re-Ask composer (#22)`.
- `git log origin/main --oneline --grep="Agnes provider" -20` returned the same merge commit.
- `gh pr view 22` confirmed `MERGED` into `main` with merge commit `e2365800ec5a45638bc6d92ba15893b8e23c367d`.

## Current Discovery

- `frontend/src/views/HomeView.vue:167-182` contains the RAN General Item project selector.
- `frontend/src/views/HomeView.vue:323-336` contains the Stop Job cancellation-reason selector.
- Both controls currently share `cockpit-sites-input`, which is used broadly and does not yet add compact select-specific overflow handling.
- Nearby compact visual patterns already exist through `cockpit-field-group` and `compact-segmented`.

## Bounded Step Completed

`initialize_mission_and_capture_dropdown_discovery`

- Verified the PR #22 precondition.
- Created the `fix/compact-ui-dropdowns` worktree from `origin/main`.
- Created persistent mission files.
- Captured the first implementation hypothesis and test targets without editing frontend code yet.

`implement_compact_dropdown_hook_and_styles`

- Added `compact-inline-select` to the two Issue #21 dropdowns in `frontend/src/views/HomeView.vue`.
- Added focused compact select styling in `frontend/src/styles.css` to reduce height, cap width, and prevent selected-text overflow from expanding the layout.
- Added and verified a focused regression test in `frontend/src/views/__tests__/HomeView.spec.js`.
- Verified `vitest run src/views/__tests__/HomeView.spec.js` passes in the feature worktree.

`run_full_validation_and_partial_browser_uat`

- Verified `npm.cmd test` and `npm.cmd run build` pass in `frontend/`.
- Verified `git diff --check` passes and the changed-file scope remains limited to `frontend/` plus the mission docs.
- Verified the current worktree frontend and backend load successfully on `localhost:3000` and `localhost:8000`.
- Verified in-browser that the project selector renders with the compact class, `13px` font size, `36px` minimum height behavior, and no page-level horizontal overflow.
- Verified MW and RAN Job Detail routes load without overlays or console warnings/errors.
- Could not complete full live UAT for the project-selector long-value path or the real cancellation selector because the RAN project catalog endpoint currently fails with `RAN_PROJECT_WORKBOOK_MISSING` and no active job in the current browser-tab session exposed the Stop Job form.

`attempt_live_job_creation_and_browser_session_binding`

- Attempted to create or attach to a real current-session job so the live Stop Job form could be exercised in-browser.
- Confirmed the browser automation sandbox does not expose `sessionStorage`, `File`, `Blob`, `DataTransfer`, or Vue app handles needed to bind that runtime state from automation alone.
- The remaining external blocker is that the real cancellation selector is unavailable without an active current-session job.

`recover_ran_catalog_environment_and_reclassify_blocker`

- Classified the reported RAN selector outage as an environment issue caused by an uninitialized submodule checkout rather than a frontend regression.
- Ran the one allowed recovery command, `git submodule update --init --recursive`, which restored `skills/create-pr-cd-ran` and repopulated its required workbook files.
- Verified `GET /api/jobs/ran-projects` now returns HTTP `200` with the real project list, so the live RAN selector data path is restored without any source-code changes.
- The remaining blocked acceptance gate is the real current-session Stop Job cancellation selector, because no cancellable active job is exposed in the active browser-tab session and supported automation still cannot bind one through storage or file APIs.
