# AI Worker Platform - Handover

## Current State

- Documentation reviewed on 2026-10-15 against platform baseline `ec5fd9b`. The latest runtime activity includes live W14-W16 tests; this is not a fresh audit of all historical PRs.
- Published uploader pin: `397010e`, v0.3.1, native XLS/XLSX. Platform operation submits and verifies, then stops before trackers/Implementation Plans. Desktop preparation remains a separate draft-only path.
- On the inspected deployment host, an uncommitted v0.3.2 uploader fix and matching modified approval are running. This documentation commit does not publish those files or update the gitlink. See [exact release/runtime state](iepms-pr-upload-automation/DEPLOYMENT_SNAPSHOT_2026-10-15.md).
- The platform pins `create-pr-cd` v4.0.1 at `dc7cb77`, including governed PostMOCN and Starlink/NLOS TI guidance.
- The platform gitlink pins `tx-pr-auditor` 1.1.0 at `df14590`.
- `create-pr-cd-ran` 1.1.2 is pinned to BL2 branch commit `15fae20` with delivery ZIP output; upstream promotion uses [ammarofficial11/create-pr-cd-ran#1](https://github.com/ammarofficial11/create-pr-cd-ran/pull/1).
- Every pinned commit is reachable from the submodule URL configured in `.gitmodules`.
- Firebase is authoritative for job lifecycle and durable queue ownership.
- The active registry contains only approved generic Python skill packages.
- Environment-specific Git branches are no longer part of the runtime design. Both profiles launch from the current `main` checkout.
- All backend and frontend environment values are centralized in `config/env/`; real profile files are intentionally untracked.

### RAN repository topology

The platform resolves `skills/create-pr-cd-ran` from [BL2ZteSolution/create-pr-cd-ran](https://github.com/BL2ZteSolution/create-pr-cd-ran) and follows `refactor/standard-skill-contract`, the branch containing the standard thin-wrapper contract and manifest-driven workbench metadata. The submodule checkout uses these remotes:

- `origin`: `https://github.com/BL2ZteSolution/create-pr-cd-ran.git`
- `upstream`: `https://github.com/ammarofficial11/create-pr-cd-ran.git`

RAN development commits are pushed to both remotes with explicit commands so a failed upstream push cannot be mistaken for a successful mirror:

```powershell
git -C skills/create-pr-cd-ran push origin refactor/standard-skill-contract
git -C skills/create-pr-cd-ran push upstream refactor/standard-skill-contract
```

The `BL2ZteSolution` account currently lacks direct push permission to `ammarofficial11/create-pr-cd-ran`; until that permission is granted, the second command returns HTTP 403 and upstream promotion continues through [PR #1](https://github.com/ammarofficial11/create-pr-cd-ran/pull/1).

## Implemented Components

- `backend/src/skills/skillPackageService.js`: manifest and runtime-package approval.
- `backend/src/skills/genericSkillJobService.js`: generic multipart submission and input envelopes.
- `backend/src/skills/genericSkillRunner.js`: process supervision and authoritative result ingestion.
- `backend/src/queue/jobQueue.js`: Firebase leases, heartbeats, cancellation state, and restart reconciliation.
- `frontend/src/views/GenericSkillView.vue`: manifest-driven launch form for all active skills using the productized workbench visual structure from baseline `4d4148d7`, including reference-style upload validation cards, skill mode switching, placed/grouped parameters, active Jobs, results, cancellation, AI chat, and live output.
- `frontend/src/components/ManifestParameterField.vue`: generic renderer for manifest-selected segmented, select, checkbox, text, and textarea controls; conditional and hidden/default behavior comes from `skill.json.ui`.
- `skills/*/skill.json` and `skills/*/src/main.py`: standalone contracts. The TX Auditor entrypoint internally runs its pinned recursive `create-pr-cd` dependency for TSS and TI.
- `launcher.ps1` and `deploy.sh`: production-only launch entrypoints without branch mutation; local development runs backend and Vite directly.
- `frontend/nginx.conf`: production-only same-origin proxy for `/fe/`, `/api/`, and `/ws`; health is available only through `/api/health`.
- `backend/src/skills/skillPackageService.js`: cross-platform text normalization with byte-exact binary package hashing.

## Compatibility Behavior

- `skill.json.ui` is presentation-only. Hidden values remain schema-valid request parameters, client validation checks only declared file constraints, and all workbook/business validation stays in standalone Python.
- Historical jobs, metadata, warnings, and retained file downloads remain readable.
- Rerunning a generic job rebuilds a new request from retained `skill_input` files and stored parameters.
- Rerunning a historical legacy job returns `LEGACY_RERUN_REQUIRES_NEW_REQUEST` with a safe instruction to submit through an approved skill.
- `POST /api/jobs` returns `LEGACY_JOB_CREATION_RETIRED`; new work uses `/api/skills/:skillId/jobs`.

## Historical Validation Evidence

The following earlier test counts describe their original snapshots, not the latest suite. Current live findings are in the dedicated uploader handover.

October 7, 2026 iEPMS integration: 94 Python tests and 94 frontend tests passed; frontend build and 12 route-smoke URLs passed. Backend smoke, approval, registry, durable queue, normalized fingerprint, HTTP contract, concurrency, health, and actual Python/no-auth iEPMS integration checks passed. No live iEPMS draft was created.

- Durable queue ownership/restart suite: passed.
- Generic catalog/submission/result suite: passed with three approved packages.
- Real generic CD create execution: completed with zero unaccounted work and 90 outputs.
- TX focused and contract tests pass. The supplied June 2026 Final PO + EPMS demo completed end to end: 94 TSS workbooks, 20 TI workbooks, and 24 audited Final PO rows (2 Normal, 3 Wrong PO, 19 Invalid PO).
- TX 10,000-row baseline: 6.708 seconds and 33.63 MiB traced peak.
- Real generic RAN sample job: completed with five tracked outputs.
- Complete active backend suite: passed, including durable queue, concurrent idempotency, contract/rerun compatibility, and both real creator executions.
- Cross-platform skill fingerprint normalization regression passed; all approved packages validate on Windows.
- Frontend: 19 files and 83 tests passed; production build and all 11 route-smoke URLs passed.
- Node workbook/report dependencies `xlsx`, `exceljs`, and `archiver` were removed with the retired domain services.

## Next Action

Review the [uploader handover](iepms-pr-upload-automation/HANDOVER.md), preserve blocked drafts and recovery ledgers, and resolve the uploader [pending items](iepms-pr-upload-automation/PENDING.md). W16 was submitted and verified; do not repeat it. The existing production credential-rotation requirement remains in [PENDING.md](PENDING.md).

## Documentation audit, 2026-10-16

Read [wiki navigation](README.md) before editing. This pass covers platform runtime/deployment, all four skills, transport versus business validation, nested dependency ownership, release identities and preserved investigation evidence. No fresh live PR lookup or aggregate test run was done for this documentation audit. Local uploader v0.3.2 and approval remain uncommitted and are deliberately excluded from documentation changes.

Important corrected claims:
- MW contract is v4.0.1/TSS-TI only, but its direct domain CLI already implements governed Planning and Backoffice; not exposing them in the platform does not mean absent code.
- RAN is v1.1.2, has delivery ZIP and catalogue validation, and does not promise exactly five outputs.
- Auditor reads additional PR-model/EPMS scope evidence; generated ECC is not its sole entitlement source in the pinned implementation. Business-owner review is recorded in its pending page.
- Windows spawn is not readiness, queue recovery is periodic as well as startup, and admin auth does not protect every job/skill route.
- No standalone workbook register is present. Supplied historical statuses and live W14-W16 recovery details belong in the existing uploader handover/pending pages, with provenance.

### Available validation commands (not freshly run here)

Backend package scripts cover smoke, engine integrity, normalized fingerprint, queue registry, durable reconciliation, job concurrency/idempotency, health, contracts and offline iEPMS integration. `npm.cmd --prefix backend test` also runs MW/RAN creator execution suites; it is not a read-only audit command. Frontend `npm.cmd --prefix frontend test` runs unit tests, build and route smoke. Use isolated/mock storage and blocked network for uploader regression; never repoint a live mutation test at a real authenticated host without explicit authorization.

Historical pass counts above remain snapshot-specific. Relevant source: `backend/package.json`, `frontend/package.json`, `backend/scripts/*test.js`, each skill's `tests/`.


## Local follow-up — three iEPMS DU models (2026-10-16)

The working tree now targets uploader v0.3.3, adding the user-confirmed Malaysia CelcomDigi models 2024 Celcomdigi BAU, Celcomdigi USP and Jendela TX Migration. This includes earlier uncommitted v0.3.2 fixes; source and approval are still dirty, while the recorded published gitlink remains397010e/v0.3.1. Services were not restarted. See [uploader contract](iepms-pr-upload-automation/SKILL_CONTRACT.md) for profile routing, validation and release steps. Do not interpret the October15 snapshot as proof of v0.3.3 deployment.


## Release update — v0.3.3 (2026-10-16)

Uploader v0.3.3 is now published on main at `93f303825fd03094e15019ded55b479633197292`. The accompanying platform release pins that exact commit and approves runtime fingerprint `0148ae1bba4eaedf41a509f3906cd115797dc707b677ba51772e55eefa5f1c83`. This supersedes earlier descriptions of v0.3.2/v0.3.3 as uncommitted local changes; dated live observations and unresolved W14/W15 blockers remain historical evidence and are not cleared by publishing.

The release includes the three new Malaysia CelcomDigi DU options and earlier safe row-validation/reporting fixes. Restart and inspect `/api/skills` for v0.3.3 and all seven models before claiming activation. No live new-model PR, tracker update or Implementation Plan write is part of this release.
