# Agnes Provider + Re-Ask Composer Execution Plan

## Phase 0: Mission Setup

- Read the Master Prompt from disk at the start of each bounded step.
- Verify `C:\dev\ai-worker-platform` stays clean and `origin/main` remains at `987f264cce94829733a7d3b1f5bebcb127cefb98`.
- Work only in `C:\dev\ai-worker-platform-agnes-reask` on `feature/agnes-provider-reask-composer`.
- Maintain the persistent state, decision, verification, review, and final report documents after every bounded step.

## Phase 1: Repository Inspection

- Inspect the shared LLM implementation surface in `backend/src/llm/llmClient.js` and `backend/src/llm/providers/qwenProvider.js`.
- Inspect the Re-Ask frontend flow in `frontend/src/components/ReAskPanel.vue` and `frontend/src/views/JobDetailView.vue`.
- Identify existing test locations, provider contracts, duplicate-submission guards, and safe error handling patterns before any product changes.

## Phase 2: Agnes Provider

- Add an Agnes provider adapter through the shared LLM abstraction only.
- Preserve Qwen behavior, result contracts, retries, timeouts, redaction, and base URL normalization.
- Add focused mocked backend coverage for Agnes behavior and at least one mocked caller path using `LLM_PROVIDER=agnes`.
- Update only the relevant configuration example and developer documentation.

## Phase 3: Re-Ask Composer Reliability

- Move draft ownership to the parent view if repository evidence supports the preferred controlled-component shape.
- Ensure Enter submits only valid non-empty content, Shift+Enter preserves multiline input, and active submission blocks duplicates.
- Clear the draft only after successful `askJob(...)` completion and retain it after failures.
- Add focused component and integration coverage for success, failure, keyboard behavior, and duplicate prevention.

## Phase 4: Validation and Closeout

- Run required backend and frontend validation commands and record exact outcomes.
- Perform changed-file scope review, secret scan, submodule verification, and browser UAT evidence capture.
- Only after all gates pass, write the final report, create `COMPLETED`, push the feature branch, and open one Draft PR.
