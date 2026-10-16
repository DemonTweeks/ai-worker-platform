# iEPMS PR Upload

The platform exposes the guarded submit-and-verify wrapper from `Gumb-D/iepms-pr-upload-automation`. The published pin is `397010e`, v0.3.1, with genuine XLS and XLSX support. The inspected host runs an uncommitted v0.3.2 fix; see [deployment state](DEPLOYMENT_SNAPSHOT_2026-10-15.md).

Upload one ECC workbook and optionally a separate attachment. Without a separate attachment, the ECC is attached as evidence. Choose project, TSS/TI, DU model, planned start date and two Y/N flags. Validation, immutable identity, signed API workflow and recovery are skill-owned. The platform calls `submit_request`; success requires submitted and verified server state, not just a PSQ. Tracker and Implementation Plan updates are excluded. Desktop `prepare_request` remains draft-only.

Open `/#/workers/iepms-pr-upload` locally or `/fe/#/workers/iepms-pr-upload` in production. Corporate connectivity and an authenticated CDP Chrome on the backend host are required; the remote frontend browser alone cannot supply that session.

W16 completed submission and verification. W14 created a draft but failed server import; W15 failed local Excel-error validation. Live test evidence and deployment provenance are described in the [handover](HANDOVER.md) and [dated snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md). Do not retry known drafts blindly.
