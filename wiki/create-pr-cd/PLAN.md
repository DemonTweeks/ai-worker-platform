# create-pr-cd — Refactor Plan

## Objective

Make `create-pr-cd` independently compliant with the shared skill contract, then replace the existing MW-specific platform integration with the generic runner without changing domain results.

## Target Skill Layout

```text
create-pr-cd/
|-- skill.json
|-- SKILL.md
|-- requirements.txt
|-- src/
|   |-- main.py                 # contract adapter
|   |-- contract.py             # envelope/result helpers
|   `-- progress.py             # NDJSON events
|-- scripts/                    # existing domain pipeline during migration
|-- config/                     # skill-owned domain configuration
|-- knowledge_base/             # skill-owned rules and governance
|-- assets/                     # promoted templates/reference assets
`-- tests/
    |-- contract/
    |-- integration/
    `-- golden/
```

The exact folder migration is optional. The important boundary is that the contract adapter remains thin and the platform does not import skill internals.

## Target Functions

The contract layer should provide functions equivalent to:

```text
load_input_manifest(path)
validate_contract_envelope(envelope)
resolve_workspace_paths(envelope)
adapt_generation_request(envelope)
emit_progress(event)
collect_declared_outputs(generation_summary)
write_result(result_path, payload)
main()
```

Existing domain functions remain behind `adapt_generation_request()` and retain responsibility for workbook and business validation.

## Phase 0 — Freeze the Baseline

- Record the approved skill commit and runtime dependencies.
- Select representative TSS/TI and DU-profile fixtures.
- Capture ECC, review, warning and summary golden outputs.
- Record current production/UAT rejection behavior.

Exit: reproducible current results exist for parity testing.

## Phase 1 — Implement the Skill Contract

- Add `skill.json`.
- Add `--input-manifest` entrypoint.
- Validate safe workspace-relative paths.
- Map the envelope into the existing CLI/pipeline model.
- Write `result.json` on success, warning, failure and cancellation.

Exit: standalone contract invocation works without platform code.

## Phase 2 — Make Results Authoritative

- Enumerate all ECC and report outputs in `result.json`.
- Promote safe skill-owned metrics into `summary.metrics`.
- Emit structured warnings rather than requiring CSV interpretation.
- Keep detailed review files as downloadable outputs.

Exit: a generic caller can understand completion without inspecting domain files.

## Phase 3 — Add Progress and Cancellation

- Emit one JSON event per stable phase.
- Keep stdout domain-data safe.
- Add cooperative cancellation checks around expensive stages.
- Define partial-output cleanup and cancelled result behavior.

Exit: the platform can relay live state without inventing MW phases.

## Phase 4 — Integrate with the Generic Runner

- Register and approve the packaged skill version.
- Submit manifest-shaped files and parameters.
- Compare outputs with the current MW worker path.
- Run both paths in controlled validation until parity is proven.

Exit: generic execution passes all platform and skill contract tests.

## Phase 5 — Remove Platform Domain Logic

- Remove Node workbook parsing used only for MW domain validation.
- Remove Node site filtering and supported-scope constants.
- Remove TI CSV ingestion and zero-output policy interpretation.
- Remove the hardcoded `create_pr.py` command builder.
- Replace the fixed frontend payload with manifest-declared controls.

Exit: platform core has no MW, TSS, TI, SOW, PBOM or DU execution branch.

## Phase 6 — Decommission the Legacy Adapter

- Remove the old worker manifest and compatibility code.
- Keep migration notes and rollback instructions for one release window.
- Confirm job history and output downloads remain readable.

Exit: only the generic contract path is active.

## Verification Matrix

| Layer | Required verification |
| --- | --- |
| Contract | Manifest, input and result schema tests |
| Paths | Traversal, missing file and output escape tests |
| Domain | Existing unit and integration suite |
| Golden | Workbook content, names, grouping and review artefacts |
| Lifecycle | Production/UAT allow and deny cases |
| Runtime | Timeout, cancellation and abnormal process exit |
| Platform | Generic create/status/events/result/download flow |

## Rollback

Keep the existing adapter available behind a controlled configuration switch until golden parity and operational validation are complete. Rollback changes execution routing only; it must not alter the approved skill version or job data.
