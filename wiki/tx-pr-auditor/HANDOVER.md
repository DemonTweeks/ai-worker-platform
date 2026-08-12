# tx-pr-auditor — Handover

## Current Work

- Platform branch: `refactor/restore-pr-auditor-workflow`.
- Skill branch: `refactor/restore-composite-audit-flow`.
- Skill commit: `0142a9fb253580986ce04fb9eca4fe63c6c41d2a`.
- Skill PR: [BL2ZteSolution/tx-pr-auditor#6](https://github.com/BL2ZteSolution/tx-pr-auditor/pull/6).
- Skill contract version: 1.1.0.
- Public inputs: Final PO + EPMS.
- Dependency: `create-pr-cd` 4.0.0 at `8d8880ffb044a0273650f9c54fe1688efcc4623b`.

## Design Decision

The old Node composite adapter was not restored. The composite sequence lives in `tx-pr-auditor/src/main.py`, so the platform remains a generic HTTPS/queue/process/result wrapper. The focused audit engine still accepts only Final PO plus generated ECC internally.

## Important Files

- `skills/tx-pr-auditor/skill.json`: public input and UI contract.
- `skills/tx-pr-auditor/src/main.py`: composite Python orchestration.
- `skills/tx-pr-auditor/scripts/audit_final_po.py`: focused audit business logic.
- `skills/tx-pr-auditor/dependencies/create-pr-cd`: pinned generator.
- `backend/src/skills/approvedSkills.json`: package approval coverage.
- `frontend/src/views/GenericSkillView.vue`: generic manifest renderer; no auditor orchestration.

## Acceptance Dataset

Source files: `C:\Users\ZX01-ai\Desktop\temp\pr-audit`.

June 2026 run: 24 rows audited, 94 TSS and 20 TI workbooks generated, final status `succeeded_with_warning`. Findings require business review.
