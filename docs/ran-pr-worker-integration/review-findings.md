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
