# TX BOM Generator — feature-branch migration

Skill 0.1.0, native Windows Python, private submodule `skills/tx-bom-generator`. Platform baseline 1dfc376619d59b643fce3da1c175ba0222e22a6f. This is a development integration, not a merged/deployed release.

Required every job: EPMS .xlsx, Config .xlsx, Customer Site IDs multiline text. Route `/#/workers/tx-bom-generator` (production base `/fe/#/workers/tx-bom-generator`). Generic UI, History, Job Detail and Downloads are reused. BOM workbook, processing report and delivery ZIP; all-failed jobs deliver diagnostics only.

The engine retains `Microwave/ZTE TX MINI/{SITE_ID}` naming and original NE/FE calculation rules. No arbitrary DU-model support is asserted. See [architecture](ARCHITECTURE.md), [business logic](BUSINESS_LOGIC.md), [contract](SKILL_CONTRACT.md), [handover](HANDOVER.md), [pending](PENDING.md) and [plan](PLAN.md).
