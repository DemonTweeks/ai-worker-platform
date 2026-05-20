# Home Cockpit Bugfix Result

## Objective
Apply a focused bugfix and UI text tuning pass for the Home one-page PR Creator cockpit without redesigning the page or changing backend/API contracts.

## Issues Fixed
- AI Chatbox timeout after job completion.
- Title changed from `Worker Cockpit` to `PR Creator`.
- Label changed from `Current worker` to `Task Type`.
- Removed the Sites helper text about internal scrolling.
- Upload & Validate card no longer scrolls internally.
- Transient AI Chatbox/API errors auto-clear within 30 seconds.
- Send button text is centered.
- Download card now shows compact progress summary fields below the progress bar.
- AI command label changed to `AI Chatbox`.

## Root Cause Analysis for AI Chatbox Timeout After Job Completion
The Home AI Chatbox calls `askJob`, which posts to `/api/jobs/:jobId/ask` through the shared frontend axios client. The shared client has a 10-second timeout. The backend re-ask path already supports completed jobs by building safe job context and returning an LLM answer or fallback. After completion, the ask path can take longer because result/final-summary context is richer and LLM generation may run. The observed `timeout of 10000ms exceeded` is therefore a frontend HTTP timeout, not a WebSocket issue. WebSocket remains used only for progress/events.

## Files Changed
- `frontend/src/api/reAskApi.js`
- `frontend/src/views/HomeView.vue`
- `frontend/src/styles.css`
- `prompts/result/taste/home-cockpit-bugfix-result-20260520.md`

## Whether Backend Was Changed Or Not
- Backend was not changed.

## If Backend Changed, Explain Exactly Why
- Not applicable.

## Build/Test Commands Executed
- `npm run build`
- `npm run test`

## Build/Test Result
- `npm run build`: passed.
- `npm run test`: passed.
- Existing smoke routes passed: `/`, `/history`, `/jobs/QA15-ROUTE-SMOKE`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, `/admin/health`.

## Manual UI Checks
- Home page structure remains top bar, four top cards, middle AI Chatbox, and bottom Live Output stream.
- Title now reads `PR Creator`.
- Task selector label now reads `Task Type`.
- Sites helper text was removed.
- Upload & Validate card has `overflow: hidden`, compact spacing, and a reduced validation summary so the card itself does not scroll.
- AI Chatbox timeout and other ask errors use a friendly transient banner and clear within 30 seconds.
- Send button is centered with matching input height.
- Download card shows requested sites, matched sites, unmatched sites, generated output files, review required items, and warnings below the progress bar.

## Known Limitations
- AI Chatbox still depends on backend/LLM response time and provider availability; frontend now waits longer and recovers cleanly if it still times out.
- Progress and summary fields use existing job detail/progress fields only; no backend data was invented.
- Browser screenshot validation was not available in this run; validation was via code inspection, CSS constraints, build, and smoke tests.

## Git Branch
- `main`

## Git Commit Hash After Commit
- Implementation commit: `fa2606e`

## Push Status
- Success: pushed `main` to `origin/main` (`da4a765..fa2606e`).
