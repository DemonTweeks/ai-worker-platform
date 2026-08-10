# create-pr-cd — Architecture

## Purpose

`create-pr-cd` is a standalone Python domain engine that converts CelcomDigi TX site/PR data into PR ECC workbooks. AI Worker Platform should execute it as an opaque skill and must not reproduce its workbook, technical, or business logic.

## System Boundary

### Skill ownership

- Discover and parse the iEPMS/Site PR-PO workbook.
- Resolve site, project, DU profile, lifecycle status and view identity.
- Apply TSS and TI eligibility and duplicate-prevention rules.
- Normalize SOW and match PBOM line items.
- Resolve antenna, geography, subcontractor, contract and purchasing-area data.
- Decide production, non-production UAT and `REVIEW_REQUIRED` outcomes.
- Render, name, group and split ECC workbooks.
- Produce domain warnings, evidence, reports and metrics.

### Platform ownership

- HTTPS, authentication and generic request handling.
- Generic file constraints declared by the skill.
- Isolated workspace creation and safe path handling.
- Process supervision, timeout and cancellation.
- Job metadata, progress transport and output delivery.
- Structural validation of `skill.json`, `input.json` and `result.json`.

The platform may know that an input is a declared file. It must not know what an iEPMS header, TSS, TI, SOW, PBOM or DU profile means.

## Current Internal Architecture

```text
scripts/create_pr.py
  -> dependency synchronization and safety wrapper
  -> scripts/create_pr_impl.py
     -> canonical input pipeline
     -> DU export adapter and profile resolver
     -> lifecycle and safety controls
     -> site selection and scope partitioning
     -> TSS/TI model matching
     -> ECC renderer
     -> review and execution summaries
```

Important supporting modules include:

- `canonical_input_pipeline.py`
- `du_export_adapter.py`
- `du_profile_loader.py`
- `du_profile_resolver.py`
- `sow_normalization.py`
- `mw_hardware_upgrade_selector.py`
- `geography_resolver.py`
- `pr_safety_controls.py`
- `generate_tss_pr_ecc.py`

Domain configuration and reference assets remain inside the skill under `config/`, `knowledge_base/` and `Info/`.

## Current Data Flow

```text
iEPMS workbook
  -> source-layout discovery
  -> canonical site records
  -> project and DU-profile resolution
  -> lifecycle gate
  -> site selection
  -> TSS/TI eligibility
  -> model, subcontractor and contract resolution
  -> eligible/review/ignored partitions
  -> ECC workbooks and domain reports
```

The implemented CLI supports TSS and TI. Planning and Operation Backoffice are documented future scopes and must not be advertised as current runtime capabilities.

## Current Platform Coupling

The current backend contains worker-specific integration:

- `mwPrManifest.js` lists internal engine files and a pinned fingerprint.
- `childProcessRunner.js` knows the entry script, supported scopes and flags.
- `prWorkerService.js` implements an MW-specific lifecycle.
- Node services parse the workbook, filter rows, interpret TI reports and decide zero-output behavior.
- The frontend builds an MW-specific request.

These are migration targets. Domain interpretation must move behind the skill contract before the generic runner replaces them.

## Target Runtime Architecture

```text
POST /skills/create-pr-cd/jobs
  -> generic request validation
  -> isolated workspace
  -> input/input.json
  -> python <entrypoint> --input-manifest input/input.json
  -> NDJSON progress events
  -> output/*
  -> result.json
  -> generic result validation and delivery
```

The target Python entrypoint should be a thin contract adapter around the existing internal pipeline. Rewriting proven business logic is not required.

## Safety Invariants

- Production ECC requires a `PRODUCTION` profile.
- UAT output remains visibly marked and isolated.
- Ambiguous data fails closed or becomes review-required.
- Source and reference workbooks are not modified.
- Generated paths stay inside the declared workspace.
- A platform refactor must preserve workbook content and safety behavior through golden tests.

## Related Documents

- [Summary](SUMMARIZE.md)
- [Business logic](BUSINESS_LOGIC.md)
- [Skill contract](SKILL_CONTRACT.md)
- [Plan](PLAN.md)
- [Pending work](PENDING.md)
- [Handover](HANDOVER.md)
