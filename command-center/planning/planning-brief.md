# TX BOM skill migration

Approved execution: one agent, sequential stages; no subagents. Native Windows Python, thin adapter around process_batch. Develop only in this platform worktree and its skill submodule on feature branches. No merge, deployment, service restart or modification of the live checkout.

## Tasks
1. Prepare submodule and records.
2. Import engine with provenance; synthetic regression fixtures only.
3. Declare required EPMS/config XLSX and multiline site IDs.
4. Implement safe manifest adapter, progress, reports/ZIP, integrity and reconciliation.
5. Separate text/formula safety changes; no engineering quantity fixes.
6. Wire generic runner, route, navigation and reviewed fingerprint.
7. Sequential offline Python/platform validation, isolation/timeout/cancellation.
8. Review and commit skill first, then platform gitlink. No push pending review.

## Release decision
Broken template formulas are detected/reported, never silently repaired. No real business workbook, BOX registry, build or credentials may be committed.
