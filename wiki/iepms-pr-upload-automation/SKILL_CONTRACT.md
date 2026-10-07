# Skill Contract

Identity: `iepms-pr-upload-automation`, version `0.1.0`, schema/result contract `1.0`, Python >=3.11.

```text
python src/main.py --input-manifest <workspace>/skill-input.json
```

Required inputs:

| Name | Value |
| --- | --- |
| `ecc` | One `.xlsx` ECC workbook |
| `attachment` | One separate evidence file; allowed extensions are declared in `skill.json` |
| `projectId` | One of the two approved project UUIDs in `skill.json` |
| `scope` | `TSS` or `TI` |
| `duModelName` | `2023 TX Rollout`, `TX Mini Project`, `MW EOS Swap`, or `ZTE TX MINI` |
| `plannedStartDate` | Calendar date, entered as `YYYY-MM-DD` |
| `outsourcedComponentService` | `N` or `Y`; UI default `N` |
| `productQualityRectification` | `N` or `Y`; UI default `N` |

The Python skill validates project/model compatibility, workbook contents, dates, file hashes, and immutable request identity. The adapter has no Submit, backend-selection, CDP-port, credential, or runtime-directory request parameters.

Host configuration stays in the selected ignored platform `config/env/*.env` file:

- `IEPMS_PR_UPLOAD_ROOT`: skill package location.
- `IEPMS_PR_UPLOAD_RUNTIME_ROOT`: optional absolute shared recovery directory.
- `IEPMS_PR_UPLOAD_CDP_PORT`: optional existing browser port; blank probes 19229, 19222, then 19223.

NDJSON progress and 30-second heartbeats are emitted. Timeout is 1800 seconds. Running cancellation is disabled; a pre-start cancellation sentinel is honored.

Success requires the existing wrapper to return `prepared`, `verified=true`, a PSQ and PR header OID, and `submitted=false`. All other outcomes are failed platform jobs with a safe skill error and report. `summary.metrics` carries execution ID, PSQ, PR header OID, source status, verification, submission, resume eligibility, and exit code.

Declared outputs: `output/IEPMS_DRAFT_RESULT.json` and `output/IEPMS_DRAFT_RESULT.html`, both checksummed. `result.json` is authoritative. The generic API exposes `resultSummary` and manifest `resultFields` for workbench/history/detail presentation.
