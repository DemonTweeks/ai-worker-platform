# AI Worker Platform — Analysis Summary

> Status: provisional baseline for further discussion
> Analyzed: 2026-08-10
> Repository branch: `refactor/all`

## Purpose

AI Worker Platform is an internal HTTP(S) control plane and thin wrapper for running standalone Python skills through a shared job lifecycle:

- MW PR Worker (`mw-pr`)
- RAN PR Worker (`ran-pr`)
- PR Auditor (`pr-auditor`)

The platform owns HTTP(S), authentication, generic request and file transport, skill discovery, job state, safe process execution, persistence, progress delivery, and downloads. Each skill owns domain validation, technical processing, business rules, templates, and output correctness.

## Architecture

```text
Vue 2 frontend
    -> Nginx reverse proxy
    -> Express REST API + WebSocket server
    -> in-process job queue
    -> generic skill registry and runner
    -> standalone Python skill
    -> Firebase job metadata + local job files
```

## Current Verdict

The current MVP demonstrates the job lifecycle, but it contains worker-specific platform logic that must move behind the standard skill contract before the thin-wrapper architecture is complete.

### Blocking issue

The checked-out MW engine is at `048931a5`, while the platform manifest approves commit `7971f90` and a different runtime fingerprint. The backend correctly refuses to start because engine integrity verification fails.

This needs a deliberate decision:

1. Restore the engine submodule to the approved commit; or
2. Validate and formally promote `048931a5`, then update the approved commit and runtime fingerprint.

Do not update the fingerprint without business regression validation.

## Main Findings

1. Docker support has been removed. Local and Windows runtime paths must be the supported and verified deployment baseline.
2. Firebase REST is the sole persistence backend. Its production authentication, namespace isolation, backup, and recovery requirements still need to be formalized.
3. The queue and active worker states are stored only in process memory. A restart can strand persisted jobs in `queued` or running statuses. See [PENDING.md](PENDING.md#p-001--durable-queue-and-restart-reconciliation).
4. The platform currently includes domain workbook parsing, worker-specific services, output ingestion, and worker-specific request branches. These responsibilities belong in standalone skills.
5. ZIP creation does not handle output write-stream errors. An integration run produced an unhandled `ENOENT` and terminated Node.
6. Windows production configuration needs startup validation that rejects missing or unsafe admin credentials and JWT secrets.
7. CORS is unrestricted, and uploads are buffered in memory.
8. The default backend test command excludes seven PR Auditor suites and six additional RAN suites.
9. There is no repository CI configuration.
10. Several core files have grown too large, especially `jobService.js`, `PRCreatorView.vue`, and `workerRuntime.js`.

## Validation Snapshot

- Backend smoke test without Firebase mock: failed because Firebase was unreachable.
- Backend tests with Firebase mock: smoke, LLM, health, and preflight passed; engine integrity then failed on the MW engine mismatch.
- Numerous independent backend suites passed, including the PR Auditor adapter, route, concurrency, ingestion, summary, worker service, and workspace tests.
- Integration test crashed during ZIP package creation.
- Prevalidation guard assertions passed, but the test process aborted during shutdown under Node 24.
- RAN golden validation did not complete reliably during this analysis.
- Frontend tests were not runnable because `frontend/node_modules` was absent.
- No tracked source files were changed during analysis. The existing `skills/create-pr-cd` submodule change was preserved.

## Recommended Order

1. Approve [SKILL_CONTRACT.md](SKILL_CONTRACT.md) as the platform/skill boundary.
2. Build a generic manifest registry and skill runner using a synthetic standalone skill.
3. Migrate MW, RAN, and PR Auditor domain logic behind the contract one skill at a time.
4. Remove replaced worker-specific parsers, services, and output ingestion from the platform.
5. Add startup job reconciliation and restart-safe queue behavior.
6. Harden output publication, Firebase access, Windows deployment, and the HTTP(S) security boundary.
7. Build separate platform contract tests and skill-owned domain/golden test gates.

## Open Discussion Topics

- Whether `048931a5` is intended to become the new approved MW engine.
- Approval of the manifest, input, event, result, and exit-code contract.
- Skill discovery versus explicit administrative approval.
- Per-skill Python dependency isolation on Windows.
- Required production authentication, namespace, backup, and recovery controls for Firebase.
- Required behavior for queued/running jobs after restart.
- Intended network exposure and authentication model for user job endpoints.
- Required Windows host topology and service-management process.
- Which finding should become the first implementation milestone.
