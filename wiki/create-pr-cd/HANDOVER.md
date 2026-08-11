# create-pr-cd — Handover

## Current State

- Branch: `refactor/standard-skill-contract`.
- Contract changes are uncommitted.
- Direct domain CLI remains `scripts/create_pr.py`.
- Platform contract CLI is `src/main.py --input-manifest`.
- Manifest version is `4.0.0` and result contract is `1.0`.

## Important Files

- `skill.json`: public interface and execution policy.
- `src/main.py`: contract validation, progress, cancellation, result packaging.
- `scripts/create_pr.py`: official domain entrypoint and reconciliation.
- `scripts/create_pr_impl.py`: pipeline and renderer supervision.
- `config/pr_model_baseline.yaml`: single-current production model gate.
- `backend/src/skills/approvedSkills.json`: platform package approval.

## Preserved Rules

- TSS/TI only.
- Exactly one of all-sites or site codes.
- Production/UAT lifecycle gate.
- PR model `4.0` SHA validation and controlled promotion.
- DU/profile, SOW/PBOM, contract, subcontractor, geography, duplicate, ignore, and review logic remain in Python.
- Every requested site receives one terminal disposition.

## Evidence

- Contract unit tests passed.
- Focused baseline, promotion, entrypoint, and reconciliation suite passed.
- Windows subprocess output is now explicitly UTF-8 decoded and console-safe.
- Real generic platform run completed with 2,554 requested sites and zero unaccounted outcomes.

## Do Not

- Expose reference asset overrides as platform inputs.
- Reimplement workbook or business validation in Node.
- Promote a package fingerprint without rerunning skill tests.
- Mark success when reconciliation contains failed or unaccounted sites.
