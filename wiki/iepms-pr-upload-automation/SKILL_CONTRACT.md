# Skill Contract

Identity: `iepms-pr-upload-automation`; published v0.3.1 (`397010e`), local uncommitted v0.3.2; schema/result contract 1.0; Python >=3.11. See [deployment snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md).

```text
python src/main.py --input-manifest <workspace>/skill-input.json
```

| Input | Requirement |
| --- | --- |
| `ecc` | One genuine `.xls` or `.xlsx` ECC, max 100 MiB |
| `attachment` | Optional separate evidence, max 100 MiB; extensions declared by manifest. If omitted, attach the ECC |
| `projectId` | Approved project UUID from manifest |
| `scope` | `TSS` or `TI` |
| `duModelName` | `2023 TX Rollout`, `TX Mini Project`, `MW EOS Swap`, or `ZTE TX MINI` |
| `plannedStartDate` | Calendar date `YYYY-MM-DD` |
| `outsourcedComponentService` | `N` or `Y`; default `N` |
| `productQualityRectification` | `N` or `Y`; default `N` |

The skill validates workbook data, project/model compatibility, dates, hashes and immutable identity. Submission is the operation, not an additional user-selectable request parameter. Backend/CDP/credential/runtime selection is not exposed in the request.

Host-only ignored configuration: `IEPMS_PR_UPLOAD_ROOT`, optional absolute `IEPMS_PR_UPLOAD_RUNTIME_ROOT`, optional `IEPMS_PR_UPLOAD_CDP_PORT` (blank probes 19229, 19222, 19223). NDJSON progress and 30-second heartbeats; timeout 1800 seconds. Queued cancellation only.

Success requires `submitted=true`, `verified=true`, PSQ and header OID from the submit wrapper, with successful source status/exit code. A draft or completed import-processing task is not success: failed import-row counts block submission. Safe metrics include execution ID, PSQ, OID, verification, submission, resume eligibility and exit code where available.

Outputs retain historical names `output/IEPMS_DRAFT_RESULT.json` and `.html`, even for submitted PRs. Checksummed authoritative `result.json` drives ingestion. Local v0.3.2 reports allowlisted `error.details.validationIssue` (worksheet/row/column); platform job detail currently omits that nested detail. Never publish arbitrary raw exceptions.
