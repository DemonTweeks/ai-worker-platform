# EPIC 8.1 Scope Payload Hotfix Result

- Date/time: 2026-05-20 02:09:12 +08:00
- Epic number: 8.1
- Task name: Wire frontend scope to worker execution
- Git branch: main
- Latest git status summary before archive: modified backend Job model/job service/worker runner files and frontend job API/progress/summary/home files; `.env` remains ignored.

## Task Scope

Implemented only the TSS/TI scope payload hotfix before EPIC 9. No job history/detail UI, admin UI, create-pr-cd business rule change, LLM credential change, or `.env` change was made.

## Root Cause

EPIC 8 added the TSS/TI selector as frontend-only state. The backend create-job API did not accept/store a PR scope, and EPIC 5 runner executed both supported scopes internally instead of using the user's selected scope.

## Backend Changes

- Added `prScope` to `Job` with enum `TSS | TI` and default `TSS`.
- Added create-job validation for `prScope`.
- Persisted `prScope` in the Job record and job request manifest.
- Included `prScope` in job summary/detail serialization.
- Passed request/job `prScope` into PR Worker execution.
- Updated child process runner to execute only the selected scope.

## Frontend Changes

- `createJob` API now sends `prScope`.
- HomeView sends the selected TSS/TI value when creating a job.
- Job progress and final summary display the selected/stored scope.

## Validation Rules

- Accepted values: `TSS`, `TI`.
- Missing `prScope` defaults to `TSS` for backward compatibility with clients that do not send the new field.
- Invalid `prScope` returns a validation error before upload consumption or job creation.

## Worker CLI Scope Mapping

The selected `prScope` maps directly to:

```text
--scope TSS
```

or

```text
--scope TI
```

The create-pr-cd script was not modified.

## Files Created / Modified

- Modified: `backend/src/models/Job.js`
- Modified: `backend/src/services/jobService.js`
- Modified: `backend/src/services/prWorkerService.js`
- Modified: `backend/src/services/childProcessRunner.js`
- Modified: `frontend/src/api/jobApi.js`
- Modified: `frontend/src/views/HomeView.vue`
- Modified: `frontend/src/components/JobProgress.vue`
- Modified: `frontend/src/components/FinalSummary.vue`

## Commands Executed

- `git status --short --ignored .env`
- `rg --files`
- `Get-Content backend/src/routes/jobRoutes.js`
- `Get-Content backend/src/services/jobService.js`
- `Get-Content backend/src/models/Job.js`
- `Get-Content backend/src/services/prWorkerService.js`
- `Get-Content backend/src/services/childProcessRunner.js`
- `Get-Content frontend/src/api/jobApi.js`
- `Get-Content frontend/src/views/HomeView.vue`
- backend import smoke test
- `npm run build`
- `node tmp-epic81-verify.js`
- cleanup verification against MongoDB
- `git diff --check`
- port checks for 8000 and 3000

## Test Results

- Backend imports passed.
- Frontend build passed.
- `/health` worked inside controlled verification.
- Invalid `prScope` was rejected.
- `buildCommand` mapped `scope=TI` to `--scope TI`.
- Create-job accepted `scope=TSS`.
- Create-job accepted `scope=TI`.
- TSS scope was stored in Job.
- TI scope was stored in Job.
- TSS worker execution completed.
- TI worker execution completed.
- TSS WebSocket progress completed.
- Job detail returned `prScope`.
- Re-Ask still worked.
- ZIP download still worked for completed TSS job.
- Temporary jobs/files/assets/warnings/reviews were cleaned.

## Issues / Risks / Assumptions

- Defaulting missing `prScope` to `TSS` is the explicit compatibility choice for older clients. New frontend clients always send the selected scope.
- The previous runner behavior executed both TSS and TI; this hotfix intentionally changes worker execution to the selected user scope to match the UI and CLI contract.
- Local `.env` remains ignored and was not printed, modified, staged, or committed.

## Whether TSS Was Verified

Yes. A real TSS job was created, stored with `prScope=TSS`, executed, emitted completion over WebSocket, and produced downloadable ZIP output.

## Whether TI Was Verified

Yes. A real TI job was created, stored with `prScope=TI`, and completed with the available test assets/data.

## Whether create-pr-cd Was Untouched

Yes. No files under `skills/create-pr-cd/` were modified.

## Git Commit / Push Summary

Pending at time of archive creation.

## Recommended Next Step

Proceed to EPIC 9: Job History / Job Detail UI layer.

## Final Acceptance Status

EPIC 8.1 ACCEPTED — ready for EPIC 9
