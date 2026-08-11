# AI Worker Platform - Handover

## Current State

- `main` contains the merged thin-wrapper refactor. `refactor/unified-runtime-profiles` prepares the single-branch local/production runtime model for merge into `main`.
- `create-pr-cd` commit `db416a3` is proposed in [Gumb-D/create-pr-cd#81](https://github.com/Gumb-D/create-pr-cd/pull/81).
- `tx-pr-auditor` commit `929ffe1` is proposed in [BL2ZteSolution/tx-pr-auditor#4](https://github.com/BL2ZteSolution/tx-pr-auditor/pull/4).
- `create-pr-cd-ran` commit `dd28ba8` is proposed from the BL2ZteSolution fork in [ammarofficial11/create-pr-cd-ran#1](https://github.com/ammarofficial11/create-pr-cd-ran/pull/1).
- Merge the three skill PRs before merging the platform PR so every recorded submodule commit is reachable from its configured upstream repository.
- Firebase is authoritative for job lifecycle and durable queue ownership.
- The active registry contains only approved generic Python skill packages.
- Environment-specific Git branches are no longer part of the runtime design. Both profiles launch from the current `main` checkout.
- All backend and frontend environment values are centralized in `config/env/`; real profile files are intentionally untracked.

## Implemented Components

- `backend/src/skills/skillPackageService.js`: manifest and runtime-package approval.
- `backend/src/skills/genericSkillJobService.js`: generic multipart submission and input envelopes.
- `backend/src/skills/genericSkillRunner.js`: process supervision and authoritative result ingestion.
- `backend/src/queue/jobQueue.js`: Firebase leases, heartbeats, cancellation state, and restart reconciliation.
- `frontend/src/views/GenericSkillView.vue`: manifest-driven launch form for all active skills using the productized workbench visual structure from baseline `4d4148d7`; do not reintroduce legacy domain logic to preserve that appearance.
- `skills/*/skill.json` and `skills/*/src/main.py`: standalone contracts.
- `launcher.ps1` and `deploy.sh`: production-only launch entrypoints without branch mutation; local development runs backend and Vite directly.
- `frontend/nginx.conf`: production-only same-origin proxy for `/fe/`, `/api/`, and `/ws`; health is available only through `/api/health`.
- `backend/src/skills/skillPackageService.js`: cross-platform text normalization with byte-exact binary package hashing.

## Compatibility Behavior

- Historical jobs, metadata, warnings, and retained file downloads remain readable.
- Rerunning a generic job rebuilds a new request from retained `skill_input` files and stored parameters.
- Rerunning a historical legacy job returns `LEGACY_RERUN_REQUIRES_NEW_REQUEST` with a safe instruction to submit through an approved skill.
- `POST /api/jobs` returns `LEGACY_JOB_CREATION_RETIRED`; new work uses `/api/skills/:skillId/jobs`.

## Validation Evidence

- Durable queue ownership/restart suite: passed.
- Generic catalog/submission/result suite: passed with three approved packages.
- Real generic CD create execution: completed with zero unaccounted work and 90 outputs.
- TX unit/contract suite: 31 passed; real workbook integration passed.
- TX 10,000-row baseline: 6.708 seconds and 33.63 MiB traced peak.
- Real generic RAN sample job: completed with five tracked outputs.
- Complete active backend suite: passed, including durable queue, concurrent idempotency, contract/rerun compatibility, and both real creator executions.
- Cross-platform skill fingerprint normalization regression passed; all approved packages validate on Windows.
- Frontend: 19 files and 83 tests passed; production build and all 11 route-smoke URLs passed.
- Node workbook/report dependencies `xlsx`, `exceljs`, and `archiver` were removed with the retired domain services.

## Next Action

Rotate the credential exposed by the former production branch, provision ignored `config/env/production.env`, validate on the production host, and merge the unified runtime-profile branch into `main`. See [PENDING.md](PENDING.md).
