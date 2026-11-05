# Local SQLite cutover — 2026-11-05

User authorized development and production to use independent copies of the exported `ai-worker-platform` Firebase branch; do not import/merge `ai-worker-platform-test` or unrelated applications.

- Source SHA-256: `1b2d4aab54143dc5b62bee5fc1642b3fbf6cce80f63eed7eb67a736371ee9e37`.
- Preserve collection names, record keys, nested JSON, admin account/password hashes, and all existing path strings. SQLite is a document-backed database, not a JSON directory mirror.
- 979 jobs; 69 queued cancelled and 5 interrupted jobs failed with migration explanation, status event, terminal queue state, and 74 audit entries. Original records retained privately. No automatic replay, resume, or iEPMS submission.
- Result statuses: 504 completed, 253 failed, 146 completed_with_warning, 75 cancelled, 1 cancelled_with_partial_result.
- 5,017 file records, 698 review records, 8,849 warning records, one admin, 152 audit records. Counts in the Firebase export's nested collections are parent job groups, not individual child records.
- Separate files: dev01 `storage/dev01/database/platform-import-20261105.db`; production `storage/database/platform-import-20261105.db`.
- Keep existing `STORAGE_ROOT` per environment. Relative paths in development still resolve under development's own storage root. No artifact copy, path rewrite, existence check, hash check, or download guarantee requested/performed.
- Exact logical JSON comparison and SQLite integrity check passed against the prepared import bundle in both files before startup. Runtime health writes can subsequently change `health`.
- Private source, bundles, environment backups, logs and evidence are in the conversation's ACL-protected `sqlite-cutover-20261105-155246` directory. Never commit these.
- SQLite implementation reconciled onto production baseline `0abb1c5`, preserving current skill gitlinks and shared-MW Auditor acceptance. Keep the Git checkpoint stash until user accepts.
- Do not use disabled Firebase as automatic rollback. Restore an approved local SQLite backup and matching configuration with writers stopped. Reconcile later writes before rollback.
- This is local deployment only, not AWS or an internet exposure change. Existing listeners/network settings are preserved.
