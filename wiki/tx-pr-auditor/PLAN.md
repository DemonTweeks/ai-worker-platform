# tx-pr-auditor — Implementation Plan

## Completed Contract Work

- Added `skill.json` version `1.0.0`.
- Added `src/main.py --input-manifest`.
- Declared one Final PO and repeatable expected ECC inputs.
- Kept all audit mapping, identity, matching, classification, quantity, and evidence logic in Python.
- Added safe path, size, checksum, parameter, and result validation.
- Added NDJSON phases, 30-second heartbeats, and cancellation probes every 250 rows.
- Made the audit workbook, summary, and annotated ECC copies authoritative `result.json` outputs.
- Added a release-version and upstream SHA-256 policy for the nine-DU registry.
- Chose separate generator and auditor jobs; no composite sequence is owned by the platform.
- Added contract, real-workbook integration, parity, cancellation, and capacity tests.

## Current Layout

```text
tx-pr-auditor/
|-- skill.json
|-- src/main.py
|-- scripts/audit_final_po.py
|-- config/du_registry.json
`-- tests/
    |-- test_skill_contract.py
    |-- test_skill_contract_integration.py
    `-- benchmark_large_workbook.py
```

## Capacity Baseline

The declared Final PO limit is 10,000 rows. The repeatable synthetic benchmark processed 10,000 results in 6.708 seconds with 33.63 MiB traced peak memory. Rebenchmark before raising the manifest limit.

The platform's rollback-only auditor orchestration has been removed. No current focused-auditor contract work remains.
