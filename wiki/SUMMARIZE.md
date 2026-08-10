# AI Worker Platform — Analysis Summary

> Status: provisional baseline for further discussion
> Analyzed: 2026-08-10
> Repository branch: `main`

## Purpose

AI Worker Platform is an internal browser-based platform for running three business-domain workers through a shared job lifecycle:

- MW PR Worker (`mw-pr`)
- RAN PR Worker (`ran-pr`)
- PR Auditor (`pr-auditor`)

The platform owns the user interface, API, queueing, job state, WebSocket progress, storage, reporting, downloads, administration, and runtime safety. The worker submodules own business rules and document transformations.

## Architecture

```text
Vue 2 frontend
    -> Nginx reverse proxy
    -> Express REST API + WebSocket server
    -> in-process job queue
    -> worker registry and adapter
    -> pinned Python worker engine
    -> Firebase job metadata + local job files
```

## Current Verdict

The architecture is suitable for an MVP, but the current checkout is not release-ready.

### Blocking issue

The checked-out MW engine is at `048931a5`, while the platform manifest approves commit `7971f90` and a different runtime fingerprint. The backend correctly refuses to start because engine integrity verification fails.

This needs a deliberate decision:

1. Restore the engine submodule to the approved commit; or
2. Validate and formally promote `048931a5`, then update the approved commit and runtime fingerprint.

Do not update the fingerprint without business regression validation.

## Main Findings

1. Docker support has been removed. Local and Windows runtime paths must be the supported and verified deployment baseline.
2. Firebase REST is the sole persistence backend. Its production authentication, namespace isolation, backup, and recovery requirements still need to be formalized.
3. The queue and active worker states are stored only in process memory. A restart can strand persisted jobs in `queued` or running statuses.
4. ZIP creation does not handle output write-stream errors. An integration run produced an unhandled `ENOENT` and terminated Node.
5. Windows production configuration needs startup validation that rejects missing or unsafe admin credentials and JWT secrets.
6. CORS is unrestricted, and prevalidation accepts large public uploads into memory.
7. The default backend test command excludes seven PR Auditor suites and six additional RAN suites.
8. There is no repository CI configuration.
9. Several core files have grown too large, especially `jobService.js`, `PRCreatorView.vue`, and `workerRuntime.js`.

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

1. Decide the MW engine version and restore integrity.
2. Verify Windows/local engine paths and formalize Firebase production controls.
3. Add startup job reconciliation and restart-safe queue behavior.
4. Harden ZIP/output stream error handling.
5. Build a complete, hermetic test and CI gate.
6. Remove insecure deployment defaults and restrict public boundaries.
7. Split oversized services and views after behavior is protected by tests.

## Open Discussion Topics

- Whether `048931a5` is intended to become the new approved MW engine.
- Required production authentication, namespace, backup, and recovery controls for Firebase.
- Required behavior for queued/running jobs after restart.
- Intended network exposure and authentication model for user job endpoints.
- Required Windows host topology and service-management process.
- Which finding should become the first implementation milestone.
