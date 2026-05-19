# EPIC 11 Reports and Excel Output Result

- Date/time: 2026-05-20 03:10
- Epic number: 11
- Task name: Reports and Excel Output Layer
- Git branch: main
- Latest git status summary at archive time:
  - Modified: backend/src/services/outputCollector.js
  - Modified: backend/src/services/prWorkerService.js
  - Modified: frontend/src/components/detail/JobDetailFiles.vue
  - Added: backend/src/services/reportGenerator.js

## Task Scope

Implemented only EPIC 11 report/output hardening. No EPIC 12 monitoring work, cleanup scheduler, deployment work, create-pr-cd changes, PR Worker business-rule changes, LLM provider changes, `.env` edits, or secret exposure were made.

## Report Generation Summary

Added a modular backend report generator using ExcelJS and deterministic database facts. Reports are generated after real create-pr-cd outputs are collected and after summary/final status facts are saved.

## Warning Report Summary

`Error_Warning_Report.xlsx` is generated when warnings or REVIEW_REQUIRED items exist. It uses a `Warnings` sheet with formatted header, frozen first row, readable widths, and safe content only.

Columns:
- Category
- Severity
- Site Code
- Source Row
- Description
- Created At
- Additional Details

## REVIEW_REQUIRED Report Summary

`Review_Required_Report.xlsx` is generated when REVIEW_REQUIRED items exist. It uses a `REVIEW_REQUIRED` sheet with formatted header, frozen first row, readable widths, and safe content only.

Columns:
- Site Code
- Source Row
- Scope
- Subcon
- Issue Type
- Severity
- Description
- Created At

## Summary.json Summary

`Summary.json` is generated from deterministic Job, JobFile, WarningItem, and ReviewRequiredItem records.

Fields include:
- jobId
- workerType
- prScope
- generationScope
- requestedSiteCount
- matchedSiteCount
- unmatchedSiteCount
- eccFileCount
- reviewRequiredCount
- warningCount
- outputFileCount
- status
- startedAt
- completedAt
- assetVersions
- finalWorkerSummary

## ZIP Package Summary

ZIP packaging now uses the required structure:

```text
ECC_Output/
Review_Required_Report.xlsx
Error_Warning_Report.xlsx
Summary.json
```

The ZIP excludes temp files and input files, avoids duplicate report records, and does not expose local absolute paths in archive entries.

## JobFile Tracking Summary

Generated files are tracked through JobFile records:
- `ecc_output`
- `review_required_report`
- `warning_report`
- `summary`
- `zip_package`

Existing download APIs continue to serve ZIP and individual tracked report files using safe metadata.

## Frontend Changes

Minimal frontend change only: Job Detail output table now labels report file types clearly, including ECC Output, Review Required Report, Error / Warning Report, Summary JSON, and ZIP Package.

## Backend Changes

- Added `backend/src/services/reportGenerator.js`
- Hardened `backend/src/services/outputCollector.js` to generate reports, Summary.json, and standard ZIP structure.
- Updated `backend/src/services/prWorkerService.js` to package reports after final summary/status facts are saved.

## Files Created / Modified

- Added: backend/src/services/reportGenerator.js
- Modified: backend/src/services/outputCollector.js
- Modified: backend/src/services/prWorkerService.js
- Modified: frontend/src/components/detail/JobDetailFiles.vue
- Added: prompts/result/20260520-0310-epic-11-reports-excel-output-result.md

## Commands Executed

- `git status --short`
- `rg -n "EPIC 11|Error / Warning|REVIEW_REQUIRED|Summary.json|ZIP Package|Report" docs/...`
- Read outputCollector, summaryBuilder, prWorkerService, JobFile, WarningItem, ReviewRequiredItem, and Job Detail output UI.
- Backend import check with `node -e`
- `npm run build` from `frontend`
- Temporary controlled report generation verification script, removed after use
- Backend start with `MONGO_URI=mongodb://127.0.0.1:27017/ai_worker_platform_test`
- Temporary HTTP/download verification script, removed after use
- `git diff --check`
- `git diff --name-only -- skills/create-pr-cd`
- `git status --short --ignored .env`

## Test Results

- Backend imports: passed.
- Backend starts: passed.
- `/health`: passed.
- `/health` did not expose secrets: passed.
- Frontend build: passed.
- Warning report generated and tracked: passed.
- Warning report columns verified with ExcelJS: passed.
- REVIEW_REQUIRED report generated and tracked: passed.
- REVIEW_REQUIRED report columns verified with ExcelJS: passed.
- Summary.json generated and tracked: passed.
- Summary.json deterministic fields verified: passed.
- ZIP package generated and tracked: passed.
- ZIP includes ECC output under `ECC_Output/`: passed.
- ZIP includes `Review_Required_Report.xlsx`: passed.
- ZIP includes `Error_Warning_Report.xlsx`: passed.
- ZIP includes `Summary.json`: passed.
- ZIP excludes temp and input files: passed.
- ZIP entries do not expose local absolute paths: passed.
- JobFile metadata uses safe relative paths: passed.
- `GET /api/jobs/:jobId` returns safe report/output metadata: passed.
- Individual Summary.json download works: passed.
- ZIP download endpoint still works: passed.
- Temporary test jobs/files/records cleaned: passed.
- create-pr-cd files modified: no.
- `.env` ignored and not staged: yes.

## ZIP Content Verification Result

Controlled ZIP contents were inspected with `tar -tf`. Required entries were present, temp/input files were absent, and archive names were relative.

## Issues / Risks / Assumptions

- Full real PR Worker execution was not rerun in this EPIC because the report layer was verified with controlled Job/Warning/Review/JobFile records and real file generation. Existing worker integration now calls the same verified report packaging path after output collection.
- Empty warning/review reports are not generated when no corresponding data exists. `Summary.json` is always generated during packaging.

## Final Acceptance Status

EPIC 11 ACCEPTED — ready for EPIC 12

## Recommended Next Step

Proceed to EPIC 12 Health and Monitoring Layer when instructed.
