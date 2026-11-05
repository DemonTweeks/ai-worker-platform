# Approved implementation decisions

## User direction

1. Implement in the existing `dev01` branch/worktree at `C:\Development\ai-worker-platform-dev01`. Do not create dev02 or fork the platform into the planning repository.
2. Use the recommended secured admin Data Management UI: browsing, filtering, formatted JSON, authorized export, audit history and only explicitly approved field edits. No editable field allowlist has yet been approved, so generic editing defaults to disabled. Existing purpose-built administration remains unchanged.
3. Include JSON import. Implement validation, dry-run/preview, conflict reporting and an explicitly confirmed guarded apply path, not an unrestricted database overwrite. First support fresh/offline database migration via an explicit CLI; online UI apply must have approved per-collection schemas and allowlists before it is enabled. Rejected imports must leave data unchanged. Redacted UI exports must be marked as not lossless migration backups.
4. Local development and validation only. AWS implementation/provisioning is out of current scope.

## Boundaries

- Existing production checkout, services, ports and Firebase data remain untouched.
- Do not copy the production environment or let dev01 connect to live Firebase by default.
- Use a separate SQLite database, storage root, RAN workspace, runtime identity, local ports and test configuration.
- Keep current worker packages, approvals, Planning behavior and business rules unchanged.
- No real iEPMS submission, live Firebase export or production cutover without separate authorization.
- No automatic replay of completed uploads or jobs during data import/recovery.
- Never commit databases, secrets, business workbooks, live exports or private backup files.
- Retain the existing platform repository as the application source of truth. This new repository holds the migration design/evidence.

## Initial implementation sequence

1. Inventory persistence paths, semantics, scripts and race-sensitive job saves; establish synthetic regression baseline.
2. Introduce the persistence interface and SQLite adapter, with explicit database initialization, migrations and fail-closed startup. Preserve Firebase as a transition provider without making Firebase requests in SQLite mode.
3. Test JSON semantics, all-write coordination, conditional queue claims, lease/cancellation races, restart recovery and backup/restore.
4. Integrate provider-aware startup/health and existing models without worker business-rule changes.
5. Add the authenticated read-only admin data browser and redacted export, then guarded import validation/preview and eligible apply workflows.
6. Run platform regression/offline acceptance and local user acceptance. Request separate approval for any live-data migration/cutover.

## Inventory notes from dev01

- Baseline: `0aa085dfbd5562857ddac22884b987cfe7714329`; dev01 was clean at inspection.
- Runtime probe previously verified Node 24.18.0, SQLite 3.53.1 and JSON support. Backend currently declares Node >=20, so SQLite provider runtime requirements must be explicit and checked.
- Firebase client exports read, PATCH-style write, POST/push, PUT/replace and ETag-based transaction helpers. Mock behavior is not sufficient evidence of real Firebase semantic parity.
- Queue uses transactions on individual jobs; ordinary Job.updateOne/save currently write whole stale documents. Transactional storage alone does not fix stale-save overwrites; handle these explicitly.
- Existing admin routes enforce adminAuth after login. New database endpoints must follow that authorization boundary and add input limits/redaction/auditing.
- Existing generic asset management is deliberately disabled because business assets are skill-owned. The new Data UI must not re-enable it or bypass skill integrity/approvals.
- Health/startup and production environment validation explicitly reference Firebase; make these provider-aware while preserving API compatibility where required.
- Database metadata and actual artifact storage require separate, consistent backup/import validation.

## Current status

Decisions and inventory documented. Database adapter, UI, import implementation and migration are not yet implemented. No production data exported, services started, credentials copied or deployment performed by this step.
## Editing approval

User explicitly authorized editing and implementation. Initial safe editable surfaces are local_settings JSON and admin_data_notes annotations, with validation, preview, optimistic revisions and transactional audit. Local settings do not alter live skill/runtime configuration. Execution fields, credentials, hashes, worker-owned assets and audit history remain protected.

## Implementation update

First local implementation and automated acceptance completed. See [SQLITE_LOCAL_DEV01.md](SQLITE_LOCAL_DEV01.md) for current services, scope, evidence and remaining gates. Earlier status paragraphs are the historical approval snapshot.
