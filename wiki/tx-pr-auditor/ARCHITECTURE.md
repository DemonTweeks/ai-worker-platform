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
       -> focused Final PO-versus-ECC audit
  -> result.json
  -> generic output delivery
```

The platform does not know the sequence, scopes, workbook headers, entitlement rules, classification priority, or quantity logic. It starts one approved Python entrypoint and reads its declared result.

## Skill Ownership

- Validate the declared Final PO and EPMS files.
- Verify the pinned dependency identity.
- Run TSS and TI generators in isolated child workspaces.
- Forward progress and propagate cancellation.
- Give only generated ECC to the focused audit engine.
- Produce the audit workbook, summary, and annotated ECC evidence.

## Focused Audit Boundary

The inner `scripts/audit_final_po.py` pipeline remains Final PO-versus-ECC only. It never reads EPMS or the PR model and never reimplements `create-pr-cd` entitlement logic.

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
