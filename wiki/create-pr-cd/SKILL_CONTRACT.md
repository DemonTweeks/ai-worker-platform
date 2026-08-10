# create-pr-cd — Skill Contract

## Contract Status

This is the proposed skill-specific contract for the future generic runner. The current CLI remains authoritative until the migration is implemented and validated.

The shared platform contract is defined in [../SKILL_CONTRACT.md](../SKILL_CONTRACT.md).

## Identity

| Field | Value |
| --- | --- |
| Skill ID | `create-pr-cd` |
| Runtime | Python |
| Current entrypoint | `scripts/create_pr.py` |
| Target entrypoint | `src/main.py` or an equivalent thin adapter |
| Current scopes | `TSS`, `TI` |
| Result contract | `1.0` target |

## Proposed Manifest

```json
{
  "schemaVersion": "1.0",
  "skillId": "create-pr-cd",
  "displayName": "Create TX PR ECC",
  "version": "<skill-release>",
  "runtime": {
    "type": "python",
    "entrypoint": "src/main.py",
    "minimumPython": "3.11"
  },
  "inputs": {
    "files": [
      {
        "name": "site_data",
        "required": true,
        "multiple": false,
        "acceptedExtensions": [".xlsx", ".xlsm"]
      }
    ],
    "parametersSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": ["scope", "selectionMode"],
      "properties": {
        "scope": { "type": "string", "enum": ["TSS", "TI"] },
        "selectionMode": { "type": "string", "enum": ["all_sites", "site_codes"] },
        "siteCodes": { "type": "array", "items": { "type": "string" } },
        "nonProductionUat": { "type": "boolean", "default": false }
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

The platform validates only declared file presence, extension, size, checksum and safe path. The skill validates:

- Workbook structure and supported layout.
- Project and DU-profile identity.
- Selection-mode consistency.
- Scope eligibility.
- Business reference compatibility.
- Production/UAT lifecycle rules.

`siteCodes` is required when `selectionMode` is `site_codes` and must be absent or ignored when the mode is `all_sites`. That cross-field meaning belongs to Python.

Reference assets should be packaged with the skill by default. PR model, ECC template, mapping and policy overrides must be declared explicitly if they remain supported; the platform must not silently inject them.

## Invocation

```text
python src/main.py --input-manifest <path-to-input.json>
```

The skill reads only workspace-relative paths from the envelope and writes only under the declared output directory.

## Progress Events

Recommended stable phases:

- `domain_validation`
- `source_discovery`
- `canonicalization`
- `profile_resolution`
- `eligibility`
- `line_item_matching`
- `ecc_generation`
- `result_finalization`

Phase names describe skill work. The platform stores and relays them without business interpretation.

## Result Outputs

The result envelope may declare multiple files:

- `ecc_workbook`
- `review_required_report`
- `ignored_or_duplicate_report`
- `contract_review_report`
- `execution_summary`

Each declared path must exist, remain inside the workspace and include a media type and display name.

## Warning and Error Ownership

The skill owns stable warning and error codes, including lifecycle, invalid-input, ambiguous-data and review-required explanations. Platform categories remain generic:

- `domain_input`
- `domain_processing`
- `dependency`
- `cancelled`
- `internal`

## Standalone Compliance

The contract is accepted only when the same invocation works without AI Worker Platform and tests cover:

- Valid TSS and TI generation.
- Selected-site and all-site modes.
- Invalid workbook rejection.
- Production and UAT gates.
- Review-required output.
- Result schema and output declarations.
- Cancellation and safe-path enforcement.
- Golden ECC parity.
