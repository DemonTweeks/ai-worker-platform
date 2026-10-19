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

## Acceptance and release gates

- Keep v0.3.1 baseline182 Python/95frontend and local v0.3.2 236offline tests dated; do not merge claims into an invented all-green current suite. Re-run isolated tests after any code change; blocked sockets/unavailable CDP prevent live mutation.
- Before changing W14 import representation, obtain approval, prove3business-row equivalence/no lost Remarks or identifiers, preserve original attachment and hashes, reconcile zero-server-lines against existing PSQ and unresolved intent. No destructive reset or untracked replay.
- Check P2 formula/lookup read-only and distinguish auxiliary error from required-contract data in W15; serial-only rows remain a later server risk even after an authorized lookup correction.
- Preserve authentication and corporate session only on backend host. Startup can wait for context; meaningful progress should identify safe workflow stage without leaking private server responses.
- Proposed v0.3.2 is not published/reproducibly pinned yet. Stable runtime root and upgraded package approval must be released together with reviewed source identity; no documentation commit should stage those runtime edits accidentally.


## New model release gate — 2026-10-16

Local v0.3.3 now implements the three confirmed Malaysia models; this is not yet a published or restarted release. Preserve the uncommitted v0.3.2 changes when reviewing/publishing the cumulative skill. Commit/publish reviewed source first, then update the platform gitlink and approved version/fingerprint, install dependencies as needed and authorize restart. The currently running backend may retain its older in-memory approval; do not run live uploads against this changed package before deployment is completed. New models have offline coverage only. Any actual model/contract/DU-specific business restrictions remain subject to iEPMS validation. Never infer tracker or Implementation Plan mappings from the dropdown additions.


## Release update — v0.3.3 (2026-10-16)

Uploader v0.3.3 is now published on main at `93f303825fd03094e15019ded55b479633197292`. The accompanying platform release pins that exact commit and approves runtime fingerprint `0148ae1bba4eaedf41a509f3906cd115797dc707b677ba51772e55eefa5f1c83`. This supersedes earlier descriptions of v0.3.2/v0.3.3 as uncommitted local changes; dated live observations and unresolved W14/W15 blockers remain historical evidence and are not cleared by publishing.

The release includes the three new Malaysia CelcomDigi DU options and earlier safe row-validation/reporting fixes. Restart and inspect `/api/skills` for v0.3.3 and all seven models before claiming activation. No live new-model PR, tracker update or Implementation Plan write is part of this release.
