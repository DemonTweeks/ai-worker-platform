# Review Findings

## 2026-06-26

- No implementation findings were recorded during the first golden verification and persistence/history reload proof slices.
- No changed-file scope findings were recorded during the branch-level inventory and representative boundary review.
- No final-report scope findings were recorded while converting the placeholder report into the current delivery-state summary.
- No implementation or documentation findings remain after the final completion pass.

## 2026-06-29 - UAT Prevalidation Banner Follow-Up

- Observed behavior:
  - expected frontend prevalidation failures for invalid MW and RAN workbooks still rendered the intended inline `UploadPanel` checklist and worker explanation
  - the same failure also raised a redundant transient banner such as `Request failed with status code 400`
- Root cause:
  - `frontend/src/views/HomeView.vue` treated every rejected `prevalidateUpload(...)` promise as a banner-worthy error even when the response was the expected safe `400` validation payload already meant for inline rendering
- Fix decision:
  - keep the structured safe validation payload in the relevant `UploadPanel`
  - suppress the transient/global banner only for expected `/api/jobs/prevalidate` `400` responses whose payload matches the safe validation-result shape
  - preserve generic safe error banners for network failures, malformed responses, unexpected `5xx` failures, and non-prevalidation API calls
- Test evidence:
  - added focused `HomeView` regression coverage for:
    - MW expected validation `400` payload populates inline result and shows no banner
    - RAN BOM and RAN EPMS expected validation `400` payloads populate inline results and show no banner
    - network/unexpected prevalidation failure still shows a generic safe banner
  - browser verification on the updated branch confirmed:
    - invalid RAN BOM shows safe inline failure details with no generic `400` banner
    - invalid RAN EPMS shows safe inline failure details with no generic `400` banner
    - invalid MW upload shows safe inline failure details with no generic `400` banner
    - simulated request abort still shows a generic safe `Network Error` banner
    - valid large RAN BOM still validates successfully after more than 10 seconds with no `timeout of 10000ms exceeded` banner
- Final status:
  - resolved on `feature/ran-pr-worker-integration` and pushed to Draft PR `#17`

## 2026-06-29 - RESOLVED - False-success RAN completion for persisted UAT job `PR-20260629-005`

- Status:
  - was an open merge blocker for Draft PR `#17`
  - resolved on `feature/ran-pr-worker-integration` after the backend validation, RAN acceptance, and frontend regression suites passed
- Confirmed Firebase-backed evidence:
  - persisted `jobs/PR-20260629-005` reached terminal status `completed`
  - persisted job metadata recorded `workerId: ran-pr`, `runMode: general-item`, `outputFileCount: 2`, `reviewRequiredCount: 0`, and `warningCount: 0`
  - persisted `job_files/PR-20260629-005` contains both RAN output records (`ran_ecc_output` and `ran_ecc_output_with_general_items`) plus a `zip_package`
  - persisted `zip_package` metadata records a 9,288-byte ZIP containing only the two tracked RAN ECC workbooks and `Summary.json`
  - persisted warning and review-required collections for this job are empty
  - persisted summary metadata exists, but `Summary.json` was written while the job status was still `exporting` rather than after the terminal status update
- Confirmed false-success behavior:
  - the tracked BOM and EPMS input records persisted as the same workbook metadata shape rather than two distinct workbook types, which is consistent with the reported wrong-but-readable workbook being accepted into the BOM slot
  - both persisted RAN ECC output workbooks exist, but each resolves to a one-sheet workbook with only the `A1` cell range, so the job completed and offered a ZIP even though no usable RAN ECC result was produced
- Root cause:
  - `backend/src/services/prevalidationService.js` accepts RAN BOM uploads after extension, size, safe-name, and workbook-readability checks only; it does not verify BOM-specific structure or reject an EPMS-shaped workbook that happens to be readable
  - `backend/src/workers/adapters/ranPrAdapter.js` and `backend/src/workers/ranOutputIngestionService.js` treat the presence of `ECC_PR_Output.xlsx` and `ECC_PR_Output_With_GeneralItems.xlsx` as success evidence and ingest them without validating that the workbooks contain meaningful RAN ECC data
  - `backend/src/services/ranWorkerService.js` reduces the final RAN summary to `outputFileCount` only and passes that to `backend/src/services/zeroOutputPolicyService.js`
  - `backend/src/services/zeroOutputPolicyService.js` marks the job `completed` as soon as `outputFileCount > 0`, so two placeholder workbooks are enough to bypass the zero-output guard even when warnings, review-required records, and usable ECC rows are all absent
- Implemented fix:
  - added BOM-specific semantic validation derived from the pinned RAN engine contract so EPMS-shaped or otherwise wrong-but-readable workbooks are rejected before job creation
  - added centralized RAN ECC workbook validation so placeholder outputs such as one-sheet `A1` workbooks are not counted, tracked, or packaged as approved ECC output
  - changed RAN finalization so zero valid ECC output becomes a safe failed terminal result (`RAN_INVALID_ECC_OUTPUT` / `RAN_ZERO_VALID_ECC_OUTPUT`) with no successful ZIP package
  - changed summary/package ordering so the persisted job terminal status is written before `Summary.json` is generated
  - strengthened runtime-isolation acceptance coverage so the pinned RAN submodule `input/` and `output/` trees are proven unchanged after live RAN execution
- Resolution evidence:
  - wrong-but-readable `ran-bom` prevalidation now fails safely before job creation
  - simulated placeholder-only ECC output now ends `failed`, records zero valid output files, and exposes no successful ZIP download
  - valid RAN Standard PR and General Item golden flows still complete and still match the pinned upstream ECC workbook outputs
  - stored `Summary.json` now matches the final persisted terminal job status in the history reload path
  - live concurrency coverage confirmed isolated runtime workspaces and unchanged pinned submodule input/output folders
