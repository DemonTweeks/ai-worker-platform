# Wiki guide and evidence rules

This wiki describes the platform and the exact checked-out skill implementations. Read [Summary](SUMMARIZE.md), [Architecture](ARCHITECTURE.md), [Deployment](DEPLOYMENT.md), then [Handover](HANDOVER.md). Open work belongs in [Pending](PENDING.md); [Plan](PLAN.md) records implementation/release gates; [Skill contract](SKILL_CONTRACT.md) is the shared transport contract; [Skills inventory](SKILL_EXISTS.md) identifies active packages.

## Ownership and structure

| Directory | Responsibility |
| --- | --- |
| [create-pr-cd](create-pr-cd/SUMMARIZE.md) | MW generation, approved source profiles, SOW/PBOM, geography, duplicates and model governance |
| [create-pr-cd-ran](create-pr-cd-ran/SUMMARIZE.md) | RAN normalization, calculation, project catalogue and ECC/ZIP delivery |
| [tx-pr-auditor](tx-pr-auditor/SUMMARIZE.md) | Nested MW generation and Final PO audit, including current scope augmentation |
| [iepms-pr-upload-automation](iepms-pr-upload-automation/SUMMARIZE.md) | ECC interpretation, authenticated import, external mutations and recovery |

Each skill uses ARCHITECTURE.md, BUSINESS_LOGIC.md, SKILL_CONTRACT.md, SUMMARIZE.md, PLAN.md, PENDING.md and HANDOVER.md. Put capabilities in summary/contract, execution/ownership in architecture, rule detail in business logic, current evidence/recovery in handover, and unresolved decisions in pending. Keep release-specific notes supplementary; do not duplicate an independent workbook register.

## What was reviewed

Source audit performed 2026-10-16 against platform runtime baseline `ec5fd9b` plus documentation commit `f657427`, manifests, entrypoints, queue/runner, UI and existing evidence. Documentation edits following that commit are not themselves a new release. No live PR state was refreshed by this documentation review; no aggregate runtime test suite was rerun.

- Distinguish published Git pins, uncommitted working-tree changes, and last observed deployed state. See [dated deployment snapshot](iepms-pr-upload-automation/DEPLOYMENT_SNAPSHOT_2026-10-15.md).
- `main`/branch names do not select deployment contents: recursive gitlinks and approved runtime fingerprints do. A nested generator is independent of the sibling MW skill.
- Passing tests must have a dated source/snapshot. A listed command is not a fresh pass claim.
- Preserve historical negative findings. A later narrow fix does not prove all seven TI cases or all XLS server imports are solved.
- External PR identities and failure evidence belong in the existing handover/pending documents with provenance; no retry is authorized by reading these docs.
- Do not commit cookies, signature keys, credentials, live sessions, customer workbooks or bulk private job dumps. Reference retained local evidence rather than copying it wholesale.
