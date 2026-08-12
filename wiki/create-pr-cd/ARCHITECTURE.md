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
- Generic rendering of skill-owned `skill.json.ui` presentation metadata.
- Structural validation of `skill.json`, `input.json` and `result.json`.

The UI manifest places the PR Creator mode switch, site-mode/task controls, and the conditional site-code field while hiding `nonProductionUat` at its default. The platform renders those declarations without interpreting what an iEPMS header, TSS, TI, SOW, PBOM or DU profile means.

## Current Internal Architecture

```text
scripts/create_pr.py
  -> single-current PR-model baseline validation
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
- `pr_model_baseline.py`
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
  + approved PR-model baseline
  -> source-layout discovery
  -> canonical site records
  -> project and DU-profile resolution
  -> lifecycle gate
  -> site selection
  -> TSS/TI eligibility
  -> model, subcontractor and contract resolution
  -> eligible/review/ignored partitions
  -> requested-site reconciliation
  -> ECC workbooks, domain reports, and skill-owned delivery ZIP
```

### PR-model baseline boundary

`config/pr_model_baseline.yaml` is the authoritative identity of the one selectable production PR model. It declares model version `4.0`, `Info/input/pr_model.xlsx`, and the approved workbook SHA-256. `scripts/create_pr.py` validates that identity before DU processing or ECC rendering and fails closed with `PR_MODEL_BASELINE_MISMATCH` when the configured file, status, or bytes do not match.

Candidate models are not runtime inputs. `scripts/analyze_pr_model_change.py` compares a candidate with the current model, and `scripts/promote_pr_model.py` performs controlled replacement only after compatibility, required business approval evidence, and the full regression gate pass. A failed promotion restores the prior production baseline.

The implemented CLI supports TSS and TI. Planning and Operation Backoffice are documented future scopes and must not be advertised as current runtime capabilities.

## Platform Coupling

The active product route uses only the generic runner. The previous MW-specific launch page, registry adapter, and worker lifecycle service have been removed. Historical jobs remain readable and downloadable but are not dispatched through retired code.

## Implemented Runtime Architecture

```text
POST /api/skills/create-pr-cd/jobs
  -> generic request validation
  -> isolated workspace
  -> skill-input.json
  -> python src/main.py --input-manifest skill-input.json
  -> NDJSON progress events
  -> output/*
  -> result.json (exact source Site IDs + declared delivery archive)
  -> generic result validation and delivery
```

`src/main.py` is the thin contract adapter around the existing internal pipeline. It supervises `scripts/create_pr.py` as a child so cancellation can preserve an authoritative terminal result without rewriting proven business logic.

## Safety Invariants

- Production ECC requires a `PRODUCTION` profile.
- Production execution requires the single approved PR-model version and SHA-256.
- UAT output remains visibly marked and isolated.
- Ambiguous data fails closed or becomes review-required.
- Every requested site must have exactly one terminal disposition; failed or unaccounted reconciliation fails closed.
- Archive composition remains inside Python; the platform only validates and serves `CREATE_PR_DELIVERY_<scope>.zip` as a declared output.
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
