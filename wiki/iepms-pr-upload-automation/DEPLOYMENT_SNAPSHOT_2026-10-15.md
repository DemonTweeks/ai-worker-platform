# Deployment snapshot — 2026-10-15

This is a dated record, not a claim about future main tips or current PR approvals. Documentation was studied against platform `ec5fd9b37be5dbfe32fc6cd50f9776774c514dbd` before this documentation-only commit.

| Component | Recorded gitlink / commit | Version / meaning |
| --- | --- | --- |
| Platform runtime baseline | `ec5fd9b` | MW TI guidance integration |
| MW generator | `dc7cb77d656a367c0563c169271f784b15e7d287` | 4.0.1 |
| RAN generator | `15fae20943293091728d2308e78a8685735233de` | 1.1.2, contract branch; not RAN main |
| PR Auditor | `df14590a7a2b012d354471a652357533abb1dbdc` | 1.1.0 |
| Auditor nested MW | `8d8880ffb044a0273650f9c54fe1688efcc4623b` | Deliberately separate dependency |
| iEPMS published pin | `397010e842ec8546b8d06351b463657b31de1182` | 0.3.1 XLS/XLSX |
| iEPMS host working tree | `397010e` plus uncommitted source | 0.3.2 padding/error reporting; no release commit yet |

Published v0.3.1 approval SHA-256:
`1509b13322a06699b8494ea8818a1f823cc5af7fc89d5003b2e74826a2f1fa0f`

Inspected local v0.3.2 modified approval SHA-256:
`c77532f457e972c700070bd27d31f5cf777aae9a8dbcfb7d4542cd3dd02b6ccc`

Neither hash is a Git commit. A clean clone of this documentation commit still gets v0.3.1; documentation does not stage the local skill changes or the modified approval JSON. Do not call v0.3.2 published until both repos have reproducible commits and a matching platform pin.

Host repo: `C:\deployment\ai-worker-platform`. Public UI: `http://zte-tx.ddns.net/fe/#/workers/iepms-pr-upload`. CDP used: 19222. Live tests used 2026-10-22 planned start, N/N flags, and original ECC attachment fallback, with no tracker/IP writes.

Local evidence directory (not public artifacts):
`C:\Development\aida-chrome\aida-temp-script\conversation-c-mumi1ss1-kgnh`

- W14: `W14-fix-job-PR-20261015-015.json`, `W14-existing-draft-readonly.json`, `W14-PSQ202610150909-ImportResult.xls`, `W14-live-import-findings.md`.
- W15: `W15-job-PR-20261015-016.json`, `W15-safe-result-PR-20261015-016.json`.
- W16: `W16-job-PR-20261015-019.json`, `W16-safe-result-PR-20261015-019.json`.

Job engineCommit was null; exact deployed immutable identity was not attested by the job itself. Checked-out source/approval and live version were inspected separately. Historical records supplied from another PC were not freshly polled and are not included in this deployment snapshot.
