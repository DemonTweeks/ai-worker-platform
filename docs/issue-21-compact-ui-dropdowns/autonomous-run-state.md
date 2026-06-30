# Issue #21 Autonomous Run State

- Status: `active`
- Completed: `false`
- Acceptance status: `pending`
- Baseline: `e2365800ec5a45638bc6d92ba15893b8e23c367d`
- Branch: `fix/compact-ui-dropdowns`
- Worktree: `C:\dev\ai-worker-platform-dropdowns`
- Goal: complete the compact dropdown UI fix for Issue #21 only
- Next action: `RUN_FULL_FRONTEND_VALIDATION_AND_UAT`

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
