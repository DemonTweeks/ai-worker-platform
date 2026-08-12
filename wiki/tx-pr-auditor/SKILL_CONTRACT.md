# tx-pr-auditor — Skill Contract

## Identity

| Field | Value |
| --- | --- |
| Skill ID | `tx-pr-auditor` |
| Version | `1.1.0` |
| Entrypoint | `src/main.py` |
| Manifest/result schema | `1.0` |
| Generator dependency | `create-pr-cd` 4.0.0 |
| Generator scopes | TSS, then TI |
| Timeout | 3,600 seconds |

## Input

- `final_po`: exactly one `.xlsx`, maximum 200 MiB.
- `epms`: exactly one `.xlsx` or `.xlsm`, maximum 200 MiB.
- `filterYear`: optional integer 2000–2200.
- `filterMonth`: optional integer 1–12.
- `annotateEcc`: optional boolean, default `true`, hidden in the UI.

The audit row limit remains 10,000.

## Output

`result.json` declares the audit workbook, JSON summary, optional annotated ECC copies, safe classification metrics, and generator scope metrics. Generator review evidence is surfaced as warnings. Any audit finding or generator review requirement produces `succeeded_with_warning`.

## Standalone Command

```text
git submodule update --init --recursive
python src/main.py --input-manifest <workspace>/skill-input.json
```

The direct `scripts/audit_final_po.py` CLI remains available for focused Final PO-versus-ECC development, but it is not the public platform contract.
