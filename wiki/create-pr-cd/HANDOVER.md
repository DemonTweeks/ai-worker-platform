# create-pr-cd - Handover

## Current release and ownership

Platform runtime baseline `ec5fd9b` pins MW v4.0.1 at `dc7cb77d656a367c0563c169271f784b15e7d287`, built on `237ee81` Backoffice support. The old refactor/uncommitted v4.0.0 notes are historical, not current state. Result schema remains 1.0. Package SHA and PR-model baseline are independent fail-closed gates; see [TI guidance release](TI_BUSINESS_GUIDANCE_4_0_1.md).

- Public platform entrypoint `src/main.py --input-manifest`: one XLSX `site_data`, TSS/TI, exactly one all-sites/site-list selection. Reference overrides are not public inputs.
- Official direct domain entrypoint `scripts/create_pr.py`: also implements governed PLANNING/BACKOFFICE. `create_pr_impl.py` alone is narrower. Scope exposure is not identical across entrypoints.
- Python owns source profiles, fingerprint/header readiness, production/UAT gates, model/PBOM/contract/subcontractor/geography, duplicates, review, ECC grouping, ZIP and complete requested-site reconciliation. No Node domain rules.
- Auditor's nested generator `8d8880f` is independent and does not inherit this sibling update.

## Seven-site TI feedback: preserved evidence, not a fresh replay

B. Chong's 14 October report was studied against pre-v4.0.1 MW `e94e10d`, historical September job artifacts and October source snapshots. The matching historical jobs are not proof of an October execution. See [September valid-case study](../../docs/analysis/create-pr-cd-nizar-valid-case-verification-2026-09-10.md).

| Case | Historical finding | Follow-up, not an automatic success claim |
| --- | --- | --- |
| K00782-K00420, EOS Swap | DUPLICATE_BLOCKED / existing TI reference; cancellation-in-progress in old source; October PSQ202609210263-GCI | Preserve duplicate policy and make disposition explicit; not a renderer crash |
| B02830-1423A, EOS Swap | Source Selangor present; EOS state mapping empty, then MISSING_STATE; October PSQ202609210301-GTSB | Approve exact source fingerprint; current PR reference may block a rerun first |
| 8040R, Starlink-MW | Source 1.2m exists, but Jendela antenna/detail mapping unverified | Starlink-only exemption does not waive the new MW component's evidence |
| 8438R, MW-Fiber Own Build | Size/details genuinely absent in examined input | Confirm OLD MW dismantling evidence and PBOM; no generic 0.3m fill |
| 4592B_HU_1, TX Mini MW Swap | `18G_1.2M(HS)+Flexi WG x1` shorthand not resolved by old parser; October PSQ202609230329-GCI | Govern shorthand without reading cable/frequency as size |
| K00691_AD, TX Mini reroute | Missing DECOM size; new NE0.6m/FE1.8m do not prove old dish size; October existing PR | Separate old/new evidence; no blind rerun |
| C01085_AD_1, TX Mini new-link/reroute | Proposed 0.3m/0.3m does not prove dismantled size; October TI PR field blank | Resolve new-link-only versus actual reroute/decom classification |

Saved TX Mini outputs included partial ECC while REVIEW_REQUIRED: whole-site atomicity and upload-readiness need explicit owner resolution. v4.0.1 adds scoped PostMOCN identity, approved Starlink-only treatment, deterministic NLOS 0.3m and TX Rollout detail mapping; it does not establish new approvals for every EOS/Jendela source or complete real-data replay.

## Validation and recovery boundaries

Historical generic run: 2,554 requested sites with zero unaccounted outcomes. Release v4.0.1 evidence records 858 passed, 20 skipped, 380 subtests plus five failures reproducible on prior main; do not convert that into a clean full-suite claim. Dedicated guidance: 24 tests/four subtests. No tests rerun during this wiki audit.

Sources: `skill.json`, `src/main.py`, `scripts/create_pr.py`, `scripts/antenna_evidence_resolver.py`, `scripts/pr_helpers.py`, source profiles, `tests/test_ti_business_guidance.py`. Original local study/probes are retained in the conversation evidence folder identified by the uploader deployment snapshot. Do not import executable legacy generator modules merely to inspect helpers: some execute work at import time.

Next: [Pending](PENDING.md). Do not modify original inputs, bypass duplicates, promote an untested fingerprint, or equate generated/review rows with approved live upload.
