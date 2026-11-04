# TX BOM Generator — deployed skill

Skill 0.1.0, native Windows Python, private submodule `skills/tx-bom-generator`. Platform baseline 1dfc376619d59b643fce3da1c175ba0222e22a6f. Integration was rebased and deployed at platform `6186a05`. See [current snapshot](../PLATFORM_REALIGNMENT_DEV01.md) for isolated development work and limits.

Required every job: EPMS .xlsx, Config .xlsx, Customer Site IDs multiline text. Route `/#/workers/tx-bom-generator` (production base `/fe/#/workers/tx-bom-generator`). Generic UI, History, Job Detail and Downloads are reused. BOM workbook, processing report and delivery ZIP; all-failed jobs deliver diagnostics only.

The engine retains `Microwave/ZTE TX MINI/{SITE_ID}` naming and original NE/FE calculation rules. No arbitrary DU-model support is asserted. See [architecture](ARCHITECTURE.md), [business logic](BUSINESS_LOGIC.md), [contract](SKILL_CONTRACT.md), [handover](HANDOVER.md), [pending](PENDING.md) and [plan](PLAN.md).
