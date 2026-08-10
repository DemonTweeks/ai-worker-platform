# tx-pr-auditor — Skill Contract

## Contract Status

This is the proposed skill-specific contract for the future generic runner. The current CLI remains authoritative until migration and parity validation are complete.

The shared platform contract is defined in [../SKILL_CONTRACT.md](../SKILL_CONTRACT.md).

## Identity

| Field | Value |
| --- | --- |
| Skill ID | `tx-pr-auditor` |
| Runtime | Python |
| Current entrypoint | `scripts/audit_final_po.py` |
| Target entrypoint | `src/main.py` or an equivalent thin adapter |
| Entitlement input | Generated ECC only |
| Result contract | `1.0` target |

## Proposed Manifest

```json
{
  "schemaVersion": "1.0",
  "skillId": "tx-pr-auditor",
  "displayName": "TX PR Auditor",
  "version": "<skill-release>",
  "runtime": {
    "type": "python",
    "entrypoint": "src/main.py",
    "minimumPython": "3.11"
  },
  "inputs": {
    "files": [
      {
        "name": "final_po",
        "required": true,
        "multiple": false,
        "acceptedExtensions": [".xlsx", ".xlsm"]
      },
      {
        "name": "expected_ecc",
        "required": true,
        "multiple": true,
        "acceptedExtensions": [".xlsx", ".xlsm"]
      }
    ],
    "parametersSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "filterYear": { "type": "integer" },
        "filterMonth": { "type": "integer", "minimum": 1, "maximum": 12 },
        "finalPoSheet": { "type": "string" },
        "finalPoHeaderRow": { "type": "integer", "minimum": 1 },
        "annotateEccOutput": { "type": "boolean", "default": false }
      }
    }
  },
  "execution": {
    "timeoutSeconds": 3600,
    "supportsCancellation": true
  },
  "resultContractVersion": "1.0"
}
```

## Input Rules

The focused auditor accepts:

- Exactly one Final PO workbook.
- One or more generated ECC workbooks.
- Optional audit-period and layout parameters.

It does not accept iEPMS or a PR model. A combined product workflow must use a separately declared composite skill.

The platform validates declared file constraints and safe paths only. Python validates sheets, headers, identity, cross-file consistency, parameter combinations and audit eligibility.

## Invocation

```text
python src/main.py --input-manifest <path-to-input.json>
```

All input and output paths are workspace-relative. The skill must not scan arbitrary platform directories for files.

## Progress Events

Recommended stable phases:

- `domain_validation`
- `workbook_reading`
- `canonicalization`
- `entitlement_matching`
- `audit_classification`
- `duplicate_resolution`
- `report_generation`
- `result_finalization`

The platform relays these values without understanding their domain meaning.

## Result Outputs

The result may declare:

- `audit_result_workbook`
- `audit_summary`
- Repeated `annotated_ecc_workbook` outputs

The result summary may include skill-owned safe metrics for Normal, Invalid, Wrong and Duplicate results. Platform persistence must keep these metrics opaque.

## Warning and Error Ownership

The skill owns stable warning and error codes for invalid workbooks, missing entitlement, conflicting identity, ambiguous evidence and report failures. The result uses generic platform-facing categories while retaining skill-specific codes.

## Standalone Compliance

The contract is accepted only when standalone tests cover:

- Valid Final PO and ECC comparison.
- Multiple ECC files.
- Invalid, Wrong, Duplicate and Normal cases.
- Partial duplicate quantities.
- Ambiguous DU, scope and subcontractor cases.
- Period filters and layout overrides.
- Annotated ECC copies without source mutation.
- Result schema, cancellation and safe paths.
- Golden audit workbook parity.
