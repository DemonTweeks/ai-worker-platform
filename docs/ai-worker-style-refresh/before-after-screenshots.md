# Browser And Screenshot Evidence

## Method

Evidence was captured from the feature worktree using Vite preview at `http://127.0.0.1:4174/`, bundled Playwright, and system Chrome.

API responses were stubbed inside the browser context to verify frontend route and layout behavior without starting or changing backend services.

## Automated Viewport Matrix

Results:

- 49 route and viewport combinations checked.
- Required routes checked: `/`, `/history`, `/jobs/QA15-ROUTE-SMOKE`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, `/admin/health`.
- Viewport widths checked: 1440, 1280, 1024, 768, 430, 390, and 360 px.
- Blocking failures: 0.
- Console warnings/errors: 0.

Files:

- `docs/ai-worker-style-refresh/browser-evidence/viewport-check-results.json`
- `docs/ai-worker-style-refresh/browser-evidence/viewport-check-summary.json`
- `docs/ai-worker-style-refresh/browser-evidence/viewport-check-interpreted-summary.json`

## Screenshots

Captured screenshots:

- `docs/ai-worker-style-refresh/browser-evidence/desktop-1440__home.png`
- `docs/ai-worker-style-refresh/browser-evidence/mobile-390__home.png`
- `docs/ai-worker-style-refresh/browser-evidence/desktop-1440__history.png`
- `docs/ai-worker-style-refresh/browser-evidence/mobile-390__history.png`
- `docs/ai-worker-style-refresh/browser-evidence/desktop-1440__job-detail.png`
- `docs/ai-worker-style-refresh/browser-evidence/desktop-1440__admin-login.png`
- `docs/ai-worker-style-refresh/browser-evidence/desktop-1440__admin-assets.png`
- `docs/ai-worker-style-refresh/browser-evidence/desktop-1440__admin-audit-logs.png`
- `docs/ai-worker-style-refresh/browser-evidence/mobile-390__admin-health.png`

## Before Evidence

The baseline before evidence is the tracked Git history before the style-refresh commits plus the reference analysis screenshots under `docs/reference-website-analysis/screenshots/`.

No production reference assets were copied into the implementation.

## Notes

- The audit log table intentionally uses contained horizontal scrolling on narrow screens. The browser check separately verified document/body overflow is false.
- Backend data was stubbed for visual verification only; backend baseline tests are a separate acceptance gate.
