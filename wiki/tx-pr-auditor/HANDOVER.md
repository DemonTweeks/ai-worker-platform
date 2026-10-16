# tx-pr-auditor - Handover

## Current release

v1.1.0 / `df14590a7a2b012d354471a652357533abb1dbdc`, schema 1.0. Public Final PO + EPMS workflow remains one approved Python job. Historical feature branches/commit `0142a9f` and PR#6 described earlier development; they are not current pin identity and no remote PR state was checked by this review.

Nested MW generator: v4.0.0 / `8d8880ffb044a0273650f9c54fe1688efcc4623b`, independently pinned under `dependencies/create-pr-cd`. Platform sibling MW v4.0.1 / `dc7cb77` does not update that dependency. Recursive submodule initialization is mandatory. Entrypoint checks dependency manifest/entrypoint containment; platform fingerprint separately covers recursive runtime/assets.

## Material source/documentation discrepancy

`src/main.py` runs TSS and TI then `audit_final_po.py`, passing generated ECC AND PR model/EPMS. The focused pipeline's `augment_pr_model_entitlement` may reconstruct audit-only entitlement from scope evidence. The earlier 'never reads EPMS/model' and 'sole ECC source' assertions were incorrect for this pin. No Node rule was added, but business-owner validation of the broader entitlement population is needed. See [Architecture](ARCHITECTURE.md), [Business logic](BUSINESS_LOGIC.md) and [Pending](PENDING.md).

## Ingestion / output cautions

`filterYear`/`filterMonth` must be paired. Final PO reads stop after 10,000 nonblank records or1,000 consecutive blank rows; period filtering happens afterwards. Metadata reports what was read and configured cap, not proof the whole workbook was audited. Cooperative cancellation includes every 250 rows in several loops, not an immediate interrupt guarantee. Output: audit workbook/JSON, optional ECC annotations and `TX_PR_Audit_Delivery.zip`; findings/generator review produce `succeeded_with_warning` and need business review.

## Historical evidence, not rerun here

June 2026 demo: 94 TSS and 20 TI generated workbooks, 24 audited rows, 2 Normal / 3 Wrong / 19 Invalid; 117 declared output files, succeeded_with_warning. Historical10,000-row benchmark: 6.708 s / 33.63 MiB. Do not relabel these as fresh tests on changed dependencies. Relevant suites: `tests/test_skill_contract.py`, `test_skill_contract_integration.py`, `test_audit_final_po.py`, including PR-model Column B scope and missing-generated-TI augmentation tests.

Never modify original PO/EPMS workbooks or consume entitlement for Invalid/Wrong rows. Do not upgrade nested generation without business regression and new runtime approval. No fresh audit execution or external PR action was performed during this wiki review.
