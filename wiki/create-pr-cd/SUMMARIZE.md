# create-pr-cd — Summary

`create-pr-cd` generates CelcomDigi TX PR ECC workbooks from an iEPMS/Site PR-PO workbook.

It is the sole owner of entitlement generation, including:

- Workbook interpretation.
- Project and DU-profile resolution.
- TSS and TI eligibility.
- SOW and PBOM matching.
- Subcontractor, contract and geography resolution.
- Duplicate prevention and review-required decisions.
- Production/UAT lifecycle safety.
- ECC workbook generation and domain reports.

Current direct entrypoint:

```text
python scripts/create_pr.py --site-data <file> --scope <TSS|TI> <--all-sites|--site-code> --output <directory>
```

Target platform entrypoint:

```text
python <entrypoint> --input-manifest <workspace-relative-input.json>
```

The target platform should only stage files, run Python, relay progress and deliver outputs declared in `result.json`. It should not parse iEPMS, filter sites, interpret domain CSV files or decide whether zero ECC output is valid.

Main refactor outcome: a new skill integration requires a manifest and contract-compliant Python entrypoint, not new Node routes, parsers or worker services.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [PLAN.md](PLAN.md) for details.
