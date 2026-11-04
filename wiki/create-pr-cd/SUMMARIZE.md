# create-pr-cd — Summary

`create-pr-cd` 4.0.1 is an active standalone platform skill for CelcomDigi TX PR ECC generation.

It owns workbook interpretation, DU/profile resolution, TSS/TI eligibility, SOW/PBOM matching, contract and subcontractor policy, geography, duplicate prevention, review decisions, production/UAT safety, PR-model baseline governance, ECC rendering, and requested-site reconciliation.

Invocation:

```text
python src/main.py --input-manifest <workspace>/input.json
```

Public input is one `site_data` `.xlsx` file plus scope and site-selection parameters. Reference assets remain internal to the approved package. The skill emits NDJSON progress and writes `result.json` with exact selected Site IDs, every individual output, a skill-owned delivery ZIP, SHA-256 values, warnings, safe metrics, and reconciliation.

The current PR model is version `4.0`, independently pinned by `config/pr_model_baseline.yaml`. The public platform manifest still exposes TSS/TI only. The direct `scripts/create_pr.py` CLI additionally implements governed PLANNING and BACKOFFICE; these require their domain-specific inputs/approvals and are not platform request parameters. v4.0.1 at `dc7cb77` adds scoped PostMOCN identity and Starlink/NLOS handling; it is not proof that all previously reported TI cases are fixed.


## Production TI scope split — v4.0.2

The user-approved new-link/reroute split is implemented in the skill: clear new-link-only needs installation evidence; actual reroute additionally requires explicit old-antenna diameter and 2/4 count; unclear combined labels remain REVIEW_REQUIRED. Mandatory transport/model choices must resolve uniquely and atomically, with no partial ECC for unresolved reroute records. NLOS is not an automatic old-size/count substitute. Existing TSS and Jendela separated migration work-item routing is preserved. Earlier case findings above remain historical and are not proof of successful replay. See [release rules](TI_NEW_LINK_REROUTE_4_0_2.md).


## Planning platform integration — v4.1.0

MW platform Task Type now declares Planning (`PLANNING`) alongside TSS/TI, using the existing governed engine without changing its business rules. This supersedes earlier current-scope statements that Planning is standalone-only; Backoffice remains standalone-only. [Integration, tests and release boundary](PLANNING_PLATFORM_4_1_0.md). Production activation was verified on 2026-11-04 after a frontend rebuild and service restart: Nginx serves MW 4.1.0 with TSS/TI/PLANNING and the approved fingerprint. No live Planning job or external submission was run. iEPMS PR Upload/Auditor/RAN scopes remain unchanged.
