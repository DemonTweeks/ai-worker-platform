# AI Worker Platform — Analysis Summary

> Status: provisional baseline for further discussion
> Analyzed: 2026-08-10
> Repository branch: `refactor/thin-skill-wrapper-foundation`

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

The current MVP demonstrates the job lifecycle and now prevents a clean completion when generic requested-item reconciliation is incomplete. It still contains worker-specific platform logic that must move behind the standard skill contract before the thin-wrapper architecture is complete.

### Blocking issue

The checked-out MW engine is at `3954cc0`, while the platform manifest approves commit `7971f90` and its older runtime fingerprint. The newer engine adds PR-model baseline governance and changes runtime files, so engine integrity must continue to fail closed until the version is deliberately validated and promoted.

This needs a deliberate decision:

1. Restore the engine submodule to the approved commit; or
2. Validate and formally promote `3954cc0`, add its baseline-governance runtime files to the approved package, then update the approved commit and runtime fingerprint.

Do not update the fingerprint without business regression validation.

## Main Findings

1. Docker support has been removed. Local and Windows runtime paths must be the supported and verified deployment baseline.
2. Firebase REST is the sole persistence backend. Its production authentication, namespace isolation, backup, and recovery requirements still need to be formalized.
3. The queue and active worker states are currently stored only in process memory. The approved target makes Firebase authoritative for durable queue state, machine- and runtime-instance ownership leases, and restart reconciliation; implementation remains pending. See [PENDING.md](PENDING.md#p-001--durable-queue-and-restart-reconciliation).
4. The platform currently includes domain workbook parsing, worker-specific services, output ingestion, and worker-specific request branches. These responsibilities belong in standalone skills.
5. The platform now normalizes generic result-reconciliation counts and rejects clean completion for inconsistent or unaccounted work. The compatibility path discovers this contract from worker JSON; the target contract moves it directly into `result.json`.
6. `create-pr-cd` now pins one current PR model by version and SHA-256, blocks mismatches, analyzes candidate changes, and performs rollback-safe controlled promotion.
7. ZIP creation does not handle output write-stream errors. An integration run produced an unhandled `ENOENT` and terminated Node.
8. Windows production configuration needs startup validation that rejects missing or unsafe admin credentials and JWT secrets.
9. CORS is unrestricted, and uploads are buffered in memory.
10. The default backend test command excludes several worker-specific suites, and there is no repository-wide CI configuration.

## Validation Snapshot

- After the 2026-08-10 pull, all seven focused platform result-reconciliation scripts passed.
- All 18 `create-pr-cd` PR-model baseline, change-analyzer, and promotion tests passed at `3954cc0`.
- Backend smoke test without Firebase mock: failed because Firebase was unreachable.
- Backend tests with Firebase mock: smoke, LLM, health, and preflight passed; engine integrity then failed on the MW engine mismatch.
- Numerous independent backend suites passed, including the PR Auditor adapter, route, concurrency, ingestion, summary, worker service, and workspace tests.
- Integration test crashed during ZIP package creation.
- Prevalidation guard assertions passed, but the test process aborted during shutdown under Node 24.
- RAN golden validation did not complete reliably during this analysis.
- Frontend tests were not runnable because `frontend/node_modules` was absent.
- Platform `origin/main` through `11bb63d` and `create-pr-cd/main` through `3954cc0` have been incorporated into the working branch/checkouts for this refresh.

## Recommended Order

1. Approve [SKILL_CONTRACT.md](SKILL_CONTRACT.md) as the platform/skill boundary.
2. Build a generic manifest registry and skill runner using a synthetic standalone skill.
3. Migrate MW, RAN, and PR Auditor domain logic behind the contract one skill at a time.
4. Remove replaced worker-specific parsers, services, and output ingestion from the platform.
5. Add startup job reconciliation and restart-safe queue behavior.
6. Harden output publication, Firebase access, Windows deployment, and the HTTP(S) security boundary.
7. Build separate platform contract tests and skill-owned domain/golden test gates.

## Open Discussion Topics

- Whether `3954cc0` is intended to become the new approved MW engine and platform runtime fingerprint.
- Approval of the manifest, input, event, result, and exit-code contract.
- Skill discovery versus explicit administrative approval.
- Per-skill Python dependency isolation on Windows.
- Required production authentication, namespace, backup, and recovery controls for Firebase.
- Required behavior for queued/running jobs after restart.
- Intended network exposure and authentication model for user job endpoints.
- Required Windows host topology and service-management process.
- Which finding should become the first implementation milestone.
