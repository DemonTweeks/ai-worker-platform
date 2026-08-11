# tx-pr-auditor — Handover

## Current State

- Branch: `agent/align-du-registry`.
- Contract changes are uncommitted.
- Direct domain CLI remains `scripts/audit_final_po.py`.
- Platform contract CLI is `src/main.py --input-manifest`.
- Manifest version is `1.0.0` and result contract is `1.0`.

## Important Files

- `skill.json`: public inputs, limits, cancellation, and DU compatibility declaration.
- `src/main.py`: contract and authoritative result adapter.
- `scripts/audit_final_po.py`: focused Final PO-versus-ECC business pipeline.
- `config/du_registry.json`: nine identities, registry version, source registry SHA, promotion policy.
- `tests/benchmark_large_workbook.py`: capacity evidence.

## Decisions Already Made

- The auditor consumes Final PO and generated ECC only.
- It does not consume iEPMS or the PR model.
- Generator and auditor are separate jobs.
- Any composite workflow is a separate standalone skill.
- Registry compatibility is a skill release gate, not a platform domain comparison.
- Final PO workload limit is 10,000 rows until new evidence supports promotion.

## Evidence

- 31 focused unit and contract tests passed.
- Real workbook standalone contract integration passed.
- Nine DU identities and profile/view/status parity passed.
- 10,000-row benchmark: 6.708 seconds and 33.63 MiB traced peak.
- Cooperative cancellation is checked every 250 rows in long loops.
