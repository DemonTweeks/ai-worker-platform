# create-pr-cd — Handover

## Assignment

Refactor `create-pr-cd` into a standalone, contract-compliant Python skill and migrate AI Worker Platform from its MW-specific adapter to the generic runner.

Do not redesign business logic during the wrapper refactor. Preserve current TSS/TI behavior and safety gates first.

## Read First

1. [ARCHITECTURE.md](ARCHITECTURE.md)
2. [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md)
3. [SKILL_CONTRACT.md](SKILL_CONTRACT.md)
4. [PLAN.md](PLAN.md)
5. [PENDING.md](PENDING.md)
6. [../SKILL_CONTRACT.md](../SKILL_CONTRACT.md)
7. The skill repository's `SKILL.md`, `README.md` and tests.

## Current Entry Points and Integration

- Python entrypoint: `skills/create-pr-cd/scripts/create_pr.py`
- Main implementation: `skills/create-pr-cd/scripts/create_pr_impl.py`
- PR-model baseline: `skills/create-pr-cd/config/pr_model_baseline.yaml`
- Baseline validation: `skills/create-pr-cd/scripts/pr_model_baseline.py`
- Candidate analysis/promotion: `skills/create-pr-cd/scripts/analyze_pr_model_change.py`, `skills/create-pr-cd/scripts/promote_pr_model.py`
- Platform manifest: `backend/src/workers/manifests/mwPrManifest.js`
- Process adapter: `backend/src/services/childProcessRunner.js`
- Job orchestration: `backend/src/services/prWorkerService.js`
- Frontend: `frontend/src/views/PRCreatorView.vue`

## Non-Negotiable Boundaries

- iEPMS parsing and validation remain in Python.
- All TSS/TI, SOW, PBOM, DU, contract and lifecycle logic remain in the skill.
- The platform validates contract structure and paths only.
- Skill-owned reference assets are versioned with the skill.
- Preserve the single-current PR-model version/SHA gate and rollback-safe promotion workflow.
- Preserve complete requested-site terminal reconciliation and fail-closed unaccounted behavior.
- Outputs are authoritative only when declared by `result.json`.
- Treat every submodule-pointer and platform integrity-pin update as an explicit promotion with recorded regression evidence.

## Recommended Delegation Packages

### Package A — Skill contract adapter

Deliver `skill.json`, input-envelope parsing, result writing and standalone contract tests inside the skill repository.

### Package B — Progress and cancellation

Add safe NDJSON events and cooperative cancellation without changing domain calculations.

### Package C — Golden parity

Build the fixture matrix and compare legacy versus contract entrypoint outputs.

### Package D — Generic platform integration

Route the approved skill manifest through the generic runner and preserve job/status/download behavior.

### Package E — Legacy removal

Remove MW-specific Node parsing, command construction, output interpretation and frontend payload code after Packages A-D pass.

Do not run Packages D and E before the skill contract and parity work is complete.

## Validation Commands

Use the commands supported by the skill repository at the checked-out revision. At minimum, validate:

```text
python <target-entrypoint> --input-manifest <fixture-input.json>
python -m pytest
python -m unittest tests.test_pr_model_baseline tests.test_pr_model_change_analyzer tests.test_pr_model_promotion
```

Platform validation must include its backend tests, contract schema tests and a synthetic-skill runner test. Do not make platform tests depend on real MW business fixtures except for an explicitly separated end-to-end compatibility suite.

## Completion Evidence

Provide:

- Approved manifest and skill version.
- Standalone invocation example.
- Contract test results.
- Golden parity report for TSS and TI.
- Platform generic-runner test results.
- List of removed MW-specific platform files or branches.
- Rollback procedure.
- Confirmation that source/reference files were not modified.

## Known Risks

- Submodule checkout and platform-approved fingerprint may drift.
- The checked-out skill is newer than the platform-approved engine pin; do not promote the pin without full business and baseline-governance regression evidence.
- PR-model candidate `4.1` remains review-required and must not replace current `4.0` without exact approval evidence and regression success.
- Production/UAT lifecycle behavior is safety-critical.
- Current Node output ingestion contains user-visible explanations that must be emitted safely by Python before removal.
- Planning and Operation Backoffice are not current CLI capabilities.
