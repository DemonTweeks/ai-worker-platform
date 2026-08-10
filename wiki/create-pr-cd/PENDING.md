# create-pr-cd — Pending Work

This file tracks work deferred until the thin skill-wrapper refactor begins.

## Implemented Baseline — PR-model Governance and Site Reconciliation

Current `main` now enforces one production PR model through `config/pr_model_baseline.yaml`, validates its SHA-256 before generation, provides candidate analysis and rollback-safe promotion tooling, and fails closed on an invalid baseline. It also reconciles every requested site to a terminal disposition and fails on engine-unaccounted results. These controls are established skill behavior and must be preserved during the wrapper refactor.

## P-001 — Add the Standard Contract Entrypoint

Status: Pending

Add a thin Python entrypoint that accepts `--input-manifest`, validates the shared envelope, calls the existing generation pipeline and writes `result.json`.

Completion:

- Direct standalone execution succeeds.
- Existing business modules remain skill-owned.
- Every generated deliverable is declared in the result.

## P-002 — Add a Skill-Owned Manifest

Status: Pending

Create versioned `skill.json` metadata with the runtime, input file, parameters, timeout, cancellation and result-contract version.

Open decision: whether reference-asset overrides remain public inputs or become development-only controls.

## P-003 — Move All Domain Prevalidation Behind Python

Status: Pending

Remove the need for platform-side iEPMS parsing, header interpretation and site filtering. Generic extension, size, checksum and safe-path checks remain in the platform.

Files currently involved include:

- `backend/src/services/iepmsParser.js`
- `backend/src/services/prevalidationService.js`
- `backend/src/services/siteFilteringService.js`
- `backend/src/services/engineHeaderHashService.js`

## P-004 — Replace Domain-Specific Output Ingestion

Status: Pending

The platform currently recognizes TI review and duplicate reports, discovers `result_reconciliation` from output JSON, and reconstructs summaries. Replace this compatibility ingestion with authoritative outputs, warnings, metrics and reconciliation directly in the standard Python `result.json`.

Files currently involved include:

- `backend/src/services/tiResultIngestionService.js`
- `backend/src/services/zeroOutputPolicyService.js`
- `backend/src/services/resultReconciliationService.js`
- `backend/src/services/outputCollector.js`
- `backend/src/services/summaryBuilder.js`

## P-005 — Emit Progress and Cancellation

Status: Pending

Emit NDJSON progress for stable phases and observe a generic cancellation mechanism. Define cleanup behavior for partial output.

## P-006 — Unify Skill Version Approval

Status: Pending

The current platform manifest pins a commit, fingerprint and internal runtime-file list while the submodule can drift independently. Replace this with one approved skill package/version and fail clearly on mismatch.

The approved package must include `config/pr_model_baseline.yaml`, `scripts/pr_model_baseline.py`, and the pinned production workbook. Platform skill approval and PR-model approval are distinct gates: the platform verifies package identity, while Python verifies its internal model baseline.

## P-007 — Prove Golden Parity

Status: Pending

Before removing the current worker adapter, compare current and contract-entrypoint results for:

- TSS and TI.
- Multiple DU profiles.
- Production and UAT modes.
- Site selection.
- Review-required and duplicate-skipped cases.
- Workbook values, sheets, naming, grouping and 30-site splitting.
- PR-model baseline mismatch and controlled-promotion safety.
- Requested-site reconciliation across every terminal disposition.

## P-008 — Remove MW-Specific Platform Branches

Status: Blocked by P-001 through P-007

After parity, remove the hardcoded command builder, worker service branches and fixed frontend request shape. The generic runner must be able to execute the skill entirely from its manifest.

## P-009 — Future Scope Capability Policy

Status: Pending business and skill work

Planning and Operation Backoffice are documented but not current CLI capabilities. Add them only after the Python skill implements, tests and declares them. No platform change should be required beyond reading the new approved manifest version.
