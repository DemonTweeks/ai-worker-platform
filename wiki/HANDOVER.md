# AI Worker Platform - Handover

## Current State

- `main` contains the merged thin-wrapper runtime and reference workbench restoration through platform PR #98. `agent/manifest-driven-workbench-ui` adds the skill-owned presentation contract and final reference-layout refinements.
- `create-pr-cd` commit `6311922` is proposed in [Gumb-D/create-pr-cd#93](https://github.com/Gumb-D/create-pr-cd/pull/93).
- `tx-pr-auditor` commit `0c1894c` is proposed in [BL2ZteSolution/tx-pr-auditor#5](https://github.com/BL2ZteSolution/tx-pr-auditor/pull/5).
- `create-pr-cd-ran` commit `2756894` updates the existing BL2ZteSolution fork proposal in [ammarofficial11/create-pr-cd-ran#1](https://github.com/ammarofficial11/create-pr-cd-ran/pull/1).
- Merge the three skill PRs before merging the platform PR so every recorded submodule commit is reachable from its configured upstream repository.
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
- `skills/*/skill.json` and `skills/*/src/main.py`: standalone contracts.
- `launcher.ps1` and `deploy.sh`: production-only launch entrypoints without branch mutation; local development runs backend and Vite directly.
- `frontend/nginx.conf`: production-only same-origin proxy for `/fe/`, `/api/`, and `/ws`; health is available only through `/api/health`.
- `backend/src/skills/skillPackageService.js`: cross-platform text normalization with byte-exact binary package hashing.

## Compatibility Behavior

- `skill.json.ui` is presentation-only. Hidden values remain schema-valid request parameters, client validation checks only declared file constraints, and all workbook/business validation stays in standalone Python.
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
