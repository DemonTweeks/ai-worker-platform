# AI Worker Platform - Pending Items

Open deployment items are listed below.

Completed work is recorded in [PLAN.md](PLAN.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [HANDOVER.md](HANDOVER.md). Add only genuinely unresolved work to this file; do not retain completed checklist entries.

## P-002 - Production Credential Rotation and Host Provisioning

The former `repack/ai-worker-platform` branch committed a live LLM credential. Rotate/revoke that credential, then provision the replacement only in the production host's ignored `config/env/production.env` (or an external secret injector). Also set a stable, unique `AI_WORKER_MACHINE_ID`, administrator password, and JWT secret.

Remove this item after the rotated credentials are installed and both `/api/health` and `/fe/` are validated through the production Nginx endpoint.

## P-003 - iEPMS Release and Blocked-Import Follow-up

Live submit-and-verify was demonstrated by W16 (`PSQ202610150919`). Remaining work is not initial draft-only host provisioning: publish/re-pin the local v0.3.2 runtime fix, resolve W14 server padding rejection, inspect W15 P2, and retain stable shared recovery state. See [dedicated pending items](iepms-pr-upload-automation/PENDING.md).
