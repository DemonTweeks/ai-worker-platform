# iEPMS PR Upload

The platform exposes the guarded submit-and-verify wrapper from `Gumb-D/iepms-pr-upload-automation`. The published pin is `397010e`, v0.3.1, with genuine XLS and XLSX support. The inspected host runs an uncommitted v0.3.2 fix; see [deployment state](DEPLOYMENT_SNAPSHOT_2026-10-15.md).

Upload one ECC workbook and optionally a separate attachment. Without a separate attachment, the ECC is attached as evidence. Choose project, TSS/TI, DU model, planned start date and two Y/N flags. Validation, immutable identity, signed API workflow and recovery are skill-owned. The platform calls `submit_request`; success requires submitted and verified server state, not just a PSQ. Tracker and Implementation Plan updates are excluded. Desktop `prepare_request` remains draft-only.

Open `/#/workers/iepms-pr-upload` locally or `/fe/#/workers/iepms-pr-upload` in production. Corporate connectivity and an authenticated CDP Chrome on the backend host are required; the remote frontend browser alone cannot supply that session.

W16 completed submission and verification. W14 created a draft but failed server import; W15 failed local Excel-error validation. Live test evidence and deployment provenance are described in the [handover](HANDOVER.md) and [dated snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md). Do not retry known drafts blindly.


## New DU-model availability — 2026-10-16

Local unreleased v0.3.3 adds `2024 Celcomdigi BAU`, `Celcomdigi USP` and `Jendela TX Migration` to Malaysia CelcomDigi Project only. See [contract and release boundary](SKILL_CONTRACT.md#additional-du-models--local-v033-2026-10-16). Existing models, submit-only limits and workbook validations are preserved. No commit, push, restart or live new-model submission was performed for this implementation. Historical v0.3.2 deployment observations below/above remain dated evidence, not the current working-tree version.


## Release update — v0.3.3 (2026-10-16)

Uploader v0.3.3 is now published on main at `93f303825fd03094e15019ded55b479633197292`. The accompanying platform release pins that exact commit and approves runtime fingerprint `0148ae1bba4eaedf41a509f3906cd115797dc707b677ba51772e55eefa5f1c83`. This supersedes earlier descriptions of v0.3.2/v0.3.3 as uncommitted local changes; dated live observations and unresolved W14/W15 blockers remain historical evidence and are not cleared by publishing.

The release includes the three new Malaysia CelcomDigi DU options and earlier safe row-validation/reporting fixes. Restart and inspect `/api/skills` for v0.3.3 and all seven models before claiming activation. No live new-model PR, tracker update or Implementation Plan write is part of this release.
