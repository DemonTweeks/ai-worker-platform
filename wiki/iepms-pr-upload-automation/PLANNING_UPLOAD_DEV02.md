# Planning upload follow-up - dev02 v0.3.5

## Baseline and ownership

Pulled published platform main `0aa085d` before implementation. It already contains dev01's header order, TX BOM history handling, uploader v0.3.4 `48a14fabf1b14f081eecb164d1ea08b531345873`, and Planning lifecycle support. Those changes are preserved, not reimplemented. dev01's worktree is untouched.

Worktree: `C:\deployment\ai-worker-platform-dev02`; platform branch `feature/iepms-planning-dev02`; uploader branch `feature/planning-upload-dev02`.

## Narrow changes

- Internal/public/frozen scope stays PLANNING; generated description uses observed iEPMS spelling `Planning/`. TSS/TI prose is unchanged.
- Planning uses the existing validate/import/verify/attach/save/submit/verify workflow. ECC PBOM, SOW, purchase contract, vendor, site/DU, quantities and units are transported without a new business selector. Existing GTSB-to-server vendor matching is retained.
- No invented server scope/taskType field and no new project/model options. The seven existing models remain the boundary; 2023 BAU is not added.
- Description case is part of the frozen-package hash. A previous v0.3.4 uppercase Planning prepare/submit ledger now blocks a replacement execution with conflict code 40 and preserves known PSQ/OID for reconciliation. It is not silently rehashed, replayed or promoted. Server duplicate matching remains case-insensitive.
- Existing import/mismatch/abnormal-line gates and submit-only stopping point remain intact. No tracker/IP mutations.

## Outstanding procurement verification

This is an offline-validated implementation, NOT verified current procurement entitlement. Read-only evidence found recent MW Planning headers using sales contract P08 (8350062 / SS1MY2023082301SENMWZP08), whereas the existing profile is P06 (8245922 / SS1MY2023082301SENMWZP06). This follow-up does not globally switch contracts or add a new resolver. The owner authorized publication and restart of the unchanged-contract implementation. This is not confirmation of current contract entitlement; verify the applicable contract before any live Planning submission.

Historical GTSB PBOMs and TX Mini examples differ from current generator selectors. Tests below prove exact transport, not approval of every synthetic model/vendor/PBOM pairing. Do not rewrite the ECC or turn test cases into a business allowlist. Current purchase entitlement still requires authoritative checking. W14 trailing-padding behavior remains separate.

No live authentication, draft, import, save or submission occurred during dev02 implementation. Production restart is separately owner-authorized; activation evidence must be recorded after verification. Live acceptance requires separate authorization for a specific workbook.

## Validation

- Baseline uploader suite: 316 passed.
- Final uploader suite: 388 passed, including XLS/XLSX exact item/frozen package preservation, all seven model routes, mock submit/replay, scope-separated duplicate lookup, imported-line mismatch/abnormal rejection, uncertain Planning import, and four description-format upgrade ledger cases.
- Frontend: 110 tests / 19 files; build and 13-route smoke passed. No frontend source changed in dev02.
- Backend complete npm test passed after preparing isolated storage and aligning the version assertion; includes mock DB/API lifecycle, integrity/fingerprint, offline uploader authentication failure and local MW/RAN/TX BOM execution. The full backend suite was rerun after the final recovery guard and fingerprint refresh; it passed.
- First isolated backend smoke failed because its test storage folders did not exist; folders were created only under the conversation evidence path. Version assertions were aligned after the local version bump and rerun.
- Release approved version 0.3.5, normalized package SHA-256 `7a74e34cfb08d0ac2d93ea846ecb5c2416e672d814758504ca1f6941abef840c`. The companion platform release must record the exact published uploader commit.
- Publication and restart were subsequently owner-authorized. Validation results above are offline evidence, not live submission acceptance.

## Evidence and next steps

Evidence: `C:\Development\aida-chrome\aida-temp-script\conversation-c-mumi1ss1-kgnh\dev02-validation` (Python/backend/frontend logs and retained synthetic Python workspaces). Local backend TX BOM regression evidence remains under dev02 `command-center/runtime/tx-bom-acceptance-Y5jCoj`.

Review contract gates, rerun final approval checks, then publish uploader commit before the platform gitlink/approval commit. Reconcile older Planning ledgers before any rerun. Restart only after an idle queue check; record observed production identities after activation.

## Published uploader identity

Uploader commit: `99688cb71c00644f82fcb58ad73be5ec2e64a4c7`; version 0.3.5. The platform gitlink and normalized approval record this release together.

## Verified production activation - 2026-11-04

- Owner-authorized commit/push/restart completed. Activated platform `03cdbb131f2524f3737dfcae7df8752e95c2d696` with uploader `99688cb71c00644f82fcb58ad73be5ec2e64a4c7`; remote main identities verified.
- Queue had zero active/queued jobs. Ran `stop-services.bat`, then `launcher.bat`; production frontend build succeeded.
- Nginx `/api/skills` verifies uploader 0.3.5, scopes TSS/TI/PLANNING and normalized SHA-256 `7a74e34cfb08d0ac2d93ea846ecb5c2416e672d814758504ca1f6941abef840c`. Other four skills retain their versions.
- `/fe/` and rebuilt `index-CXjp3nQC.js` return HTTP 200. Backend/Firebase/storage/queue are OK; overall health remains degraded by existing Agnes LLM provider failure.
- No Planning workbook submitted or imported. Procurement verification remains open as documented above; deployment is not live submission acceptance.
- Evidence: `C:\Development\aida-chrome\aida-temp-script\conversation-c-mumi1ss1-kgnh\dev02-production-activation.json`.
