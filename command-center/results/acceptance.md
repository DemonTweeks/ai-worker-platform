# TX BOM migration acceptance — 2026-11-04

## Candidate identity
- Platform baseline: 1dfc376619d59b643fce3da1c175ba0222e22a6f; feature branch agent/tx-bom-generator-skill.
- Skill: tx-bom-generator 0.1.0; feature branch agent/platform-skill-migration.
- Exact local skill commit: `50a85eebed450d8ca50f07d42e3e1fa1463cc54c`.
- Normalised approved runtime fingerprint: `c95a5ce6ef8ed2d622a2c0e325fe076b1b828b76db0e150bbd6f23077bb4e448`.
- One agent, sequential work. Two simultaneous subprocess jobs were tested as required; no parallel subagents.

## Passed gates
| Gate | Evidence |
|---|---|
| Necessary headless source only, provenance/checksums | skills/tx-bom-generator/docs/PROVENANCE.json; staged-content inspection |
| No business fixture/build/credential upload | 21 skill files reviewed; no XLS/XLSX/ZIP/EXE/DLL/PYD/generated files staged |
| Source regression and safety/adapter | 94 Python tests passed, 48.253s; results/stage-7-python-final.log |
| All existing backend test scripts + new TX BOM acceptance | full backend npm test exit 0; results/stage-7-backend-final.log |
| Generic manifest UI, navigation/routing | 101 tests in 19 frontend test files passed; production build and all 13 route checks passed; results/stage-7-frontend-final.log |
| Upload → native Python → output/downloads | actual multipart ephemeral loopback API with mock DB, output checksums/BOM reopen and ZIP contents verified |
| Success, mixed and all-failed | completed / completed_with_warning / failed with diagnostic downloads; no failed-site partial rows |
| Exact site accounting | generated+failed=requested, unaccounted=0, per-site identities |
| Isolation | two concurrent jobs, distinct workspaces and site output; cross-job file ID download rejected |
| Cancellation | queued request cancelled before execution; claimed request 409 SKILL_CANCELLATION_UNSUPPORTED |
| Timeout | generic executeProcess hard timeout tested with isolated test-only sleeper |
| No false success | injected verification/integrity/count/ZIP/dependency failures, cached formula quantity, unsafe Excel values, Windows junction/path escapes covered |
| Existing worker scope | existing runtime approval values and gitlinks unchanged; only catalogue-count assertions adapted |

## Retained evidence
- Logs: `C:\Development\ai-worker-platform-tx-bom\command-center\results\stage-7-*-final.log` (ignored by Git).
- Final synthetic API workspaces/artifacts and acceptance-summary.json: `C:\Development\ai-worker-platform-tx-bom\command-center\runtime\tx-bom-acceptance-TQiBA7` (ignored by Git).
- Skill validation summary: skills/tx-bom-generator/docs/VALIDATION.md.
- Private access/release limits: wiki/tx-bom-generator/HANDOVER.md and PENDING.md.

## Review findings / release limits
- Source licensing/ownership confirmation remains required; no licence invented.
- Supplied real template has broken #REF! formulas. Candidate rejects those safely; owner-approved correction/policy is a release decision. Engineering quantities are not changed.
- Tested native Windows Python 3.14.6/openpyxl 3.1.5; minimum 3.11 is not independently validated.
- Existing lockfile npm audits: backend 8 vulnerabilities; frontend 20. No unrelated dependency upgrade attempted.
- Full backend initial attempt failed only because isolated test storage lacked base folders; initialising them and rerunning the entire suite passed. Early authoring syntax/UI-copy issues were corrected and full final suites rerun.
- Offline APIs use mock persistence and ephemeral loopback servers; no live corporate iEPMS operation or deployed-browser UAT. Deterministic TX BOM scheduling is test-controlled; queue scheduling/durability is covered by the existing suite.
- Severe I/O errors/hard kill may prevent final-envelope creation; platform fails closed. Running cancellation unsupported.
- Current live-checkout status differs from the earlier stored snapshot; no command in this migration edited/reconciled its pending files. Reconcile current upstream and deployment baseline before merge.

## Delivery state
Skill was published first; skill main is verified at `50a85eebed450d8ca50f07d42e3e1fa1463cc54c`. Platform feature commit was published subsequently. The user then authorised rebasing onto the latest platform main and direct fast-forward promotion to main. No deployment checkout update or live-service restart is part of this promotion. Original release limits above remain applicable.

## Rebase and main promotion validation — 2026-11-04
- Rebased the TX BOM integration onto upstream main `40bf379e373144fc97d6b0313947e90e13f6b432`; no conflicts.
- Preserved upstream MW Planning v4.1.0, approved fingerprint `f00d3a35b6321e301194d4380da6cf703fe961bf5d2d445af84530e28334a7c3`, and gitlink `8fb4fd5bbda0ff1bbcf9b5cac5e339881f17e88e`.
- Existing other skill pins and the TX BOM pin/fingerprint remain unchanged.
- Full backend npm test passed with mock persistence, LLM disabled and isolated storage.
- Frontend: 103 tests in 19 files passed; production build and 13 route checks passed.
- TX BOM: 94 Python tests passed in 49.155s using native Windows Python 3.14.6.
- Logs retained locally: `command-center/results/rebase-main-backend.log`, `rebase-main-frontend.log`, `rebase-main-python.log` (ignored by Git).
- New synthetic acceptance artifacts: `command-center/runtime/tx-bom-acceptance-mwPQDJ` (ignored by Git).
- Working trees clean after validation; `git diff --check` passed. Private skill main remains resolvable at the recorded TX BOM gitlink.
- Promotion uses a normal non-force push to existing platform main; no master branch is created. Remote identity is checked after push.
