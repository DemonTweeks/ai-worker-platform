# AI Chatbox History Fix

## Objective
Implement the confirmed frontend fix so AI Chatbox responses append visibly in the Home Live Output stream after job completion.

## Confirmed Root Cause
HomeView used a single `reAskAnswer` object and rendered it with a fixed console item id of `reask-answer`. Each new answer overwrote the previous visible item instead of appending a new chat message. If the console was not auto-sticking to the bottom, the updated answer could also remain out of view.

## Fix Implemented
- Added `chatMessages` history to HomeView state.
- Appended a user message immediately on AI Chatbox submit.
- Appended an assistant response message when `askJob` returns.
- Appended an assistant error message when `askJob` fails, while preserving the transient error banner.
- Rendered each chat message through `consoleItems` with a unique id.
- Stopped relying on the fixed `reask-answer` console item for visible chat output.
- Forced console stick-to-bottom only for AI Chatbox submissions/responses.
- Kept passive job event auto-scroll behavior unchanged.

## Files Changed
- `frontend/src/views/HomeView.vue`
- `frontend/src/styles.css`
- `prompts/result/taste/ai-chatbox-history-fix-20260520.md`

## Confirmation Backend Was Not Changed
- Backend files were not modified.

## Confirmation WebSocket Was Not Changed
- WebSocket logic and server behavior were not modified.

## Build/Test Result
- `npm run build`: passed.
- `npm run test`: passed.
- Existing smoke routes passed: `/`, `/history`, `/jobs/QA15-ROUTE-SMOKE`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, `/admin/health`.

## Manual Validation Steps
- After completed Job, send question A: user message A appends immediately.
- Assistant answer A appends as a new message with unique id.
- Send question B: user message B appends immediately.
- Assistant answer B appends as another new message.
- Old answer A remains visible in chat history.
- Console is forced to the latest chat message for AI Chatbox submissions/responses.
- Backend files remain unchanged.

## Known Limitations
- This pass does not change LLM timeout behavior.
- This pass does not add persistent chat storage; chat history is local to the current Home page session.
- Runtime browser validation was not available in this run; validation was via code inspection, build, and smoke tests.

## Git Branch
- `main`

## Git Commit Hash
- Pending until commit is created.

## Push Status
- Pending until push attempt.
