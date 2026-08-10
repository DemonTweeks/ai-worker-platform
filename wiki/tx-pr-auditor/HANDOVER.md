# tx-pr-auditor — Handover

## Assignment

Refactor `tx-pr-auditor` into a standalone, contract-compliant Python skill and migrate AI Worker Platform away from audit-specific execution and output interpretation.

Preserve the strict boundary: the auditor consumes Final PO and generated ECC only. It must not consume iEPMS or the PR model.

## Read First

1. [ARCHITECTURE.md](ARCHITECTURE.md)
2. [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md)
3. [SKILL_CONTRACT.md](SKILL_CONTRACT.md)
4. [PLAN.md](PLAN.md)
5. [PENDING.md](PENDING.md)
6. [../SKILL_CONTRACT.md](../SKILL_CONTRACT.md)
7. The skill repository's `SKILL.md`, `references/architecture.md`, `references/business-logic.md` and tests.

## Current Entry Points and Integration

- Python entrypoint: `skills/tx-pr-auditor/scripts/audit_final_po.py`
- Skill-owned DU registry: `skills/tx-pr-auditor/config/du_registry.json`
- Platform manifest: `backend/src/workers/manifests/prAuditorManifest.js`
- Composite adapter: `backend/src/workers/adapters/prAuditorAdapter.js`
- Workspace setup: `backend/src/workers/prAuditorWorkspaceService.js`
- Output ingestion: `backend/src/workers/prAuditorOutputIngestionService.js`
- Frontend: `frontend/src/views/PRAuditorView.vue`

## Non-Negotiable Boundaries

- `create-pr-cd` output is the entitlement source.
- Do not pass iEPMS or the PR model to the focused auditor.
- Final PO mappings and reason codes remain in Python.
- Invalid and Wrong rows never consume quantity.
- Source workbooks are not modified.
- The platform validates contracts and paths, not audit meaning.
- A composite workflow, if needed, is a separately versioned standalone Python skill.

## Recommended Delegation Packages

### Package A — Focused skill contract

Add `skill.json`, `--input-manifest`, result writing and standalone contract tests.

### Package B — Progress and cancellation

Expose existing batch stages as safe NDJSON events and add cooperative cancellation.

### Package C — Golden parity

Cover classification, quantity, ambiguity, identity, multilingual headers and annotated ECC behavior.

### Package D — Product composition

Decide separate jobs versus a composite skill. If composite, pin dependencies and keep all sequencing outside platform core.

### Package E — Generic platform migration

Register approved skill versions, route through the generic runner, then remove audit-specific Node and frontend branches after parity.

## Validation Commands

Use commands supported at the checked-out skill revision. At minimum:

```text
python <target-entrypoint> --input-manifest <fixture-input.json>
python -m pytest
```

Platform tests should use synthetic skills for generic runner behavior. Real audit fixtures belong to a separate compatibility suite owned with the skill integration.

## Completion Evidence

Provide:

- Approved focused-skill manifest and version.
- Decision record for separate versus composite execution.
- Standalone contract test results.
- Golden audit parity report.
- Proof that source workbooks remain unchanged.
- Platform generic-runner test results.
- List of removed audit-specific platform files or branches.
- Rollback procedure.

## Known Risks

- Current UX relies on platform-owned `create-pr-cd` composition.
- DU registry compatibility with upstream output needs explicit versioning.
- Multilingual and mojibake header aliases require regression coverage.
- Large workbooks may affect memory, progress cadence and cancellation latency.
