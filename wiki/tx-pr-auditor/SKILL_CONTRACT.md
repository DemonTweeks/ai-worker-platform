# tx-pr-auditor — Skill Contract

## Identity

| Field | Value |
| --- | --- |
| Skill ID | `tx-pr-auditor` |
| Version | `1.0.0` |
| Entrypoint | `src/main.py` |
| Manifest schema | `1.0` |
| Result contract | `1.0` |
| Timeout | 3,600 seconds |
| Cancellation | `control/cancel.requested`, checked every 250 rows |

## Input

- `final_po`: exactly one `.xlsx`, maximum 200 MiB.
- `expected_ecc`: one or more `.xlsx`, each maximum 100 MiB, maximum 100 files.

Optional parameters:

- `filterYear`: 2000–2200.
- `filterMonth`: 1–12.
- `annotateEcc`: boolean, default `true`.

The manifest limits Final PO processing to 10,000 rows.

## Output

`result.json` declares:

- `PR_Audit_Result.xlsx`.
- `PR_Audit_Summary.json`.
- Optional annotated ECC workbooks.
- Annotated ECC summary when annotation is enabled.
- Safe classification, reason, DU, and file-count metrics.

Any non-Normal finding produces `succeeded_with_warning`; domain failure produces `failed` with a safe skill-owned error.

## Standalone Command

```text
python src/main.py --input-manifest <workspace>/input.json
```

The shared rules in [../SKILL_CONTRACT.md](../SKILL_CONTRACT.md) also apply.
