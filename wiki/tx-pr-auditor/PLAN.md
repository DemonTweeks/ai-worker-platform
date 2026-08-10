# tx-pr-auditor — Refactor Plan

## Objective

Make the focused Final PO-versus-ECC auditor compliant with the shared skill contract, then remove audit-specific execution and output interpretation from AI Worker Platform.

## Target Skill Layout

```text
tx-pr-auditor/
|-- skill.json
|-- SKILL.md
|-- requirements.txt
|-- src/
|   |-- main.py                 # contract adapter
|   |-- contract.py             # envelope/result helpers
|   `-- progress.py             # NDJSON events
|-- scripts/
|   `-- audit_final_po.py       # existing domain pipeline
|-- config/
|   `-- du_registry.json
`-- tests/
    |-- contract/
    |-- integration/
    `-- golden/
```

The current pipeline may remain in `scripts/` during migration. The target boundary matters more than an immediate internal rewrite.

## Target Functions

The contract layer should provide functions equivalent to:

```text
load_input_manifest(path)
validate_contract_envelope(envelope)
resolve_final_po(envelope)
resolve_expected_ecc_files(envelope)
adapt_audit_arguments(envelope)
emit_progress(event)
build_result(audit_summary, outputs)
write_result(path, payload)
main()
```

Workbook mapping, canonicalization, classification and quantity logic remain in the domain pipeline.

## Phase 0 — Freeze the Baseline

- Capture representative Final PO and ECC fixtures.
- Record golden audit workbook and JSON summary outputs.
- Include all classifications, ambiguity cases and partial duplicate quantity.
- Record current annotated ECC behavior.

Exit: current behavior is reproducible.

## Phase 1 — Implement the Focused Skill Contract

- Add `skill.json`.
- Add `--input-manifest` entrypoint.
- Resolve one Final PO and multiple ECC files from the envelope.
- Reject undeclared and unsafe paths.
- Map optional parameters into the existing pipeline.
- Write result envelopes for every terminal status.

Exit: the focused auditor runs standalone using the standard contract.

## Phase 2 — Make Results Authoritative

- Declare the audit workbook and summary.
- Declare every annotated ECC copy when requested.
- Include safe classification metrics in the result summary.
- Emit structured domain warnings and errors.

Exit: a generic caller requires no audit-specific output parser.

## Phase 3 — Add Progress and Cancellation

- Emit progress for stable batch stages.
- Add cancellation checks between expensive operations.
- Ensure sources are never modified.
- Define cancelled-result and partial-output cleanup behavior.

Exit: process state is observable without platform-defined audit stages.

## Phase 4 — Resolve Product Composition

Choose and implement one:

- Separate jobs where the user supplies generated ECC; or
- A standalone composite skill that runs pinned `create-pr-cd` dependencies before the focused auditor.

For a composite skill, define dependency manifests, intermediate output handling, failure propagation and combined progress inside Python.

Exit: the current product journey has a contract-compliant replacement.

## Phase 5 — Integrate with the Generic Runner

- Register and approve the focused and optional composite skill versions.
- Execute through generic job APIs.
- Validate upload, status, events, result and download behavior.
- Compare the new product flow with the current adapter.

Exit: platform integration passes without audit-specific runner logic.

## Phase 6 — Remove Platform Domain Logic

- Remove hardcoded entitlement sequencing.
- Remove audit-specific workspace paths and CLI construction.
- Remove fixed output-name discovery and classification normalization.
- Replace the dedicated request payload with manifest-declared inputs.

Exit: platform core has no Final PO column, audit reason-code or classification branch.

## Verification Matrix

| Layer | Required verification |
| --- | --- |
| Contract | Manifest, input and result schema tests |
| Paths | Traversal, undeclared files and output escape tests |
| Domain | Current unit/integration suite |
| Classification | Normal, Invalid, Wrong, Duplicate and partial duplicate |
| Identity | Unknown, conflict and ambiguity cases |
| Golden | Audit workbook, summary and annotated ECC parity |
| Runtime | Large files, timeout, cancellation and abnormal exit |
| Platform | Generic create/status/events/result/download flow |

## Rollback

Keep the current adapter available behind controlled routing until both focused-skill parity and the chosen composite product flow are validated. Do not remove old paths in the same change that first introduces the new workflow.
