# AI Worker Platform — Skill Contract

> Status: implemented for `create-pr-cd` 4.0.0 and `tx-pr-auditor` 1.1.0.

## 1. Purpose

This contract allows AI Worker Platform to run independent Python skills without owning their technical or business logic.

A compliant skill must:

- Run standalone through Python.
- Declare its interface through a versioned manifest.
- Accept a standard input envelope.
- Emit standard progress events.
- Write a standard result envelope.
- Keep all domain validation and processing inside the skill.

## 2. Recommended Package Layout

```text
skills/<skill-id>/
|-- skill.json
|-- SKILL.md
|-- requirements.txt            # or pyproject.toml
|-- src/
|   `-- main.py
|-- config/                     # skill-owned domain configuration
|-- assets/                     # skill-owned templates and reference files
`-- tests/                      # unit, integration and golden tests
```

The platform reads `skill.json`. Other files remain owned by the skill.

## 3. Skill Manifest

Example `skill.json`:

```json
{
  "schemaVersion": "1.0",
  "skillId": "example-worker",
  "displayName": "Example Worker",
  "version": "1.2.0",
  "runtime": {
    "type": "python",
    "entrypoint": "src/main.py",
    "minimumPython": "3.11"
  },
  "inputs": {
    "files": [
      {
        "name": "source",
        "required": true,
        "multiple": false,
        "acceptedExtensions": [".xlsx"]
      }
    ],
    "parametersSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {}
    }
  },
  "ui": {
    "schemaVersion": "1.0",
    "uploads": {
      "source": {
        "title": "Source Upload",
        "label": "Source workbook",
        "validationRequired": true
      }
    },
    "parameters": {
      "internalFlag": { "hidden": true, "default": false }
    }
  },
  "execution": {
    "timeoutSeconds": 3600,
    "supportsCancellation": true
  },
  "resultContractVersion": "1.0"
}
```

The platform validates manifest structure, paths, supported contract versions, and administrative approval. It does not interpret the business meaning of inputs or parameters.

### 3.1 Optional UI presentation contract

`ui.schemaVersion: "1.0"` lets an approved skill present its existing input contract in the shared workbench without creating a skill-specific Vue view. It may declare:

- Hero, workbench, status-chip, and action copy.
- Upload titles, labels, hints, client-side file-contract validation, and ordering.
- Segmented, select, text, textarea, and checkbox controls for declared parameters.
- Parameter ordering, upload-column groups, conditional visibility, and configuration detail placement.
- Presentation-only workflow stages and notices.
- UI defaults and hidden parameters, provided every submitted value remains valid under `inputs.parametersSchema`.

The UI contract cannot add executable inputs, change file or parameter validation rules, invoke domain prevalidation, or describe platform-owned business decisions. Hidden fields are still submitted with their declared default unless `omitWhenHidden` is explicitly used for a conditionally invisible field. File validation in the workbench covers only manifest constraints such as extension, count, and size; workbook and business validation remains inside the Python skill.

## 4. Input Envelope

The platform writes an input manifest into the isolated job workspace:

```json
{
  "schemaVersion": "1.0",
  "jobId": "JOB-20260810-001",
  "skill": {
    "skillId": "example-worker",
    "version": "1.2.0"
  },
  "parameters": {},
  "files": [
    {
      "name": "source",
      "path": "input/source.xlsx",
      "originalFileName": "source.xlsx",
      "size": 12345,
      "sha256": "..."
    }
  ],
  "paths": {
    "workspace": ".",
    "output": "output",
    "result": "result.json"
  }
}
```

All paths are workspace-relative. A skill must not require absolute platform repository paths.

## 5. Invocation Contract

The standard invocation is:

```text
python <entrypoint> --input-manifest <path-to-input.json>
```

Requirements:

- The current working directory is the isolated job workspace.
- The skill reads domain inputs only through paths in the input envelope.
- The skill writes outputs only under the declared output directory.
- The skill writes its final envelope to the declared result path.
- The same command must work outside the platform.

## 6. Progress Event Contract

The skill may write newline-delimited JSON events to standard output:

```json
{"type":"progress","timestamp":"2026-08-10T08:00:00.000Z","phase":"domain_validation","percent":10,"message":"Validating input."}
```

Standard fields:

- `type`: `progress`, `warning`, or `log`
- `timestamp`: ISO 8601 UTC timestamp
- `phase`: skill-owned stable code
- `percent`: optional number from 0 to 100
- `message`: safe user-facing message

Standard output must not contain secrets, raw personal data, or unrestricted tracebacks. Non-JSON diagnostic output is treated as protected technical logging.

## 7. Result Envelope

Every completed invocation writes `result.json`:

```json
{
  "schemaVersion": "1.0",
  "jobId": "JOB-20260810-001",
  "skillId": "example-worker",
  "skillVersion": "1.2.0",
  "status": "succeeded",
  "summary": {
    "message": "Processing completed.",
    "metrics": {}
  },
  "reconciliation": {
    "requestedCount": 10,
    "generatedCount": 8,
    "reviewRequiredCount": 1,
    "approvedIgnoredCount": 1,
    "duplicateBlockedCount": 0,
    "failedCount": 0,
    "unaccountedCount": 0
  },
  "outputs": [
    {
      "name": "result",
      "path": "output/result.xlsx",
      "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "displayName": "Result.xlsx"
    }
  ],
  "warnings": [],
  "error": null
}
```

Allowed result statuses:

- `succeeded`
- `succeeded_with_warning`
- `failed`
- `cancelled`

The platform validates the JSON schema, job and skill identity, allowed status, safe paths, and file existence. It does not inspect domain output content.

`reconciliation` is optional. When present, every field is a non-negative integer and the declared dispositions plus `unaccountedCount` must equal `requestedCount`. The skill determines each item's disposition. The platform only enforces arithmetic consistency and rejects clean completion when `unaccountedCount` is non-zero. A non-zero review, ignored, duplicate, or failed count cannot be represented as clean `succeeded`; it is surfaced as `succeeded_with_warning` unless the result itself is failed.

## 8. Warning Contract

Warnings are skill-owned, safe domain explanations:

```json
{
  "code": "DOMAIN_WARNING_CODE",
  "message": "A safe explanation for the user.",
  "details": {}
}
```

The platform stores and displays warnings without implementing their business meaning.

## 9. Error Contract

A failed result contains:

```json
{
  "code": "SKILL_INPUT_INVALID",
  "category": "domain_input",
  "message": "The supplied workbook is not valid for this skill.",
  "retryable": false,
  "details": {}
}
```

Standard platform-facing categories:

- `domain_input`
- `domain_processing`
- `dependency`
- `cancelled`
- `internal`

The skill may define its own stable error codes. User-facing messages must be safe. Tracebacks belong in skill logs, not the result envelope.

## 10. Exit Codes

Recommended exit codes:

| Exit code | Meaning |
| --- | --- |
| `0` | Result envelope written; read its status |
| `2` | Invocation or input-envelope contract invalid |
| `3` | Domain input rejected before processing |
| `4` | Domain processing failed |
| `5` | Required skill dependency unavailable |
| `130` | Cancelled or interrupted |

The result envelope is authoritative when it exists and passes schema validation. A missing or invalid envelope is a platform-level `result_contract_invalid` failure.

## 11. Validation Ownership

### Platform validation

- Manifest and envelope JSON schema
- Required request fields
- Declared input presence
- Generic extension and size constraints declared by the manifest
- Safe relative paths
- Checksums and file existence
- Timeout, cancellation, and exit status

### Skill validation

- Workbook structure and worksheet names
- Required domain columns and values
- Technical compatibility
- Business eligibility
- Cross-file consistency
- Calculation correctness
- Output correctness

If a rule requires domain knowledge, it belongs in the skill.

## 12. Standalone Compliance

A skill is not platform-ready until this works without the platform:

```text
python src/main.py --input-manifest test-data/input.json
```

Standalone tests must verify:

- Valid input success
- Invalid domain input rejection
- Expected output files
- Result-envelope schema
- Safe error behavior
- Cancellation where supported
- Golden output behavior for business-critical transformations

## 13. Compatibility and Versioning

- `schemaVersion` changes only when the manifest format changes.
- `resultContractVersion` changes only when the runtime result contract changes.
- `version` identifies skill behavior and follows the skill's release policy.
- The platform must reject unsupported contract versions.
- Contract additions should be backward compatible within a major version.
- A skill version promotion requires its own tests and approval; platform releases must not silently change skill behavior.

## 14. Prohibited Coupling

A compliant skill must not:

- Import code from `backend/src` or `frontend/src`.
- Require Firebase or platform HTTP APIs to perform its core processing.
- Write directly to platform metadata storage.
- Depend on another job's workspace.
- Assume a fixed repository-wide input or output directory.
- Require platform secrets for ordinary domain processing.

The platform must not import the skill's internal Python modules to reproduce or bypass its CLI behavior.
