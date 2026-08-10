# Existing Skills in Scope

## Purpose

This document merges the former `CREATE-PR-CD.md` and `TX-PR-AUDITOR.md` overview pages into one catalog of the existing skills currently in scope for the AI Worker Platform architecture refactor.

Detailed documents are maintained per skill:

```text
wiki/
|-- create-pr-cd/
|   |-- ARCHITECTURE.md
|   |-- BUSINESS_LOGIC.md
|   |-- HANDOVER.md
|   |-- PENDING.md
|   |-- PLAN.md
|   |-- SKILL_CONTRACT.md
|   `-- SUMMARIZE.md
`-- tx-pr-auditor/
    |-- ARCHITECTURE.md
    |-- BUSINESS_LOGIC.md
    |-- HANDOVER.md
    |-- PENDING.md
    |-- PLAN.md
    |-- SKILL_CONTRACT.md
    `-- SUMMARIZE.md
```

The root wiki documents describe AI Worker Platform. The nested documents describe each standalone Python skill.

## Skill Inventory

| Skill | Primary role | Domain inputs | Primary outputs |
| --- | --- | --- | --- |
| `create-pr-cd` | Generate TX PR ECC entitlement | iEPMS/Site PR-PO workbook | ECC workbooks, review and summary artefacts |
| `tx-pr-auditor` | Audit submitted PO rows against generated entitlement | Final PO and generated ECC workbooks | PR audit workbook, summary and optional annotated ECC copies |

## End-to-End Relationship

```text
iEPMS/Site PR-PO workbook
  -> create-pr-cd
  -> generated ECC entitlement
  -> tx-pr-auditor
  -> PR_Audit_Result.xlsx

Final PO --------------------------------^
```

The boundary is strict:

- `create-pr-cd` owns entitlement generation.
- `tx-pr-auditor` owns downstream comparison and audit classification.
- `tx-pr-auditor` must not re-read iEPMS or the PR model.
- AI Worker Platform must not own either skill's technical or business logic.

# create-pr-cd

## Role

`create-pr-cd` converts CelcomDigi TX site-level source data into PR ECC workbooks.

It owns:

- iEPMS workbook discovery, parsing and canonicalization.
- Project and DU-profile resolution.
- TSS and TI trigger and eligibility rules.
- SOW, antenna and PBOM matching.
- Subcontractor, contract, geography and purchasing-area resolution.
- Existing-PR and duplicate prevention.
- Production/UAT lifecycle gates.
- `REVIEW_REQUIRED` decisions.
- ECC grouping, splitting, naming and workbook content.
- Domain reports, warnings and metrics.

## Current Interface

Current Python entrypoint:

```text
scripts/create_pr.py
```

Example:

```text
python scripts/create_pr.py --site-data <file> --scope TSS --all-sites --output <directory>
```

Current parameters include:

- Required site-data and output paths.
- Scope: `TSS` or `TI`.
- Exactly one site-selection mode: all sites or comma-separated site codes.
- Optional PR model, template, contract mapping and subcontractor policy overrides.
- Optional explicit non-production UAT mode.

## Current Inputs and Assets

Runtime input:

- iEPMS/Site PR-PO workbook.

Skill-owned reference assets:

- PR model and ECC template.
- Contract information and geography data.
- DU profiles and identity registries.
- Canonical SOW registry.
- Subcontractor policy and other business configuration.

These assets change domain behavior and must remain versioned with the skill.

## Current Flow

```text
iEPMS workbook
  -> source discovery
  -> canonical records
  -> project/DU profile resolution
  -> lifecycle gate
  -> site and scope eligibility
  -> model/subcontractor/contract resolution
  -> eligible, ignored and review partitions
  -> ECC and report generation
```

The current CLI implements TSS and TI. Planning and Operation Backoffice remain future skill capabilities.

## Current Platform Coupling

The platform currently contains a JavaScript engine manifest, hardcoded Python command construction, MW-specific orchestration, workbook prevalidation, site filtering, TI report ingestion, zero-output interpretation and a dedicated frontend payload.

This integration must remain until a contract entrypoint and golden parity exist, but it is not the target architecture.

## Target Integration

The target skill declares `site_data` plus generic parameters such as scope, selection mode, site codes and UAT mode in a skill-owned `skill.json`. It runs through:

```text
python <entrypoint> --input-manifest <path>
```

It emits NDJSON progress and an authoritative `result.json` listing every ECC and report output. The platform does not inspect workbook or report content.

## Migration Priorities

1. Freeze current TSS/TI golden results.
2. Add `skill.json` and a thin contract entrypoint.
3. Emit standard progress, warnings, errors and results.
4. Prove parity across profiles, selection modes and production/UAT gates.
5. Integrate through the generic runner.
6. Remove Node-based domain validation and output interpretation.
7. Remove the legacy MW-specific adapter after a rollback window.

## Detailed create-pr-cd Documents

- [Architecture](create-pr-cd/ARCHITECTURE.md)
- [Business logic](create-pr-cd/BUSINESS_LOGIC.md)
- [Summary](create-pr-cd/SUMMARIZE.md)
- [Skill contract](create-pr-cd/SKILL_CONTRACT.md)
- [Plan](create-pr-cd/PLAN.md)
- [Pending work](create-pr-cd/PENDING.md)
- [Handover](create-pr-cd/HANDOVER.md)

# tx-pr-auditor

## Role

`tx-pr-auditor` validates Final PO rows against generated ECC entitlement.

It owns:

- Final PO worksheet/header detection.
- Final PO and ECC field mapping.
- Canonical site, DU, item, subcontractor and quantity data.
- DU identity and lineage resolution.
- Entitlement matching and ambiguity handling.
- Invalid, Wrong, Duplicate and Normal classification.
- Deterministic expected-quantity consumption.
- Evidence-backed audit and annotated ECC output.

## Current Interface

Current Python entrypoint:

```text
scripts/audit_final_po.py
```

Example:

```text
python scripts/audit_final_po.py --final-po <file> --expected-ecc <file-or-directory> --output <file> --summary-json <file>
```

Current options include:

- Repeated expected-ECC paths.
- Final PO sheet/header overrides.
- Dispatch year and month filters.
- DU registry and ECC sheet overrides.
- Optional annotated ECC copies.

## Input Boundary

Required:

- Final PO workbook.
- One or more generated ECC workbooks.

Prohibited:

- iEPMS/Site PR-PO workbook.
- PR model workbook.

The auditor must use ECC as its entitlement source and must not reproduce `create-pr-cd` rules.

## Current Flow

```text
Final PO + ECC
  -> Workbook Reader
  -> Field Mapper
  -> Canonical Builder
  -> Expected ECC Matcher
  -> Audit Engine
  -> Duplicate Resolver
  -> Report Writer
```

Classification priority is Invalid, Wrong, Duplicate, then Normal. Only valid claims consume quantity, ordered by Dispatch Date, Request Number, Dispatch Order Number and PO Line Number.

## Current Platform Coupling

The current platform exposes one combined job accepting Final PO and iEPMS. Its adapter generates TSS and TI ECC with `create-pr-cd`, invokes `tx-pr-auditor`, recognizes fixed output files and normalizes classifications.

That preserves a convenient user flow but makes the platform own a domain-specific multi-skill sequence.

## Target Integration

The focused target manifest declares one Final PO file, multiple ECC files and optional audit parameters. The skill emits progress and an authoritative result envelope.

For the combined iEPMS-to-audit experience, choose either:

- Two separate skill jobs; or
- A dedicated standalone composite Python skill such as `tx-pr-audit-workflow`.

The recommended approach is to retain `tx-pr-auditor` as the focused reusable skill and use a composite skill only if the single-job experience is required. The generic platform must not hardcode the sequence.

## Migration Priorities

1. Freeze classification and audit-report golden results.
2. Add `skill.json` and a thin contract entrypoint.
3. Emit standard progress, warnings, errors and results.
4. Define DU-registry compatibility with upstream ECC identity.
5. Decide separate versus composite product execution.
6. Integrate the chosen skills through the generic runner.
7. Remove audit-specific workspace, CLI, ingestion and frontend branches after parity.

## Detailed tx-pr-auditor Documents

- [Architecture](tx-pr-auditor/ARCHITECTURE.md)
- [Business logic](tx-pr-auditor/BUSINESS_LOGIC.md)
- [Summary](tx-pr-auditor/SUMMARIZE.md)
- [Skill contract](tx-pr-auditor/SKILL_CONTRACT.md)
- [Plan](tx-pr-auditor/PLAN.md)
- [Pending work](tx-pr-auditor/PENDING.md)
- [Handover](tx-pr-auditor/HANDOVER.md)

## Shared Target Rule

Both skills must be independently executable through Python. Adding or upgrading either skill should require an approved manifest/package and contract tests, not new domain routes, parsers, models or orchestration branches in AI Worker Platform.
