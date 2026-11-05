# TX BOM platform-managed template

## User flow
TX BOM Generator requires only user EPMS (.xlsx) and selected Customer Site IDs in the portal. The BOM template card remains visible/read-only, marked Auto-filled / Managed by the platform. Hover or keyboard focus exposes the Auto fill explanation; touch users also see the explanation. No template browse/replace/remove/validation control exists.

This is a platform transport policy, not a Python engine change. The approved skill remains 0.1.1 with its original fingerprint and still receives exactly epms/config plus siteIds. Standalone invocation continues to require both files.

## Private deployment asset
Approval: backend/src/skills/txBomManagedTemplate.json. Revision bom-template-20261030-v1, SHA-256 c4445842181c233457ccc96f9dc4a6a034fb09a0efb1109f7d300303871341bf.
Default: <STORAGE_ROOT>/assets/tx-bom/bom-template-20261030-v1/BOM template.xlsx.
Optional server-only override: TX_BOM_MANAGED_TEMPLATE_PATH. Copy the reviewed Config/BOM template.xlsx, not an output workbook. Keep bytes private, outside frontend/public/Git. Deployments must provision this asset separately; Git does not distribute it. New machines without it show Unavailable and reject new BOM jobs. Template revision/hash changes require explicit review and a matching platform release; no remote fetching or inference.

Catalog metadata exposes safe filename/revision/hash/availability, never host paths or workbook bytes. New jobs reverify bytes, reject missing/modified/non-file/oversized inputs, reject client config uploads, and copy verified bytes into isolated job inputs. There is no user-controlled template path. Catalog availability is advisory; submission rechecks. Missing template affects BOM availability, not other workers.

## Audit and replay
Job, input file record, and skill-input.json retain template origin/revision/hash. Each job freezes both files before queueing. Idempotent replay returns the original job without resolving the current managed asset. Explicit Rerun Job validates and reuses the original retained template; historical uploads are labelled retained-job-input. It never silently substitutes a new template. Missing/corrupted historical input blocks rerun. New Job uses the currently approved asset. Historical jobs are not rewritten.

## Safety and acceptance
No calculation, quantity, mapping, formula repair, warning suppression, cancellation, or PR submission changes. Exact legacy header warning and all other engine safety gates remain.
Frontend: 119 tests / 20 files, build, 14 routes passed. Complete backend Firebase-mock and isolated SQLite regression passed, including managed-input snapshots, missing/modified template, override/path rejection, replay and explicit rerun with unavailable current asset. Two EPMS-only private HTTP/runner/download jobs each reproduce reference headers/site metadata/materials: 8 generated / 0 failed / quantity 5330 / four configuration warnings. Inputs unchanged; downloaded artifacts and ZIP bytes verified. No production generation job was started for acceptance.

During initial testing a shared skill junction allowed an Auditor tamper probe to modify two production MW files. Both were restored to their recorded HEAD; all approved production fingerprints verified. The isolated worktree now uses independent mutable skill copies; complete backend regression rerun passed. No tampered release was committed.

## Release and rollback
Deploy wrapper changes and provision asset, build frontend, restart backend/frontend only after checking queue idle. Preserve existing DB/environment and unrelated local files. Verify /api/skills managedInputs.config.available and browser form after restart. Roll back platform commit/build together; do not rewrite historical workspaces or skill pins. Private template may remain for reuse. Direct API clients must stop sending config after this release.
