# Home navigation and canonical routes — 2026-11-11

User approved Home label/heading at `/home`, default root redirect to `/home`, exact navigation order Home / TX Dashboard / Status / History / Admin, and no compatibility redirects.

- Removed `/dashboard` and `/tipic-artifacts` route records entirely; neither resolves to a registered route or redirects.
- TX Dashboard remains `/tx-dashboard`; four external artifact URLs and UAC note unchanged.
- Home retains worker shortcuts including TX BOM Generator. Selected-job Status and health indicator unchanged.
- Frontend-only release; no backend/database/skill changes.
- Validation: 126 tests across 21 files passed; production build and 15 HTTP SPA-entry route checks passed. Tests explicitly check absent legacy routes and navigation order for both disabled and selected-job Status.
- Private build/test/smoke/release logs are retained in the conversation folder under `home-navigation-*`.
