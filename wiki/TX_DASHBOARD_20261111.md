# Dashboard landing and TX Dashboard navigation — 2026-11-11

Approved follow-up to TIPIC Artifacts:
- Root route redirects to `/dashboard`; direct worker and job links stay unchanged.
- Global navigation and artifact page heading are **TX Dashboard**, at `/tx-dashboard`.
- Legacy `/tipic-artifacts` redirects to `/tx-dashboard`.
- All four corporate artifact links, safe new-tab attributes, and UAC sign-in instructions are retained.
- Dashboard Workers section includes **TX BOM Generator**, linking to `/workers/tx-bom-generator`; introductory text mentions TX BOM preparation.
- Frontend-only; backend, databases, worker logic and skill pins unchanged.

Validation: 124 frontend tests / 21 files passed; production Vite build passed; 16 HTTP SPA entry route smoke checks passed; route/component regression tests cover redirects, navigation, titles, links and BOM shortcut. An initial duplicate-navigation test setup failure was corrected by starting the direct-route test from `/history`.

User approved implementation, commit/push to existing main/dev01 branches, and production frontend restart. Private logs and release evidence remain in the conversation folder as `tx-dashboard-*`.
