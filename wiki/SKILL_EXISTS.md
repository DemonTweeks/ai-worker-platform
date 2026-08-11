# Existing Skills

| Skill | Version | Public inputs | Domain outputs |
| --- | --- | --- | --- |
| `create-pr-cd` | `4.0.0` | one site-data workbook plus TSS/TI and site selection | ECC files, reports, reconciliation |
| `create-pr-cd-ran` | `1.1.0` | one BOM, one EPMS workbook, run mode, optional approved project | normalized/calculated JSON, PR JSON, ECC workbooks |
| `tx-pr-auditor` | `1.0.0` | one Final PO plus one or more expected ECC workbooks | audit workbook, summary, annotated ECC copies |

All packages use:

```text
python src/main.py --input-manifest <workspace>/skill-input.json
```

They expose `skill.json`, safe NDJSON progress, cooperative cancellation, and authoritative `result.json` outputs. The platform treats domain results as opaque except for contract identity, safe paths, checksums, status, warnings, and optional reconciliation arithmetic.
