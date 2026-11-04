# Platform realignment — dev01, 2026-11-04

## Checkout and release boundary

- Production: `C:\deployment\ai-worker-platform`, branch `main`, deployed commit `6186a05f27d091b1f2ec7ae52f614ff9c6c52ddc`.
- Development: `C:\Development\ai-worker-platform-dev01`, branch `dev01`. Future worktrees use `dev02`, `dev03`, etc.; none are automatically deployed.
- The old TX BOM development worktree was removed after its tested integration was pushed and deployed. Its logs/artifacts were preserved at `C:\Development\aida-chrome\aida-temp-script\conversation-c-mvz76unj-wh80\tx-bom-worktree-evidence-6186a05`.
- Production includes MW 4.1.0 and TX BOM 0.1.0. Its uploader remains 0.3.3. Local development adds uploader 0.3.4 on skill branch `dev01/planning-upload`.
- This realignment is development-only: no push, production merge, restart or live iEPMS submission performed for it. Real environment files are not copied from production.

## Platform behavior

Header worker order: **PR Creator → PR Auditor → iEPMS PR Upload → TX BOM Generator**.
Existing route URLs and names remain unchanged, including both MW/RAN routes and the PR Creator switch. There is no new standalone RAN header item.

Uploader `scope=PLANNING` survives manifest-driven selection, multipart creation, persisted job and invocation, detail/history serialization, worker + scope filters and rerun reconstruction. It remains PLANNING in the frozen Python request and PR description; it is never aliased to TSS or TI. Scope normalization is extended only to the uploader alongside MW. Existing TSS/TI behavior remains supported.

History includes TX BOM Generator. TX BOM scope is hidden in filters, detail header/summary and History badges; stale scope is cleared on worker switch and excluded from History queries. RAN/Auditor do not gain Planning. RAN, Auditor and TX BOM packages/business rules/pins are unchanged.

## Uploader change

The previous uploader rejected Planning at manifest and workbook-manifest validation. Version 0.3.4 adds it to those existing contracts. Project/model routing, quantities, workbook validation, attachments, ledger/recovery, submit verification and the submit-only stopping point remain unchanged. The legacy standalone client/UI is not expanded.

Local uploader commit: `48a14fabf1b14f081eecb164d1ea08b531345873` (not pushed).

Normalized runtime fingerprint: `cf885f9792ce7e1689939f5aebbf01de8ca6caede76bafc8ee6b72b44e4bee18`.
Publish the reviewed skill commit before publishing a platform gitlink that depends on it. Never use `submodule update --remote` for production deployment.

## Validation and limits

- Full uploader Python suite: 316 passed; synthetic Planning XLS/XLSX across all seven existing project/model options; mock submit/replay and frozen request checks.
- Full backend npm suite passed: API create/detail/history/filter/rerun scope and input hashes, offline Python execution for TI/Planning XLS/XLSX with deliberately unavailable local CDP; no corporate requests.
- Frontend tests/build and 13 route checks passed; final counts/evidence in `command-center/results/dev01-realignment.md`.
- Logs: `command-center/results/dev01-{uploader,frontend,backend}-tests.log` (ignored); retained synthetic pytest artifacts under `command-center/runtime/dev01-uploader-pytest-pass`.
- No live Planning server-acceptance or deployed-browser UAT claim. No real PR created. Deployment requires separate authorization and review.
- Existing lockfile audit warnings remain: backend 8, frontend 20 vulnerabilities; no unrelated dependency upgrades.

This dated snapshot supersedes older current-state statements about TX BOM being unmerged/unpushed, removed development paths and using the production checkout for development. Historical business findings and unresolved TX BOM source-rights/configuration safety limits remain valid.
