# Skill Contract

Identity: `iepms-pr-upload-automation`; published v0.3.1 (`397010e`), local uncommitted v0.3.3 (includes earlier v0.3.2 fixes); schema/result contract 1.0; Python >=3.11. See [deployment snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md).

```text
python src/main.py --input-manifest <workspace>/skill-input.json
```

| Input | Requirement |
| --- | --- |
| `ecc` | One genuine `.xls` or `.xlsx` ECC, max 100 MiB |
| `attachment` | Optional separate evidence, max 100 MiB; extensions declared by manifest. If omitted, attach the ECC |
| `projectId` | Approved project UUID from manifest |
| `scope` | `TSS` or `TI` |
| `duModelName` | `2023 TX Rollout`, `TX Mini Project`, `MW EOS Swap`, `ZTE TX MINI`, `2024 Celcomdigi BAU`, `Celcomdigi USP`, `Jendela TX Migration` |
| `plannedStartDate` | Calendar date `YYYY-MM-DD` |
| `outsourcedComponentService` | `N` or `Y`; default `N` |
| `productQualityRectification` | `N` or `Y`; default `N` |

The skill validates workbook data, project/model compatibility, dates, hashes and immutable identity. Submission is the operation, not an additional user-selectable request parameter. Backend/CDP/credential/runtime selection is not exposed in the request.

Host-only ignored configuration: `IEPMS_PR_UPLOAD_ROOT`, optional absolute `IEPMS_PR_UPLOAD_RUNTIME_ROOT`, optional `IEPMS_PR_UPLOAD_CDP_PORT` (blank probes 19229, 19222, 19223). NDJSON progress and 30-second heartbeats; timeout 1800 seconds. Queued cancellation only.

Success requires `submitted=true`, `verified=true`, PSQ and header OID from the submit wrapper, with successful source status/exit code. A draft or completed import-processing task is not success: failed import-row counts block submission. Safe metrics include execution ID, PSQ, OID, verification, submission, resume eligibility and exit code where available.

Outputs retain historical names `output/IEPMS_DRAFT_RESULT.json` and `.html`, even for submitted PRs. Checksummed authoritative `result.json` drives ingestion. Local v0.3.2 reports allowlisted `error.details.validationIssue` (worksheet/row/column); platform job detail currently omits that nested detail. Never publish arbitrary raw exceptions.

## Error interpretation and testing boundary

Known wrapper exit mappings:10 input invalid;20 auth required;30 unresolved business exceptions (`IEPMS_BUSINESS_BLOCKED`);40 conflict;50 retry required;60 uncertain/blocked state (see actual adapter mapping for authoritative copy). Error/exit code alone does not determine whether a draft was already created; inspect returned PSQ/OID and ledger before retry. Pre-validation failures may have no metrics at all. Do not fill missing metrics with fabricated 'verified' state.

JSON/HTML output filenames retain DRAFT for compatibility even on submitted results. Allowlisted validationIssue coordinates are available in local v0.3.2 safe reports; generic job details currently drop nested issue fields. Private wrapper messages/paths are not automatically safe for public display. Frontend Validate File proves only declared upload constraints, not required cells or server business acceptance.

Format support, source row policy, actual external importer acceptance and submission verification are separate gates. XLS support in parser does not prove W14's original template can be imported; W16 demonstrates a successful XLSX submit-only path, not every workbook/model.


## Additional DU models — local v0.3.3 (2026-10-16)

Confirmed by the user: `2024 Celcomdigi BAU`, `Celcomdigi USP` and **`Jendela TX Migration`** belong to Malaysia CelcomDigi Project (`P202202168750_D002`, project UUID `c46633e8-6e52-2178-f17e-dcbfdade7cb2`). They share that existing project profile's sales contract and are rejected under CelcomDigi MW. Bare `TX Migration` is not an approved alias. The original two Malaysia models and two MW models remain unchanged.

The skill manifest supplies all seven dropdown options; Python independently enforces project/model compatibility. New descriptions follow `【ZP 0%】<TSS|TI>/<exact DU model>/TX_<site count> site(s)_<region>_<vendor>`. Exact model names are detected case-insensitively in filenames; missing/ambiguous names fail closed. Required purchasing contract, item, quantity and source data remain workbook-derived and validated on server import.

The new models are supported by the submit-only platform operation. Legacy Implementation Plan field metadata remains schema compatibility data, not an approved new tracker/IP mapping. No tracker/IP operations are added. No live new-model PR has been submitted by the implementation tests.

This is a cumulative **uncommitted** v0.3.3 working tree on published v0.3.1 pin `397010e`, retaining the earlier uncommitted v0.3.2 row/error-reporting fixes. Local approval was updated, but the running backend was not restarted: do not claim v0.3.3 is deployed. Publish the skill and exact platform gitlink/approval together before reproducible deployment.


## Release update — v0.3.3 (2026-10-16)

Uploader v0.3.3 is now published on main at `93f303825fd03094e15019ded55b479633197292`. The accompanying platform release pins that exact commit and approves runtime fingerprint `0148ae1bba4eaedf41a509f3906cd115797dc707b677ba51772e55eefa5f1c83`. This supersedes earlier descriptions of v0.3.2/v0.3.3 as uncommitted local changes; dated live observations and unresolved W14/W15 blockers remain historical evidence and are not cleared by publishing.

The release includes the three new Malaysia CelcomDigi DU options and earlier safe row-validation/reporting fixes. Restart and inspect `/api/skills` for v0.3.3 and all seven models before claiming activation. No live new-model PR, tracker update or Implementation Plan write is part of this release.
