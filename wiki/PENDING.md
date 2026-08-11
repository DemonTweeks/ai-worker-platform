# AI Worker Platform - Pending Items

No open refactor items remain from the thin skill-wrapper plan.

Completed work is recorded in [PLAN.md](PLAN.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [HANDOVER.md](HANDOVER.md). Add only genuinely unresolved work to this file; do not retain completed checklist entries.

## P-002 - Production Credential Rotation and Host Provisioning

The former `repack/ai-worker-platform` branch committed a live LLM credential. Rotate/revoke that credential, then provision the replacement only in the production host's ignored `config/env/production.env` (or an external secret injector). Also set a stable, unique `AI_WORKER_MACHINE_ID`, administrator password, and JWT secret.

Remove this item after the rotated credentials are installed and both `/api/health` and `/fe/` are validated through the production Nginx endpoint.
