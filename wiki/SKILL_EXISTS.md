# Existing Skills

| Skill | Version | Public inputs | Domain outputs |
| --- | --- | --- | --- |
| `create-pr-cd` | `4.0.0` | one site-data workbook plus TSS/TI and site selection | ECC files, reports, reconciliation |
| `create-pr-cd-ran` | `1.1.2` | one BOM, one EPMS workbook, run mode, optional approved project | normalized/calculated JSON, PR JSON, ECC workbooks, delivery ZIP |
| `tx-pr-auditor` | `1.1.0` | one Final PO plus one EPMS workbook; skill generates mandatory TSS/TI ECC | audit workbook, summary, annotated ECC copies |
| `iepms-pr-upload-automation` | `0.1.0` | one ECC workbook, separate attachment, project/scope/DU/date and Y/N flags | verified draft PSQ, safe JSON/HTML reports; stops before Submit |

All packages use:

```text
python src/main.py --input-manifest <workspace>/skill-input.json
```

They expose `skill.json`, safe NDJSON progress, and authoritative `result.json` outputs. Cancellation support is declared per skill; iEPMS allows queued cancellation only. The platform treats domain results as opaque except for contract identity, safe paths, checksums, status, warnings, and optional reconciliation arithmetic. Manifest `ui.result.fields` selects scalar summary metrics to display without platform business logic.
