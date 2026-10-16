# Pending

## Publish the local v0.3.2 fix
The skill gitlink remains `397010e` v0.3.1; running v0.3.2 source and its modified platform approval are uncommitted. Review/commit/publish the skill, then update the platform gitlink and matching approval. Documentation-only commits do not release this fix. See [snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md).

## W14 server-import padding and recovery
Draft `PSQ202610150909` / OID `1000121288` exists with zero lines. iEPMS read seven original rows: all failed because populated-site entries were mixed with serial-only site-less entries; padding rows also lack contracts and report duplicates. Local filtering alone is insufficient. Obtain explicit approval before producing a derived import copy or repairing/re-importing the existing draft. Preserve original attachment, values, hashes, and ledger reconciliation; do not create another draft, delete lines, or reset the unresolved import intent blindly.

## W15 error investigation
Original failed before external mutation at `details!P2` (`#N/A`, auxiliary Contract Number). Determine formula/source and required-contract impact read-only before proposing a correction. Do not suppress Excel errors globally. A further live attempt or modified copy requires authorization; the original was already tested once.

## Diagnostics
Nested validation coordinates are present in the downloadable safe report but absent from generic job `error.details`. Safely propagate allowlisted details. Server import-row failure reasons remain hidden by the generic blocked-state message; expose an appropriate safe reason without raw network/private data.

## Historical follow-up
W03/W04 remain unsubmitted drafts with budget/exchange-rate issues; W12 has 0/6 import success; W08 has TX_2 versus intended TX_1 description discrepancy. W01 detailed status is unknown. These are supplied historical records, not freshly verified. Never retry submitted W13/W16 to recreate results.

## Host recovery
Use a stable persistent shared runtime root and browser/queue host affinity. Keep snapshots and ledgers across releases. Verify recovery against an existing PSQ before mutation. Trackers and Implementation Plans remain excluded from the platform submit-only operation.
