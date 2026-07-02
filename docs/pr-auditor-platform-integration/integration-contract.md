# PR Auditor Integration Contract

## Purpose

This document translates Phase 0 discovery into the exact additive contracts for integrating `pr-auditor` as a distinct AI Worker Platform worker. It is the source of truth for bounded Step 2 and the starting point for bounded Step 3 implementation.

## Worker Identity

```json
{
  "workerId": "pr-auditor",
  "displayName": "PR Auditor",
  "workerType": "pr-worker",
  "capabilities": ["final-po-audit"],
  "inputs": ["final-po-upload", "epms-upload", "pr-model-upload"],
  "outputs": ["pr-audit-result-xlsx", "pr-audit-summary"],
  "excludedCapabilities": [
    "pr-creation",
    "ecc-generation",
    "bom-processing",
    "general-item",
    "project-selection"
  ]
}
```

## Product Boundary

PR Auditor must be a separate top-level worker experience, not another branch of the current PR Creator workbench.

Required visible terms:

- `PR Auditor`
- `Final PO`
- `EPMS`
- `PR Model`
- `Run Audit`
- `Audit Result`
- `Audit Report`
- `Download Audit Report`

Required notice text:

```text
PR Auditor reviews submitted PO data against configured audit rules.
It does not create or modify PR or ECC records.
Audit findings require business review.
```

Prohibited UI and API semantics in the PR Auditor flow:

- MW or RAN mode switching
- BOM upload
- TSS or TI selectors
- project selectors
- General Item controls
- ECC generation language
- PR Creator language in buttons or summaries

## Backend Contract

### Worker registration

Additive backend registration points:

- `backend/src/workers/workerTypes.js`
- `backend/src/workers/manifests/prAuditorManifest.js`
- `backend/src/workers/adapters/prAuditorAdapter.js`
- `backend/src/workers/adapters/prAuditorJobAdapter.js`
- `backend/src/workers/workerRegistry.js`

Required additions:

- `WORKER_IDS.PR_AUDITOR = 'pr-auditor'`
- `WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR] = 'PR Auditor'`
- a new manifest entry with engine repository and pinned commit metadata
- a registry entry that is parallel to `ran-pr`, not nested under MW or RAN logic

### Job creation payload

Current `jobService.createJob` has two paths:

- MW path: `prevalidatedFileId`, `generationScope`, `siteCodes`, `prScope`
- RAN path: `bomPrevalidatedFileId`, `epmsPrevalidatedFileId`, `runMode`, `selectedProject`

PR Auditor must add a third explicit path with only:

```json
{
  "workerId": "pr-auditor",
  "browserTabSessionId": "string | null",
  "idempotencyKey": "string | null",
  "finalPoPrevalidatedFileId": "required",
  "epmsPrevalidatedFileId": "required",
  "prModelPrevalidatedFileId": "required"
}
```

No `prScope`, `generationScope`, `siteCodes`, `runMode`, or `selectedProject` fields are valid for this worker.

### Upload kinds

Current prevalidation supports:

- `mw-export`
- `ran-bom`
- `ran-epms`

Additive upload kinds required:

- `pr-auditor-final-po`
- `pr-auditor-epms`
- `pr-auditor-pr-model`

Validation rules:

- all three must require `.xlsx` or `.xls`
- all three must verify workbook readability with safe user-facing failures
- `pr-auditor-final-po` must not reuse MW export assumptions about site filtering
- `pr-auditor-pr-model` must not fall back to any engine-bundled workbook

Likely implementation surfaces:

- `backend/src/services/prevalidationService.js`
- `backend/src/services/jobService.js`
- `backend/scripts/job-service-worker-payload-test.js`

### Job persistence contract

Current `Job` model already persists generic worker metadata and can be extended without changing existing workers. PR Auditor jobs should continue using `workerType: 'pr-worker'` for history inclusion, but set `workerId: 'pr-auditor'` and preserve additive metadata only.

Job fields that must remain meaningful for PR Auditor:

- `workerId`
- `workerDisplayName` through manifest lookup
- `engineVersion`
- `engineCommit`
- `status`
- `outputFileCount`
- `warningCount`
- `finalWorkerSummary`

Job fields that should be neutral or unused for PR Auditor:

- `prScope = null`
- `runMode = null`
- `selectedProject = null`
- `requestedSiteCount = 0`
- `matchedSiteCount = 0`
- `unmatchedSiteCount = 0`

PR Auditor-specific summary counts must be persisted safely in an additive way rather than overloading MW or RAN site fields. Preferred shape:

```json
{
  "auditSummary": {
    "normalCount": 0,
    "invalidPoCount": 0,
    "wrongPoCount": 0,
    "duplicatePoCount": 0,
    "reviewRequiredCount": 0,
    "warnings": []
  }
}
```

This should be stored only if the engine emits a trusted structured summary. If not available, the UI should fall back to a safe text summary plus workbook download.

Likely implementation surfaces:

- `backend/src/models/Job.js`
- `backend/src/services/jobService.js`
- `backend/src/services/finalSummaryService.js`

### File tracking contract

Current `JobFile.FILE_TYPES` and output collection are ECC-oriented. PR Auditor requires additive input and output file types.

Required input file types:

- `pr_auditor_final_po_upload`
- `pr_auditor_epms_upload`
- `pr_auditor_pr_model_upload`

Required output file types:

- `pr_audit_result_xlsx`
- `pr_audit_summary_json`

Optional additive report type:

- `pr_audit_warning_report`

Current generic ZIP packaging is not the desired primary delivery for PR Auditor. The canonical delivery must be direct workbook download from job detail. ZIP support may remain additive if the platform requires it, but the visible user action should be `Download Audit Report`.

Likely implementation surfaces:

- `backend/src/models/JobFile.js`
- `backend/src/services/outputCollector.js` or a dedicated PR Auditor output ingestion service
- `backend/src/services/jobService.js`

### Workspace and runtime contract

PR Auditor must follow the same isolation principles as `ran-pr`:

- create one unique workspace per job
- copy only approved engine code into the workspace
- copy only the current job uploads into the workspace
- pass explicit file paths to the engine
- resolve Python with the existing deterministic convention

Required progress stages:

- `Validating files`
- `Matching EPMS`
- `Resolving expected entitlement`
- `Auditing PO records`
- `Resolving duplicates`
- `Generating audit report`

Likely implementation surfaces:

- `backend/src/workers/prAuditorWorkspaceService.js`
- `backend/src/workers/adapters/prAuditorAdapter.js`
- `backend/src/services/childProcessRunner.js`
- `backend/src/queue/jobQueue.js`
- `backend/src/services/workerStateService.js`

### Error handling contract

PR Auditor failures are platform failures only when the worker cannot validate, execute, cancel safely, or collect approved outputs. Business findings such as invalid, wrong, duplicate, or review-required PO records are still successful audit outcomes.

User-facing failure responses must never expose:

- raw commands
- local paths
- environment variables
- workbook contents
- stack traces
- raw stderr

## Frontend Contract

### Home / launch flow

Current `frontend/src/views/HomeView.vue` presents a single PR Creator workbench with MW and RAN switching. PR Auditor must become a distinct top-level worker choice and render its own configuration with only:

- Final PO upload
- EPMS upload
- PR Model upload
- Run Audit button

Likely touched files:

- `frontend/src/views/HomeView.vue`
- `frontend/src/components/UploadPanel.vue`
- `frontend/src/api/jobApi.js`

### Active jobs

Current active jobs table can already display `workerDisplayName`. PR Auditor must appear there as its own worker and must not inherit MW or RAN badges or labels.

Active job behavior must preserve:

- current cancellation semantics
- current websocket subscription model
- current browser-tab session scoping

### Job detail

Current detail rendering is ECC-oriented around generic site counts. PR Auditor detail must show:

- Worker: `PR Auditor`
- Execution status
- Audit Result summary
- Normal count
- Invalid PO count
- Wrong PO count
- Duplicate PO count
- Review Required count
- Warnings
- Download Audit Report

If trusted structured counts are missing, the detail view should show a safe note that detailed findings are available in the workbook.

Likely touched files:

- `frontend/src/views/JobDetailView.vue`
- `frontend/src/components/FinalSummary.vue`
- `frontend/src/components/detail/JobDetailSummary.vue`
- `frontend/src/components/detail/JobDetailFiles.vue`
- new PR Auditor-specific summary component if needed

### History and filters

Current history filters explicitly enumerate `mw-pr` and `ran-pr`. PR Auditor requires additive filter support.

Required history behavior:

- filter option for `pr-auditor`
- card and detail labels that read `PR Auditor`
- no MW/RAN-only concepts like `PR Scope`, `Run Mode`, or `Project` for PR Auditor cards

Likely touched files:

- `frontend/src/views/JobHistoryView.vue`
- `frontend/src/components/history/JobHistoryFilters.vue`
- `frontend/src/components/history/JobHistoryCard.vue`
- `frontend/src/components/history/JobScopeBadge.vue`

## Exact Changed-File Map For Step 3+

Planned backend files:

- `backend/src/workers/workerTypes.js`
- `backend/src/workers/workerRegistry.js`
- `backend/src/workers/manifests/prAuditorManifest.js`
- `backend/src/workers/adapters/prAuditorAdapter.js`
- `backend/src/workers/adapters/prAuditorJobAdapter.js`
- `backend/src/workers/prAuditorWorkspaceService.js`
- `backend/src/workers/prAuditorOutputIngestionService.js`
- `backend/src/services/prevalidationService.js`
- `backend/src/services/jobService.js`
- `backend/src/models/Job.js`
- `backend/src/models/JobFile.js`
- `backend/src/routes/jobRoutes.js` if additive route/query support is required
- `backend/scripts/job-service-worker-payload-test.js`
- new PR Auditor backend tests under `backend/scripts/`

Planned frontend files:

- `frontend/src/views/HomeView.vue`
- `frontend/src/views/JobDetailView.vue`
- `frontend/src/views/JobHistoryView.vue`
- `frontend/src/components/UploadPanel.vue`
- `frontend/src/components/FinalSummary.vue`
- `frontend/src/components/detail/JobDetailSummary.vue`
- `frontend/src/components/detail/JobDetailFiles.vue`
- `frontend/src/components/history/JobHistoryFilters.vue`
- `frontend/src/components/history/JobHistoryCard.vue`
- `frontend/src/api/jobApi.js`
- new PR Auditor view/helper components only if they reduce conditional complexity

Planned docs and metadata files:

- `docs/pr-auditor-platform-integration/*`
- `.gitmodules` only if the engine pin is later approved
- `skills/tx-pr-auditor` only as a safe gitlink/submodule, never as copied source

## Deferred Safety Gate

No Step 3 backend implementation may pin or execute the external engine until the candidate repository passes the data-safety rule from the mission prompt. As of Step 2, that gate remains unresolved because the candidate repo versions `input/pr_model.xlsx` with non-obviously-synthetic content.
