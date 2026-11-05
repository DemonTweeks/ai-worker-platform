# dev01 local SQLite implementation

## Status

First local implementation complete and automated acceptance passed. Application changes are in existing `dev01`, not a full fork in the planning repository. Changes are not yet committed/pushed or deployed to production. No live Firebase data exported/imported and no real PR submitted.

User authorized editing. Initial editable surfaces are `local_settings` (admin-managed JSON documents) and `admin_data_notes` (annotations linked to exact records). These are deliberately separate from business results and skill-owned configuration. Settings do **not** change runtime environment, worker behavior or skill approvals. Credentials must not be stored here. Secrets are redacted by key-pattern matching, which is defense in depth, not a guarantee for secrets embedded in arbitrary text.

## Running local development

- Frontend: http://127.0.0.1:3001/
- Admin login: http://127.0.0.1:3001/#/admin/login
- Data Management: http://127.0.0.1:3001/#/admin/data
- Backend: http://127.0.0.1:8001/api/health
- Database: `C:\Development\ai-worker-platform-dev01\storage\dev01\database\platform.db`.
- Files: `storage/dev01/files`; RAN workspaces: `storage/dev01/ran-workspaces`.
- Private generated credentials: `config/env/local.env`, username `admin`; retrieve ADMIN_DEFAULT_PASSWORD from that local file, not Git or shared logs. Password and JWT secret were generated independently, not copied from production. Local environment and storage ACLs restricted to current Windows user and SYSTEM.
- These are development Node/Vite processes, not registered Windows services. Run from this worktree only. Do **not** use the production launcher for this test setup.

Restart backend from `backend`: `node src/server.js`. Restart frontend from `frontend`: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3001 --strictPort`.

Production ports 8000/3000 remain separate. Current production was observed at `0abb1c54fe25c953b6354e9d4ee450e2bb8c99c0` (`docs: record shared MW Auditor production activation`), newer than the inspected dev01 baseline `0aa085d`. This implementation did not fetch, merge, deploy, restart or change production. Before eventual integration/deployment, reconcile upstream changes separately and rerun acceptance. Production health still shows Firebase/queue OK, frontend 200 and existing degraded overall status.

## Features

- Explicit `DB_PROVIDER=firebase|sqlite`, default Firebase for backward compatibility. SQLite requires Node 24+ and an explicitly initialized database. Missing/unsupported/corrupt databases fail closed.
- SQLite schema 1 stores JSON documents with generated indexed History fields, WAL, busy timeout, FULL synchronous policy and transaction/revision guards.
- Existing Firebase REST/mock implementation retained in `firebaseRestClient.js`; compatibility helper exports delegate via provider-neutral `databaseClient.js`.
- Queue transactions remain atomic; changed-field Job.save uses baseline conflict checks so stale worker objects do not overwrite heartbeat/cancellation updates. Conflicting writes fail explicitly rather than losing a newer field value. Job IDs have create-if-absent protection in SQLite.
- Provider-aware health adds `services.database`; `firebase` remains a deprecated compatibility alias containing the real provider.
- Authenticated `/api/admin/data` API and `/admin/data` UI: counts, paginated/searchable identities, status/worker/scope filters, formatted redacted JSON, local settings edits, record annotations, previews, optimistic revisions, transactional audit and bounded redacted page export.
- Online import: `local_settings` only, 64 KiB/100 records, validation, preview, actor-bound expiring signed token, exact data/revision matching, confirmation, consistent backup and atomic apply. Database changes after preview require a new preview. No arbitrary tables, SQL console, whole-database overwrite, execution-field editing or credential editing.
- `assets` editing remains disabled because assets are skill-owned.

## Private offline CLI

Run from backend:

```
node scripts/database-cli.js init <new-db>
node scripts/database-cli.js info <db>
node scripts/database-cli.js backup <db> <new-backup-db>
node scripts/database-cli.js export-offline <db> <new-private-json>
node scripts/database-cli.js import-fresh <new-db> <private-json>
```

`init` and import never overwrite an existing file. Use a stopped, offline runtime for migration imports, restores and consistent metadata/artifact snapshots. Backup uses SQLite VACUUM INTO, not an unsafe live .db copy. Private migration JSON must use format `platform-private-migration`, schemaVersion 1 and a `collections` object. It can include credentials: protect filesystem permissions and never share/commit it. The CLI deliberately does not fetch Firebase. Authorized Firebase snapshots need explicit reviewed wrapping. Import rejects non-terminal jobs to prevent accidental replay; queued/running jobs require separate drain/reconciliation design and approval. File artifacts are not in database exports and must be copied/verified separately.

UI exports are redacted `platform-data-view` bundles, NOT lossless backups and NOT accepted as online imports. Online import uses `platform-settings-import`, schemaVersion 1, collection `local_settings`, each record containing key, expectedRevision (0 for insert) and a validated document. See UI example.

## Validation

- Full backend `npm test` passes. New deterministic runner isolates Firebase mock regressions from local.env, then runs SQLite checks and the approved offline worker fixtures against fresh databases, blocking non-loopback fetches in those fixtures.
- 39 SQLite checks: JSON/Unicode/null semantics, nested files, injection rejection, rollback, async and real cross-process contention, stale saves, duplicate IDs, Planning filter, auth, secret-path bypass rejection/redaction, restricted audited edits, annotations, preview/no-write, tamper/stale/conflict rejection, backup-before-import, import replay rejection and persistence across restarts.
- SQLite worker fixtures: durable queue, registry, job-create concurrency, uploader offline validation/Planning, real MW and RAN local execution and TX BOM synthetic multipart/download/hash/ZIP/cancellation/timeout acceptance all pass. No real corporate requests or PR submissions.
- Frontend: 117 tests / 20 files, build and 14 route HTTP smoke checks pass. Route smoke verifies served entry HTML, not interactive browser behavior.
- CLI synthetic acceptance: fresh import, Planning preservation, private export, backup reopen, overwrite refusal, nonterminal replay rejection all pass.
- Running local dev01 health: SQLite/queue OK, active=0, queued=0, frontend HTTP 200. No signed-in browser UAT performed yet.

Logs retained under `command-center/results/dev01-sqlite-*`; synthetic databases/artifacts retained under ignored `command-center/runtime/sqlite-*` and `persistence-regression-*`. Credentials/database/private exports are not staged.

## Remaining work before live migration/production readiness

- Interactive browser UAT with the user; upstream reconciliation; live-data volume measurements and history performance tests.
- SQLite DatabaseSync currently runs bounded admin queries on Node's event loop. Existing model-based History still reads collections in memory; indexes are used by the new admin list, not yet every legacy query. No untested scale or full async-worker claim.
- Extend exact domain schemas/count/hash validation for an authorized real Firebase export and artifact snapshot; production migration/rollback rehearsal and separate approval remain required.
- No AWS work, internet exposure, autoscaling, online business-data import or unrestricted DB editing in this release.
