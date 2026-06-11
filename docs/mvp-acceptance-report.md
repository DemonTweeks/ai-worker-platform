# AI Worker Platform MVP Acceptance Report

## 1. Project Overview

The AI Worker Platform MVP provides a browser-based PR Worker workflow for generating create-pr-cd ECC outputs from iEPMS export data. It includes normal user job execution, realtime progress, historical job review, Re-Ask, admin asset management, report packaging, health monitoring, resource protection, and Docker deployment artifacts.

## 2. Accepted EPIC List

- EPIC 0 — Project Foundation: ACCEPTED
- EPIC 1 — Database Layer: ACCEPTED
- EPIC 2 — Local File Storage Layer: ACCEPTED
- EPIC 3 — Backend Core API Layer: ACCEPTED
- EPIC 4 — Admin Portal Backend Layer: ACCEPTED
- EPIC 5 — PR Worker Execution Layer: ACCEPTED
- EPIC 6 — WebSocket / Realtime Layer: ACCEPTED
- EPIC 7 — LLM / MaaS / Qwen Integration Layer: ACCEPTED
- EPIC 8 — Vue2 Frontend User Portal: ACCEPTED
- EPIC 8.1 — TSS/TI Scope Payload Hotfix: ACCEPTED
- EPIC 9 — Job History / Job Detail Layer: ACCEPTED
- EPIC 10 — Admin Portal UI: ACCEPTED
- EPIC 11 — Reports and Excel Output Layer: ACCEPTED
- EPIC 12 — Health and Monitoring Layer: ACCEPTED
- EPIC 13 — Resource Protection and Cleanup: ACCEPTED
- EPIC 14 — Deployment Layer: ACCEPTED
- EPIC 15 — Testing and QA: ACCEPTED, pending final commit hash in repository history

## 3. Latest Commit Hashes

- EPIC 0: `d58baf5`
- EPIC 1 / EPIC 2 foundation: `85e7e24`
- EPIC 3: `c8baba2`
- EPIC 4: `fbc4de7`
- EPIC 5: `5650435`
- EPIC 6: `55551a1`
- EPIC 7: `4692e6c`
- EPIC 8: `e6624e0`
- EPIC 8.1: `9d34d9b`
- EPIC 9: `d4ae9e2`
- EPIC 10: `4300f94`
- EPIC 11: `62e9fcc`
- EPIC 12: `e898f64`
- EPIC 13: `f723f39`
- EPIC 14: `a14d2be`
- EPIC 15: see final `epic-15: testing and qa` commit

## 4. Architecture Summary

- Frontend: Vue2 with Vite.
- Backend: Express.js / Node.js CommonJS.
- Database: local MongoDB.
- Storage: local folder storage.
- Realtime: WebSocket.
- Worker integration: child process execution of `skills/create-pr-cd/scripts/generate_tss_pr_ecc.py`.
- LLM: internal MaaS/Qwen-compatible provider with safe fallback.
- Deployment: Windows 11 Pro + Docker Desktop + Docker Compose.

## 5. Main User Flow

Normal users can upload an iEPMS export, prevalidate it, select TSS or TI scope, choose all sites or specific site codes, create a job, monitor realtime progress, view final summary, download ZIP output, and ask Re-Ask questions.

## 6. Admin Flow

Admins can log in, upload inactive asset versions, activate one active version per asset type, view audit logs, and inspect system health.

## 7. Worker Execution Summary

EPIC 15 integration verification exercised real PR Worker jobs through the backend flow:

- TSS job completed with warnings.
- TI job completed.
- ZIP downloads succeeded.
- create-pr-cd business logic was not modified.

## 8. LLM Verification Summary

The LLM layer supports disabled/failure fallback. Earlier real provider verification confirmed direct MaaS/Qwen and Re-Ask success when local credentials are configured. EPIC 15 automated tests run with LLM disabled to avoid secrets and verify fallback safety.

## 9. WebSocket Verification Summary

EPIC 15 integration verification covered WebSocket connection, malformed message error, invalid job error, valid subscribe, JOB_EVENT receipt, reconnect, and resubscribe.

## 10. Report / Output Verification Summary

Generated outputs are collected, reports are generated, and ZIP package downloads are available. ZIP packaging includes `ECC_Output/` and `Summary.json`, with warning/review reports generated when applicable.

## 10.1 Post-MVP Maintenance Validation

Sabah/Sarawak TI coordinate-to-city mapping was verified through the platform workflow after the `create-pr-cd` geography resolver update.

- Issue: Sabah/Sarawak TI coordinate-to-city mapping for TI route and warehouse resolution.
- Standalone implementation commit: `00685336058c097a293dee0d72a1fbc8170c0b4f` (`feat: resolve Sabah Sarawak TI routes by coordinates`).
- Parent submodule pointer commit: `79dbf57793c0ea3039ff8819b9f7493bc7beda65` (`chore: update create-pr-cd geography resolver`).
- Parent lockfile cleanup commit: `5ddf7034dfa6cf8124884374b30feb9b7d3bfbd7` (`chore: remove stale mongoose lockfile entries`).
- Regression validation: backend `npm ci` passed, backend smoke passed, backend integration passed, frontend production build passed, and frontend route smoke passed.
- Platform UAT job: `PR-20260611-014`.
- UAT scope/site: `TI`, site code `7312B_HU`.
- Generated ECC: `Sabah-GTSB TX Mini Project TI PR 20260611.xls`.
- Verified ECC material codes: `350000212476`, `350001095405`, `350000589315`.
- Verified ECC item count: 3.
- Verified resolution: State `Sabah`, route/district bucket `Tawau`, Sabah warehouse selected.
- `REVIEW_REQUIRED` count: 0.
- Job status: `completed`.
- Known unresolved rule: Lawas Inland Transportation can resolve; Lawas Simple Packing remains fail-closed because the business mapping is not confirmed.

## 10.2 XLSX Output Format Maintenance Validation

Generated ECC workbooks previously used a `.xls` filename even though the `create-pr-cd` generator wrote Open XML workbook content through `openpyxl`. This caused Excel extension/format mismatch warnings in UAT.

- Issue: Platform TI UAT generated `Sabah-GTSB TX Mini Project TI PR 20260611.xls` for an Open XML workbook.
- Corrected behavior: New ECC outputs use `.xlsx` filenames and XLSX/Open XML content.
- Standalone implementation commit: `32f1da236a62042989ea63dce30ca95c4b3006ea` (`fix: generate ECC workbooks as xlsx`).
- Parent submodule pointer commit: `883146734092ea88892eaff2467374437f7cbf91` (`chore: update create-pr-cd xlsx output fix`).
- Regression validation: standalone Python compile passed, standalone geography unit tests passed, standalone TI smoke tests passed, backend `npm test` passed, and frontend `npm test` passed.
- Platform UAT job: `PR-20260611-019`.
- UAT scope/site: `TI`, site code `7312B_HU`.
- Generated ECC: `Sabah-GTSB TX Mini Project TI PR 20260611.xlsx`.
- Verified workbook signature: `PK`, confirming ZIP/Open XML content.
- Verified workbook parser reopen: `details` sheet opened successfully through the backend `xlsx` parser.
- Verified ECC material codes: `350000212476`, `350001095405`, `350000589315`.
- Verified ECC item count: 3.
- `REVIEW_REQUIRED` count: 0.
- ZIP verification: `PR-20260611-019-outputs.zip` contains `ECC_Output/Sabah-GTSB TX Mini Project TI PR 20260611.xlsx`.
- API/download metadata: ECC download response used `attachment; filename="Sabah-GTSB TX Mini Project TI PR 20260611.xlsx"`.

## 11. Resource Protection Summary

The MVP enforces upload size, row count, site-code count, queue concurrency, job timeout, output file count, and retention metadata. Cleanup supports dry-run and controlled deletion of expired terminal-job files while preserving metadata.

## 12. Deployment Readiness Summary

Dockerfiles, nginx frontend serving, Docker Compose services, persistent volumes, and Windows deployment documentation are present. Docker runtime verification remains pending on a Windows 11 Pro Docker Desktop host because Docker CLI is unavailable in the current execution environment.

## 13. Known Limitations

- Local single-machine MVP, not high availability.
- Docker runtime must be verified on the target Windows 11 Pro Docker Desktop host.
- Cleanup service is manual/testable; no automatic scheduler is enabled.
- Real LLM success depends on internal MaaS/Qwen network access and valid local `.env`.
- MongoDB Docker service is internal-network oriented and not configured for public exposure.

## 14. Open Risks

- Operational backups must be tested before production-like internal use.
- Admin credentials and JWT secret must be changed from placeholders before deployment.
- Firewall/network access must be controlled for internal deployment.
- Large real-world datasets should be validated during UAT against agreed resource limits.

## 15. Final Readiness Decision

The MVP is ready for controlled internal UAT after Docker runtime verification on the target Windows 11 Pro Docker Desktop host.
