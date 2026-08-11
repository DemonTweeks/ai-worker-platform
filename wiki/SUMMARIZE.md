# AI Worker Platform - Summary

AI Worker Platform is now a generic control plane for three approved Python skills: `create-pr-cd`, `create-pr-cd-ran`, and `tx-pr-auditor`.

The platform owns HTTP(S), safe uploads, isolated workspaces, Firebase-backed lifecycle and queue ownership, Python process supervision, progress relay, cancellation, structural result validation, retained metadata, and downloads. Each skill owns its workbook interpretation, calculations, domain validation, warnings, and output content.

Queue state survives restart through Firebase leases carrying a stable `machineId` and per-start `runtimeInstanceId`. Generic jobs can be rerun from retained contract inputs. Historical legacy jobs remain readable/downloadable but return a safe new-request explanation when rerun.

Legacy MW/auditor launch pages and execution adapters have been retired. No refactor item remains in [PENDING.md](PENDING.md).

The Node control plane no longer depends on workbook parsing or archive-generation libraries. Those concerns are package-owned Python behavior.

Local and production deployment are now runtime profiles of the same `main` code line. A centralized `config/env/` contract supplies both backend and frontend values, launchers no longer mutate Git branches, production uses a same-origin Nginx `/fe/` deployment, and the stable machine ID remains part of Firebase queue ownership.
