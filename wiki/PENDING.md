# AI Worker Platform - Pending Items

Open deployment items are listed below.

Completed work is recorded in [PLAN.md](PLAN.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [HANDOVER.md](HANDOVER.md). Add only genuinely unresolved work to this file; do not retain completed checklist entries.

## P-002 - Production Credential Rotation and Host Provisioning

The former `repack/ai-worker-platform` branch committed a live LLM credential. Rotate/revoke that credential, then provision the replacement only in the production host's ignored `config/env/production.env` (or an external secret injector). Also set a stable, unique `AI_WORKER_MACHINE_ID`, administrator password, and JWT secret.

Remove this item after the rotated credentials are installed and both `/api/health` and `/fe/` are validated through the production Nginx endpoint.

## P-003 - iEPMS Live Host Validation

The standard contract is published at `f094cc1` on `Gumb-D/iepms-pr-upload-automation` branch `migration/zx01-pc` and pinned in the platform integration. Validate the draft-only flow on the intended backend host with corporate connectivity, authenticated CDP Chrome, one shared persistent recovery root, verified PSQ, downloads, and retry recovery. See [the dedicated pending items](iepms-pr-upload-automation/PENDING.md).
