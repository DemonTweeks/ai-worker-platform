# tx-pr-auditor — Pending Work

This file tracks work deferred until the thin skill-wrapper refactor begins.

## P-001 — Add the Standard Contract Entrypoint

Status: Pending

Add a thin Python entrypoint that accepts `--input-manifest`, maps declared Final PO/ECC files into the existing pipeline and writes authoritative `result.json`.

## P-002 — Add a Skill-Owned Manifest

Status: Pending

Create `skill.json` declaring one Final PO file, multiple expected ECC files, audit parameters, timeout, cancellation and result-contract version.

## P-003 — Decide Composite Workflow Ownership

Status: Pending architecture decision

Choose one product model:

- Separate `create-pr-cd` and `tx-pr-auditor` jobs; or
- A dedicated standalone `tx-pr-audit-workflow` composite skill.

Do not retain `create-pr-cd` TSS/TI sequencing in the generic platform core.

## P-004 — Replace Domain-Specific Platform Orchestration

Status: Blocked by P-001 through P-003

Current targets:

- `backend/src/workers/adapters/prAuditorAdapter.js`
- `backend/src/workers/prAuditorWorkspaceService.js`
- `backend/src/workers/prAuditorOutputIngestionService.js`
- `backend/src/workers/manifests/prAuditorManifest.js`
- `frontend/src/views/PRAuditorView.vue`

Remove them only after equivalent contract execution and product flow exist.

## P-005 — Make the Result Envelope Authoritative

Status: Pending

Declare the audit workbook, summary and annotated ECC copies in `result.json`. Emit safe metrics directly instead of requiring Node normalization of classification keys.

## P-006 — Add Progress and Cancellation

Status: Pending

Emit NDJSON events for the existing pipeline stages and define cooperative cancellation around workbook reading, comparison and report generation.

## P-007 — Define DU Registry Compatibility

Status: Pending

Specify how `config/du_registry.json` is versioned against `create-pr-cd` identity/profile/view output. Drift must fail clearly without making the platform compare domain registries.

## P-008 — Prove Golden Parity

Status: Pending

Cover:

- Normal, Invalid, Wrong and Duplicate results.
- Full and partial duplicate quantities.
- Multiple ECC files and scopes.
- Unknown, conflicting and ambiguous DU identity.
- Subcontractor mismatch.
- Period filtering.
- Multilingual and historical mojibake Final PO headers.
- Audit evidence and annotated ECC outputs.

## P-009 — Large Workbook Behavior

Status: Pending

Measure memory, runtime, progress cadence and cancellation on production-size workbooks. Define limits in the manifest based on evidence.
