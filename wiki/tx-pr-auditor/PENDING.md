# tx-pr-auditor - Pending work

## Entitlement boundary decision

Current `audit_final_po.py` loads PR-model scope and EPMS and synthesizes expected records via `augment_pr_model_entitlement`, marked `PR_MODEL_COLUMN_B_AND_EPMS_SCOPE_EVIDENCE`. Confirm this against the intended ECC-only boundary, review synthetic population/count metadata and approve business classifications. Do not claim generated ECC is the exclusive source or silently remove code based on stale prose.

## Completeness and dependency upgrade

Final PO ingestion caps 10,000 nonblank records / 1,000 consecutive blank rows before period filtering; make truncation/completeness limits explicit to operators. Consider warning/full-input detection before claiming complete-workbook audit. Nested generator `8d8880f` is separate from sibling `dc7cb77`; evaluate approved upgrades with scope/quantity/classification regressions, including changed model and profile behavior.

## Business review / evidence size

Historical demo findings are not approved merely because execution succeeds. Preserve classification-priority/quantity rules and review remaining business questions at the end of BUSINESS_LOGIC.md. Consider annotation/archive configurability for large evidence sets. Old pre-merge PR instructions are superseded by current pin; verify any future remote release state separately.
