# tx-pr-auditor — Architecture

## Purpose

`tx-pr-auditor` 1.1.0 restores the product flow represented by UI baseline `4d4148d7`: one job accepts Final PO and EPMS, generates mandatory TSS and TI entitlement, then audits Final PO against that generated ECC.

## Thin-Wrapper Boundary

```text
HTTPS request
  -> generic platform contract validation and queue
  -> tx-pr-auditor/src/main.py
       -> pinned create-pr-cd 4.0.0 / TSS
       -> pinned create-pr-cd 4.0.0 / TI
       -> focused Final PO audit (ECC + PR-model/EPMS scope augmentation)
  -> result.json (individual evidence + skill-owned delivery ZIP)
  -> generic output delivery
```

The platform does not know the sequence, scopes, workbook headers, entitlement rules, classification priority, or quantity logic. It starts one approved Python entrypoint and reads its declared result.

## Skill Ownership

- Validate the declared Final PO and EPMS files.
- Verify the pinned dependency identity.
- Run TSS and TI generators in isolated child workspaces.
- Forward progress and propagate cancellation.
- Pass generated ECC plus PR-model and EPMS scope evidence to the audit pipeline, which can augment expected entitlement under current pinned rules.
- Produce the audit workbook, summary, annotated ECC evidence, and the complete `TX_PR_Audit_Delivery.zip` package.

## Focused Audit Boundary

The inner `scripts/audit_final_po.py` reads generated ECC, PR-model scope catalogue and EPMS scope evidence. `augment_pr_model_entitlement` can synthesize audit-only expected records marked `PR_MODEL_COLUMN_B_AND_EPMS_SCOPE_EVIDENCE`. Generated ECC is therefore not the sole entitlement source in pinned code. This is skill-owned Python behavior, but differs from the previously documented ECC-only business boundary and requires explicit owner review. Source: `src/main.py`, `scripts/audit_final_po.py::run_pipeline`, `_scope_evidence_allows`, `augment_pr_model_entitlement`, and their tests.

## UI

`skill.json.ui` renders the baseline flow: Final PO upload, audit period, EPMS upload, controlled two-stage configuration, Active Jobs, Result Delivery, cancellation, AI Chatbox, and live output. UI metadata remains presentation-only.

## Dependency Packaging

`dependencies/create-pr-cd` is a Git submodule pinned to merged main commit `8d8880ffb044a0273650f9c54fe1688efcc4623b`. Recursive submodule initialization is required. The platform approval fingerprint covers the dependency runtime and fixed domain assets.

## Safety Invariants

- TSS and TI are both mandatory.
- Missing or mismatched dependency identity fails closed.
- Source workbooks are copied and never modified.
- Generated paths stay inside isolated job workspaces.
- Invalid and Wrong audit rows never consume entitlement.
- Business and technical logic remain Python skill-owned.
- Archive composition remains Python skill-owned; the platform only exposes declared files through the generic download endpoint.
