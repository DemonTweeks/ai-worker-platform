# PR Auditor Autonomous Run State

- Mission: `pr-auditor-platform-integration`
- Updated: `2026-07-03`
- Source repo: `C:\dev\ai-worker-platform`
- Feature worktree: `C:\dev\ai-worker-platform-pr-auditor`
- Feature branch: `feature/pr-auditor-platform-integration`
- Baseline: `origin/main` at `ec82e58f26055146a3b2403d6106e8809e994ad3`
- Current phase: `phase-0`
- Current bounded step: `2. Integration contract and changed-file allowlist`
- Completed: `false`
- Acceptance status: `in_progress`
- Human acceptance status: `not_started`
- Next action: Implement bounded Step 3 by wiring `pr-auditor` into backend worker registration and job creation flow without altering MW PR, RAN PR, or PR Creator behavior.

## Engine Status

- Expected engine path: `skills/tx-pr-auditor`
- Candidate repository: `https://github.com/BL2ZteSolution/tx-pr-auditor.git`
- Candidate commit: `5ef4485c9662384356e93960fe7a2b101f452349`
- Pin status: `unapproved_pending_data_safety_review`
- Safety note: the candidate repo versions `input/pr_model.xlsx`, and sampled rows look like real PR model content rather than obviously synthetic fixtures. Do not pin or vendor this engine until safety is resolved and documented.

## Platform Discovery Highlights

- Backend worker registry currently exposes `mw-pr` and `ran-pr` only.
- Job creation currently splits into MW and RAN paths in `backend/src/services/jobService.js`.
- Upload prevalidation currently supports `mw-export`, `ran-bom`, and `ran-epms`.
- RAN worker isolation copies approved engine directories into a per-job workspace and stages current job uploads explicitly.
- Frontend home flow currently presents MW and RAN inside one PR Creator workbench, so PR Auditor will need a dedicated top-level entry point rather than another mode.

## Step 2 Outputs

- Integration contract written in `docs/pr-auditor-platform-integration/integration-contract.md`.
- Exact file-level change map captured in `execution-plan.md`.
- PR Auditor-specific job payload, upload kinds, file types, summary shape, and UI constraints are now explicit and ready for implementation.
