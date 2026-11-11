# TIPIC Artifacts navigation — 2026-11-11

- Added global **TIPIC Artifacts** navigation and public hash route `/tipic-artifacts`.
- Four links: Site Lookup Tools (268), 2026 Q4 Dashboard (423), Celcomdigi ZTE MW Project Dashboard (151), CelcomDigi 3rd Party MW TX Project Dashboard (202).
- Prominent instruction: access `https://tipic.zx.zte.com.cn/tipic/` in the UAC environment and sign in before opening artifacts.
- All external links use a new tab with `noopener noreferrer`; no embedding, automatic downloads, proxy, credentials, or backend/database changes.
- Responsive two-column cards switch to one column at 700px; keyboard focus styling and descriptive link labels included.

## Integration and validation

User authorized latest-branch integration, commit, push, and restart. Remote branches are `main` and `dev01`; no `master` or `develop` exists. Fetched remote state and fast-forwarded dev01 from 3b90c4e to latest main 65eb864 before implementation, preserving the managed BOM template changes.

- Frontend: 123 tests across 21 files passed.
- Production build: Vite 7.3.3, 119 modules; passed.
- HTTP route smoke: 15 routes passed including `/fe/#/tipic-artifacts` (SPA entry responses, with actual route rendering additionally covered by unit/browser checks).
- `git diff --check` passed.
- Only frontend restart is required; backend and worker execution are unchanged.
- Private test/build/smoke and deployment evidence is retained in this conversation folder under `tipic-*` filenames.
- External corporate artifact availability/sign-in is not validated from this machine; the user must open them in UAC.
