# Home One-Page Cockpit Result

## Objective
Convert only the Home page into a one-viewport AI Worker cockpit UI for ai-worker-platform.

## Scope Implemented
- Reworked Home into a compact one-page cockpit layout.
- Preserved existing upload, validation, job creation, health, websocket, result, download, history, and admin route behavior.
- Kept changes frontend-only and limited to Home page rendering/styling plus this process log.

## Files Changed
- `frontend/src/views/HomeView.vue`
- `frontend/src/styles.css`
- `prompts/result/taste/home-one-page-cockpit-result-20260520.md`

## Layout Structure Implemented
- Compact top bar with ZTE-styled product identity, health badge, Status entrance, History entrance, and Admin entrance.
- Exactly four desktop action cards:
  - Upload & Validate
  - Job Scope
  - Sites
  - Download
- Compact AI command input below the cards.
- Large bottom live console that combines upload/validation, progress, websocket events, result state, final summary, and AI response entries.
- Console renders oldest to newest and auto-scrolls only when the user remains near the bottom.

## How Backend/API Changes Were Avoided
- Reused existing `getHealth`, `prevalidateUpload`, `createJob`, `getJobDetail`, `getZipDownloadUrl`, and `askJob` flows.
- Reused existing `JobWebSocketClient` behavior.
- Did not add services, routes, backend endpoints, database logic, job execution logic, or websocket server changes.
- Command input calls the existing `askJob` flow only when a current Job exists; otherwise it shows frontend-only guidance.

## Build/Test Commands Executed
- `npm run build`
- `npm run test`

## Build/Test Result
- `npm run build`: passed.
- `npm run test`: passed.
- Existing smoke routes passed: `/`, `/history`, `/jobs/QA15-ROUTE-SMOKE`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, `/admin/health`.

## Manual Layout Checks
- Home-specific CSS sets the Home route container to `100dvh`.
- Home-specific CSS hides the global app header only while the Home cockpit is mounted.
- Home-specific CSS disables page/body overflow while the cockpit is mounted.
- Desktop card row uses `grid-template-columns: repeat(4, minmax(0, 1fr))`.
- Bottom console uses `flex: 1 1 auto`, `min-height: 0`, and `overflow-y: auto`.
- Sites input uses internal scrolling for longer pasted lists.

## Known Limitations
- Download actions reflect existing ZIP availability logic; no new Excel download behavior was invented.
- Command input is limited to the existing re-ask API for an active Job.
- Layout confirmation was performed through CSS constraints and build/smoke validation; no separate browser screenshot workflow was available in this run.

## Follow-Up Recommendations
- Add an interaction test for command input disabled/guidance behavior.
- Add a visual regression check for desktop `100dvh` containment if a browser automation tool is added later.
- Consider a dedicated compact upload component later if validation checklists need full visibility inside the fixed card height.

## Git Branch
- `main`

## Git Commit Hash After Commit
- Implementation commit: `6013abb`

## Push Status
- Success: pushed `main` to `origin/main` (`b0ffe1d..6013abb`).
