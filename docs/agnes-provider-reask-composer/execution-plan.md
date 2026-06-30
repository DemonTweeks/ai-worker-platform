# Agnes Provider + Re-Ask Composer Execution Plan

## Mission Baseline

- Primary checkout remains `C:\dev\ai-worker-platform` on clean `main`.
- `origin/main` remains `987f264cce94829733a7d3b1f5bebcb127cefb98`.
- All product work stays in `C:\dev\ai-worker-platform-agnes-reask` on `feature/agnes-provider-reask-composer`.
- The RAN worktree and submodule stay untouched throughout this mission.

## Phase 1 Discovery Findings

### Shared LLM Surface

- `backend/src/llm/llmClient.js` holds the shared provider registry and retry loop.
- The current registry contains only `qwen`, so Agnes can be added without changing the caller entrypoint.
- `backend/src/llm/providers/qwenProvider.js` already implements the required OpenAI-compatible `POST <base-url>/chat/completions` flow with:
  - safe base URL normalization through `resolveChatCompletionsUrl()`;
  - `AbortController` timeout handling;
  - `Authorization: Bearer <api-key>`;
  - response normalization into `{ ok, text, provider, model, usage }`;
  - provider failure and timeout mapping through `buildLlmError(...)`;
  - sensitive-value redaction through `redactSensitive(...)`.
- `backend/src/config/env.js` already exposes the generic contract required by the mission:
  - `LLM_ENABLED`
  - `LLM_PROVIDER`
  - `LLM_BASE_URL`
  - `LLM_API_KEY`
  - `LLM_MODEL`
  - `LLM_TIMEOUT_MS`
  - `LLM_MAX_RETRIES`
- `backend/src/llm/llmUtils.js` centralizes configuration checks, error construction, and redaction.
- Current LLM callers are:
  - `backend/src/llm/reAskService.js`
  - `backend/src/llm/progressWordingService.js`
  - `backend/src/llm/finalSummaryWordingService.js`
  - `backend/src/services/healthService.js`

### Current Backend Test Surface

- Backend verification is script-based, not unit-test-runner based.
- Existing relevant coverage is partial:
  - `backend/scripts/smoke-test.js` verifies only the disabled LLM path through `llmClient.generateText(...)`.
  - `backend/scripts/integration-test.js` references `answerReAsk(...)`, but it is not targeted Agnes/Qwen coverage.
  - `backend/scripts/error-visibility-test.js` exercises broader redaction behavior, not the LLM provider contract directly.
- No existing focused script covers provider selection, mocked chat-completions responses, malformed payloads, 401/403/429/5xx mapping, timeout behavior, or Agnes-specific normalization.

### Re-Ask Surface

- `frontend/src/components/ReAskPanel.vue` currently owns the draft locally with `data().question`.
- `ReAskPanel.vue` emits `ask` and immediately clears `question`, which is the root cause of draft loss on request failure.
- The current textarea has no explicit keyboard handler for Enter versus Shift+Enter.
- `frontend/src/views/JobDetailView.vue` owns `asking`, `errorMessage`, and `reAskAnswer`, but not the draft.
- `JobDetailView.vue` currently calls `askJob(...)` directly in `askQuestion(question)` and only guards against empty trimmed text.
- `frontend/src/api/reAskApi.js` is a thin POST wrapper and should stay unchanged unless tests require helper reuse.

### Current Frontend Test Surface

- Frontend uses Vitest plus Vue Test Utils.
- There is no dedicated existing test file for `ReAskPanel.vue`.
- There is no dedicated existing test file for `JobDetailView.vue`.
- The closest existing style reference is `frontend/src/views/__tests__/HomeView.spec.js`, which uses `vi.mock(...)`, `mount(...)`, and direct method assertions for async UI flows and safe error rendering.

## Selected Implementation Approach

### Agnes Adapter Compatibility Decision

- Agnes should be implemented as a new sibling adapter at `backend/src/llm/providers/agnesProvider.js`.
- The repository evidence supports following the current Qwen adapter pattern directly because Qwen already uses the mission-required OpenAI-compatible chat-completions contract.
- The initial plan is to avoid refactoring `qwenProvider.js` unless test-driven evidence shows shared helper extraction is necessary to eliminate duplication safely.

### Re-Ask Ownership and Event Flow Decision

- Move draft ownership into `frontend/src/views/JobDetailView.vue`.
- Convert `frontend/src/components/ReAskPanel.vue` into a controlled component that receives:
  - the current draft value;
  - loading state;
  - answer state.
- Replace the current fire-and-clear behavior with explicit draft update and submit events so the parent controls when the draft clears.
- Add a parent-level duplicate guard in `JobDetailView.vue` in addition to disabling the child UI while `askJob(...)` is in flight.
- Preserve the current single-answer display model rather than introducing chat history.

## Expected Product Files To Change

### Backend

- Create `backend/src/llm/providers/agnesProvider.js`
- Modify `backend/src/llm/llmClient.js`
- Create `backend/scripts/llm-provider-test.js`
- Modify `backend/package.json`
- Modify `.env.example`
- Modify `docs/deployment-windows.md`

### Frontend

- Modify `frontend/src/components/ReAskPanel.vue`
- Modify `frontend/src/views/JobDetailView.vue`
- Create `frontend/src/components/__tests__/ReAskPanel.spec.js`
- Create `frontend/src/views/__tests__/JobDetailView.spec.js`

## Required Test Additions

### Backend Coverage Additions

- Add mocked provider coverage for:
  - Agnes success normalization;
  - base URL without `/chat/completions`;
  - base URL already ending with `/chat/completions`;
  - disabled configuration;
  - incomplete configuration;
  - unsupported provider regression path;
  - HTTP 401;
  - HTTP 403;
  - HTTP 429;
  - HTTP 5xx;
  - timeout via aborted fetch;
  - network failure;
  - malformed response;
  - sensitive-value redaction;
  - Qwen regression behavior under the existing shared client contract;
  - at least one mocked normal caller path using `LLM_PROVIDER=agnes`, most likely through `reAskService` and/or `healthService`.

### Frontend Coverage Additions

- Add `ReAskPanel` interaction coverage for:
  - Enter submission;
  - Shift+Enter newline preservation;
  - whitespace rejection;
  - disabled Ask button while submitting;
  - duplicate Enter prevention while submitting.
- Add `JobDetailView` integration coverage for:
  - parent-level duplicate guard;
  - successful request clears the parent-owned draft;
  - failed request retains the parent-owned draft;
  - submitted question appears exactly once with the returned answer;
  - existing safe error rendering when `askJob(...)` rejects.

## Regression Risks To Control

- Qwen regression risk:
  - changing shared provider registration or error mapping could break existing progress wording, final summary, Re-Ask, and health-check callers.
- Re-Ask UI regression risk:
  - moving draft ownership could break current answer rendering, loading states, or error banners if the parent-child contract is incomplete.
- Job Detail regression risk:
  - realtime refresh and `loadDetail()` behavior must remain intact while the Re-Ask draft and answer state changes.
- Validation-chain risk:
  - backend `npm test` is integration-heavy, so focused Agnes coverage should be added in a way that is deterministic and secret-free.

## Ordered Execution Plan

1. Add failing backend Agnes provider coverage and wire it into `backend/package.json`.
2. Implement `backend/src/llm/providers/agnesProvider.js` and register Agnes in `backend/src/llm/llmClient.js`.
3. Update only the relevant developer-facing LLM configuration docs in `.env.example` and `docs/deployment-windows.md`.
4. Add failing focused frontend tests for `ReAskPanel` and `JobDetailView`.
5. Convert `ReAskPanel` to a controlled component and move draft ownership plus duplicate guarding into `JobDetailView`.
6. Run required backend and frontend validation plus focused evidence capture.
7. Record verification, review findings, final report, completion marker, push, and Draft PR only after every gate passes.
