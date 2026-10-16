# tx-pr-auditor — Summary

`tx-pr-auditor` 1.1.0 restores the original product experience: upload Final PO and EPMS once, select the Final PO period, and run one controlled audit job.

The implementation remains a thin-wrapper architecture. The platform starts one approved Python skill. That skill invokes pinned `create-pr-cd` for mandatory TSS and TI entitlement, then runs the focused Final PO-versus-ECC audit and declares individual evidence plus a complete delivery ZIP through `result.json`. History and Job Detail download those declared files directly; the platform does not generate archives.

The supplied June 2026 demo completed successfully with warnings: 24 rows audited, 2 Normal, 3 Wrong PO, and 19 Invalid PO. Those findings are audit results requiring business review, not execution failures.

## Current source boundary

Pinned v1.1.0 / `df14590` owns composite TSS/TI generation using nested MW `8d8880f`, independently of the platform's sibling MW pin. Audit entitlement also includes governed PR-model/EPMS scope augmentation in current code, not solely generated ECC. Final PO ingestion is capped before period filtering. See [handover](HANDOVER.md) and [pending business review](PENDING.md) before claiming full-workbook or ECC-only semantics.
