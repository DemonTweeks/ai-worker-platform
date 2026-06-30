# Decision Log

## 2026-06-30

- Read the Master Prompt from `C:\dev\codex-prompts\agnes-provider-reask-composer-master-prompt.md` before any repository work.
- Verified the primary checkout at `C:\dev\ai-worker-platform` is clean on `main`.
- Verified `origin/main` resolves to `987f264cce94829733a7d3b1f5bebcb127cefb98`, matching the required baseline.
- Found the dedicated worktree already present at `C:\dev\ai-worker-platform-agnes-reask`; validated it is on `feature/agnes-provider-reask-composer`, clean, and based on the expected baseline.
- Found the older RAN worktree at `C:\dev\ai-worker-platform-ran-pr` and left it untouched per mission constraints.
- Created the heartbeat automation `agnes-provider-reask-composer-hourly-follow-up` for this thread on an hourly cadence.
- Limited this bounded step to Phase 0 mission-state initialization only; deferred product source inspection and implementation to the next bounded step.
- Re-read the Master Prompt and persistent mission state at the start of the Phase 1 continuation step.
- Confirmed Phase 0 is complete, the feature worktree remains on `feature/agnes-provider-reask-composer`, and the overall mission remains incomplete.
- Discovered that the shared LLM layer already exposes a provider-agnostic contract in `backend/src/config/env.js`, `backend/src/llm/llmClient.js`, and `backend/src/llm/llmUtils.js`; Agnes can be added as a sibling provider without changing the caller entrypoint.
- Chose to implement Agnes by following the existing `qwenProvider.js` OpenAI-compatible adapter pattern because repository evidence shows it already matches the mission-required `/chat/completions` protocol, timeout flow, result normalization, and redaction behavior.
- Discovered that backend LLM verification currently relies on script-style coverage, with no focused provider-contract test script; planned a new targeted backend script rather than broad refactoring.
- Discovered that `frontend/src/components/ReAskPanel.vue` currently owns and clears the draft locally immediately after emitting `ask`, which directly explains the failure-retention bug.
- Chose to move Re-Ask draft ownership into `frontend/src/views/JobDetailView.vue` and convert `ReAskPanel.vue` into a controlled child with explicit update and submit events, preserving the current single-answer display instead of introducing chat history.
- Discovered that there is no existing dedicated `ReAskPanel` or `JobDetailView` test file; planned new focused Vitest coverage following the repository's `HomeView.spec.js` interaction-testing style.
- Recovered the mission into one new full-mission `/goal` after the earlier stage-scoped goal ended prematurely, per the updated Master Prompt goal-lifecycle invariant.
- Updated the existing heartbeat automation so future wake-ups resume or recreate the same full mission automatically rather than stopping at a phase boundary.
- Installed backend and frontend dependencies in the Agnes worktree so new focused tests could execute in the isolated worktree.
- Initialized tracked submodules in the Agnes worktree with `git submodule update --init --recursive` after backend integration validation first failed due missing baseline fixture content; submodule pointers remained unchanged.
- Chose a deterministic browser-UAT failure path by submitting an oversized Re-Ask question, which exercises the safe validation path without requiring live Agnes credentials or backend faults.
- Human UAT on PR #22 reported a P1 UX defect: failed Re-Ask requests retain the draft, but the safe error is visible only in the top fixed page-level error area rather than beside the Re-Ask interaction point.
- Root cause from current repository state: `JobDetailView.vue` sends failed Re-Ask safe text only into the shared page-level `errorMessage`, while `ReAskPanel.vue` has no scoped inline error prop or render path.
- Remediation scope is limited to contextual inline Re-Ask failure feedback while preserving the existing global page-level safe-error behavior for Job Detail failures outside the Re-Ask interaction flow.
- Chose to preserve the current top-level safe-error path for Re-Ask failures and add a second scoped inline error surface via `ReAskPanel.vue`, rather than rerouting all Re-Ask errors away from the page-level error area.
- Chose to track Re-Ask failure text separately from global Job Detail failures so the inline error can clear on draft edit and successful retry without changing unrelated page-level error handling.
