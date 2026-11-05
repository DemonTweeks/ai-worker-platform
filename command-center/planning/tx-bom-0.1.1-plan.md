# TX BOM 0.1.1 plan
User approved implementation of the previously tested narrow legacy header fix. Owner: AIDA, sequential DEV/TEST/QA roles (no subagent facility available).
Scope: dev04 only; preserve exact =COUNTA(#REF!) in template row1 A:BF with explicit warning; retain all business-data/mapping/integrity checks; version 0.1.1 and matching local approval. No input repair, business arithmetic change, production execution, iEPMS write, commit/push/deploy.
Acceptance: synthetic positive and negative boundary tests; full Python suite; private exact-input two-job API/runner/download parity against eight-row supplied release baseline; all business references compared; backend and frontend regressions; review diff and production status.
Dependencies: implementation -> identity/approval -> tests -> QA -> ready for user release approval.
