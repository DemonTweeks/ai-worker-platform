# AI Worker Platform - Summary

AI Worker Platform is a generic control plane for four approved Python skills: `create-pr-cd`, `create-pr-cd-ran`, `tx-pr-auditor`, and `iepms-pr-upload-automation`.

The iEPMS upload skill accepts one XLS/XLSX ECC workbook and an optional separate attachment (otherwise the ECC is attached). The platform invokes the guarded submit-and-verify workflow; it stops before tracker and Implementation Plan updates. Authenticated Chrome and corporate access are required on the backend host. A PSQ alone does not prove submission. See [its summary](iepms-pr-upload-automation/SUMMARIZE.md) and the [deployment snapshot](iepms-pr-upload-automation/DEPLOYMENT_SNAPSHOT_2026-10-15.md) for published-versus-local state.

The platform owns HTTP(S), safe uploads, isolated workspaces, Firebase-backed lifecycle and queue ownership, Python process supervision, progress relay, cancellation, structural result validation, retained metadata, and downloads. Each skill owns its workbook interpretation, calculations, domain validation, warnings, output content, and any internal dependency sequence.

Queue state survives restart through Firebase leases carrying a stable `machineId` and per-start `runtimeInstanceId`. Generic jobs can be rerun from retained contract inputs. Historical legacy jobs remain readable/downloadable but return a safe new-request explanation when rerun.

Legacy MW/auditor launch pages and Node execution adapters have been retired. The PR Auditor UI flow is preserved by `tx-pr-auditor` 1.1.0: Final PO + EPMS enters one Python skill job, which owns pinned TSS/TI entitlement generation and the focused audit.

The Node control plane no longer depends on workbook parsing or archive-generation libraries. Those concerns are package-owned Python behavior.

Local and production deployment are runtime profiles of the same `main` code line. A centralized `config/env/` contract supplies both backend and frontend values, launchers do not mutate Git branches, both profiles use hash routing, `VITE_APP_BASE` selects `/` locally or `/fe/` in production, and only production uses same-origin Nginx. The stable machine ID remains part of Firebase queue ownership.
