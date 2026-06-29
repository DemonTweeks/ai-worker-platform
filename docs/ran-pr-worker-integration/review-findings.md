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

## 2026-06-29 - UAT Blocker: Wrong RAN BOM Can Complete With No ECC Output

- Status: **open — merge blocker for Draft PR #17**.
- UAT evidence:
  - Job `PR-20260629-005` was created through the RAN PR Worker using a wrong workbook in the BOM upload slot.
  - The upload passed current BOM prevalidation, the job completed, and a ZIP download was offered even though no usable RAN ECC output was produced.
  - The downloaded package therefore represented a false successful result. It may contain platform-generated metadata such as `Summary.json`, but it must not be presented as a successful RAN PR deliverable when it contains zero approved RAN ECC output files.
- Confirmed control gap:
  - RAN BOM prevalidation currently verifies only that the workbook container can be opened; it does not validate the required RAN BOM workbook structure, required sheets, or required headers.
  - RAN job finalization currently builds its summary with `matchedSiteCount: 0`. This bypasses the shared zero-output protection that would otherwise reject unexplained zero ECC outputs.
  - The platform then generates summary/package artifacts even when `ran_ecc_output` and `ran_ecc_output_with_general_items` counts are both zero.
- Required fix decision:
  1. Add backend RAN BOM schema prevalidation that rejects a readable but wrong workbook before job creation. Validation must use the pinned engine's actual required BOM structure, not only extension/signature/readability.
  2. Add a final execution guard: when a RAN run reaches output collection with zero approved RAN ECC output files, mark the job `failed` with a safe allow-listed failure category such as `RAN_ZERO_ECC_OUTPUT`, unless an explicitly supported and user-visible RAN business exception explains the zero-output state.
  3. Do not generate or expose a successful ZIP download for a failed zero-ECC RAN job. Retain only safe failure diagnosis and audit metadata according to the platform error policy.
  4. Keep generic file/readability validation, but do not rely on it as RAN BOM correctness validation.
- Required regression coverage:
  - wrong-but-readable workbook submitted as RAN BOM is rejected during prevalidation with safe inline validation details;
  - a simulated RAN pipeline with zero approved ECC output fails rather than completing;
  - failed zero-output RAN job has no successful ZIP package;
  - valid Standard PR and General Item golden cases still complete with tracked ECC output and ZIP;
  - MW zero-output behavior remains unchanged.
- Human verification after fix:
  - repeat the `PR-20260629-005` wrong-BOM scenario;
  - confirm job creation is blocked at prevalidation, or, if a later engine-level failure is required, confirm terminal job status is `failed` with safe explanation and no successful download;
  - confirm valid RAN BOM still completes and its ZIP contains the expected ECC output.
