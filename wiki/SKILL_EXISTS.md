# Existing Skills

| Skill | Version | Public inputs | Domain outputs |
| --- | --- | --- | --- |
| `create-pr-cd` | `4.0.1` | one site-data workbook plus TSS/TI and site selection | ECC files, reports, reconciliation |
| `create-pr-cd-ran` | `1.1.2` | one BOM, one EPMS workbook, run mode, optional approved project | normalized/calculated JSON, PR JSON, ECC workbooks, delivery ZIP |
| `tx-pr-auditor` | `1.1.0` | one Final PO plus one EPMS workbook; skill generates mandatory TSS/TI ECC | audit workbook, summary, annotated ECC copies |
| `iepms-pr-upload-automation` | `0.3.3` published | one XLS/XLSX ECC, optional attachment, project/scope/DU/date and Y/N flags | submitted/verified PSQ or safe blocked reports; no tracker/IP updates |

All packages use:

```text
python src/main.py --input-manifest <workspace>/skill-input.json
```

They expose `skill.json`, safe NDJSON progress, and authoritative `result.json` outputs. Cancellation support is declared per skill; iEPMS allows queued cancellation only. The platform treats domain results as opaque except for contract identity, safe paths, checksums, status, warnings, and optional reconciliation arithmetic. Manifest `ui.result.fields` selects scalar summary metrics to display without platform business logic.


## Release update — v0.3.3 (2026-10-16)

Uploader v0.3.3 is now published on main at `93f303825fd03094e15019ded55b479633197292`. The accompanying platform release pins that exact commit and approves runtime fingerprint `0148ae1bba4eaedf41a509f3906cd115797dc707b677ba51772e55eefa5f1c83`. This supersedes earlier descriptions of v0.3.2/v0.3.3 as uncommitted local changes; dated live observations and unresolved W14/W15 blockers remain historical evidence and are not cleared by publishing.

The release includes the three new Malaysia CelcomDigi DU options and earlier safe row-validation/reporting fixes. Restart and inspect `/api/skills` for v0.3.3 and all seven models before claiming activation. No live new-model PR, tracker update or Implementation Plan write is part of this release.
