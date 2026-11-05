# iEPMS PR Upload: PSQ, PO Name and PO Amount

## Local implementation (uploader 0.3.7)

- PO Name is the exact `requirementDescription` from identity/project-bound,
  post-submit verified `/pr/detail`. No reconstruction from input, file name,
  or a prior draft description. Blank final descriptions remain unavailable.
- PO Amount comes from the final PR key-fields read. Existing Golden adapter
  normalizes `requirementAmount` to `amount` and `currencyCode` to `currency`.
- Public metrics: `psq`, `poName`, `poAmount` (decimal string), `currency`,
  and `poAmountDisplay` (currency-qualified grouped display).
- Amount strings retain server precision; zero is valid; malformed, negative,
  boolean and nonfinite amounts are unavailable. No ECC total calculation.
- Manifest fields show PSQ, PO Name, PO Amount, then existing technical fields
  in job detail and History. The existing generic frontend needs no source change.
- JSON reports contain the structured fields; HTML adds labelled primary results
  and HTML-escapes server text.
- A verified submission with missing display metadata is `succeeded_with_warning`
  (`IEPMS_RESULT_METADATA_INCOMPLETE`), not an upload failure. It explicitly says
  not to resubmit. Unverified outcomes never publish draft metadata as final.
- The existing saved result cache preserves fields on replay and does not fetch
  metadata or repeat submission. Legacy saved results have unavailable metadata;
  no historical backfill, migration, resubmission, tracker or IP change.

## Verification

- Full offline uploader pytest suite, including TSS/TI/Planning, exact server name,
  decimal/currency handling, zero, missing final fields, identity mismatch,
  escaped report output, and saved-result replay.
- Full frontend unit suite, including job detail and History result fields.
- Generic platform contract tests with explicit in-memory mock provider.
- XLS/XLSX uploader-to-Python/report integration against a fresh isolated SQLite
  fixture with unavailable local CDP; real portal submission is impossible.
- Test logs retained in conversation folder as `po-result-*.log`.

## Deployment boundary

Local source and approval fingerprint only. No live iEPMS submission, historical
job replay, commit, push, production deployment or restart is included in this
change authorization. Commit the uploader first, then platform gitlink/approval
before a separately authorized production deployment.

### Final measured results

- Uploader Python: **417 passed**, 44.14 seconds.
- Frontend unit: **119 passed**, 20 files.
- Frontend build passed; smoke checks passed for **14 routes**.
- Generic platform contract, isolated SQLite uploader integration and cross-platform
  fingerprint normalization passed.
- Approved local runtime SHA256:
  `b8351db1a3b56a62a8cdd760e8e9796de0f5082e2279046f8225f2103dc7d36d`.
- SQLite integration evidence: `command-center/runtime/sqlite-fixture-MgVYk1`.
- Initial test attempts required explicit PYTHONPATH and a test-only provider
  override to avoid local.env SQLite/mock conflict; final logs supersede those
  configuration-only failures. No production database or live portal was used.

## Release authorization

The user subsequently authorized commit, push, production deployment and backend
restart. Release uses non-force pushes to uploader `main` and platform `main`,
exact pinned submodules, and an idle-queue check before backend restart. No live
iEPMS submission, historical replay, tracker or IP mutation is authorized.
