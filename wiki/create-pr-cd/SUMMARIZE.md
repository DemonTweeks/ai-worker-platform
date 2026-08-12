# create-pr-cd — Summary

`create-pr-cd` 4.0.0 is an active standalone platform skill for CelcomDigi TX PR ECC generation.

It owns workbook interpretation, DU/profile resolution, TSS/TI eligibility, SOW/PBOM matching, contract and subcontractor policy, geography, duplicate prevention, review decisions, production/UAT safety, PR-model baseline governance, ECC rendering, and requested-site reconciliation.

Invocation:

```text
python src/main.py --input-manifest <workspace>/input.json
```

Public input is one `site_data` `.xlsx` file plus scope and site-selection parameters. Reference assets remain internal to the approved package. The skill emits NDJSON progress and writes `result.json` with exact selected Site IDs, every individual output, a skill-owned delivery ZIP, SHA-256 values, warnings, safe metrics, and reconciliation.

The current PR model is version `4.0`, independently pinned by `config/pr_model_baseline.yaml`. Planning and Operation Backoffice are not exposed because the Python skill does not yet implement them.
