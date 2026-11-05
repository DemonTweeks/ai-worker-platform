# Skill contract

See [shared contract](../SKILL_CONTRACT.md) and skill docs/CONTRACT.md. Identity `tx-bom-generator` 0.1.1, schema/result version 1.0. Required file declarations `epms`/`config`, each single .xlsx, and required string parameter `siteIds` rendered as textarea. SupportsCancellation=false: queued-only cancellation. Timeout 3600s, no cooperative running cancellation.

NDJSON progress remains below 100 until final verification/packaging. Result statuses succeeded/succeeded_with_warning/failed, standard safe errors/warnings, exact reconciliation and per-site GENERATED/FAILED dispositions. Failed-site diagnostics and BOX/config warnings are separate. Declared output hashes are verified by generic runner. ZIP is skill-owned, not platform-created.

Local 0.1.1 compatibility fix pending release: exact legacy A1:BF1 count formulas are preserved with warning; other broken references/errors remain fatal. See [fix notes](../../docs/TX_BOM_LEGACY_HEADERS_0_1_1.md). Historical deployment statements above are not evidence of 0.1.1 activation.
