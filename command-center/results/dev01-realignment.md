# dev01 platform realignment acceptance — 2026-11-04

## Identity and delivery
- Platform branch/worktree: `dev01`, `C:\Development\ai-worker-platform-dev01`; baseline `6186a05`.
- Uploader branch `dev01/planning-upload`, local commit `48a14fabf1b14f081eecb164d1ea08b531345873`, version 0.3.4.
- Uploader fingerprint `cf885f9792ce7e1689939f5aebbf01de8ca6caede76bafc8ee6b72b44e4bee18`.
- No push, main promotion, deployment restart or live PR submission. Publish the skill commit before the platform gitlink.

## Passed checks
- Uploader: 316 Python tests, 17.11s; all seven existing project/models, TSS/TI/Planning, XLS/XLSX, project mismatch rejection, immutable inputs, mock submit/replay and frozen Planning request.
- Backend: complete npm test passed, isolated mock Firebase/storage and disabled LLM. Planning multipart creation, saved invocation/job, detail, worker+scope history query, rerun parameters/input hashes; offline Python TI/Planning XLS/XLSX proceeds to expected authentication failure using a deliberately unavailable local CDP endpoint. No live iEPMS traffic.
- Frontend: 110 tests in 19 files; production build and 13 route smoke checks passed. Header order, real MW/RAN switch routes, uploader Planning submission, History queries, TX BOM filter/scope hiding and detail/History badges covered.
- All five approved package identities loaded successfully. MW/RAN/Auditor/TX BOM gitlinks and approvals unchanged. Router unchanged. Both repository diff whitespace checks passed.

## Retained evidence
- `command-center/results/dev01-uploader-tests.log`
- `command-center/results/dev01-backend-tests.log`
- `command-center/results/dev01-frontend-tests.log`
- Synthetic uploader fixtures/results: `command-center/runtime/dev01-uploader-pytest-pass`.
- TX BOM integration artifacts: `command-center/runtime/tx-bom-acceptance-Hqxtks`.
- Logs/runtime ignored by Git; no credentials or real business workbook committed.

## Corrections and limits
Initial Python run found version declarations and a test assuming a nonexistent wrapperBinding.scope field; declarations were aligned and the test now checks the actual frozen request plus description. A pytest evidence path needed its parent initialized. API test needed the required idempotency key. All relevant full suites were rerun and passed after corrections.
Dependency installs used existing locks; existing backend 8/frontend 20 vulnerability warnings remain. No live Planning server-acceptance or deployed-browser UAT claim. Production stays at 6186a05 with uploader 0.3.3. See wiki/PLATFORM_REALIGNMENT_DEV01.md for the current checkout/deployment boundary.
