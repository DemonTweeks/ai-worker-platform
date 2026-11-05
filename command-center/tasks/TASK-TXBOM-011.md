# TASK-TXBOM-011
Status: READY_FOR_MAIN_REVIEW (DEV -> TEST -> QA complete; sequential self-review). Owner: AIDA, sequential DEV/TEST/QA. Risk: medium, bounded validation compatibility change.
Objective: restore supplied legacy BOM parity without weakening material/EPMS checks.
Targets: skills/tx-bom-generator src/engine/tx_bom_prototype.py, src/main.py, tests/test_adapter.py, skill.json and docs; backend approval, offline acceptance and private fixture parity harness; platform wiki/docs.
Output: versioned local fix, warnings, tests, evidence and handover. No deployment or git commit/push authorized in this step.
Acceptance/testing: exact known decorative formula preserved; arbitrary broken refs/errors in headers blocked; quantities/mapping checks intact; two isolated platform jobs reproduce release workbook content and verified downloads; full Python/backend/frontend checks.
QA: verify scope, safety, version consistency, retained real-input failures and no unrelated worktree mutation.
