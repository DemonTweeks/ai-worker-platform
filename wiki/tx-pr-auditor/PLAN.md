# tx-pr-auditor — Implementation Plan

## Implemented

- Restored the `Final PO + EPMS` public flow from UI baseline `4d4148d7`.
- Promoted the manifest to version 1.1.0.
- Added pinned `create-pr-cd` 4.0.0 as a recursive Git dependency.
- Added isolated Python orchestration for mandatory TSS and TI generation.
- Added dependency identity validation, safe failures, progress forwarding, and cancellation propagation.
- Kept the existing focused audit engine unchanged and ECC-only.
- Restored baseline upload/stage/notice copy through generic `skill.json.ui` metadata.
- Updated platform catalog, contract tests, approval coverage, and documentation.

## Runtime Layout

```text
tx-pr-auditor/
|-- skill.json
|-- src/main.py
|-- scripts/audit_final_po.py
|-- config/du_registry.json
|-- dependencies/create-pr-cd/   # pinned Git submodule
`-- tests/
```

## Acceptance Evidence

The supplied June 2026 demo inputs completed end to end:

- 94 TSS entitlement workbooks.
- 20 TI entitlement workbooks.
- 24 Final PO rows audited.
- 2 Normal, 3 Abnormal - Wrong PO, 19 Abnormal - Invalid PO.
- Authoritative report and 117 declared output files.
