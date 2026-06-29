# AI Worker Platform QA and UAT Checklist

**Status:** Current operating checklist  
**Baseline:** `main` at and after `29cbd382c92222b4f555d1926f106e1c66837404`

Use this checklist for controlled internal validation. It covers the shared platform lifecycle plus the two supported worker families: MW PR Worker and RAN PR Worker.

## 1. Pre-test Controls

- Confirm `git status --short` is clean, except for intentional local-only configuration.
- Confirm both submodules are initialized.
- Confirm RAN submodule SHA is `239910e2816153339a94881597bbb95355059741`.
- Confirm `.env`, frontend local environment values and credentials are not committed.
- Confirm the intended Python interpreter is available and `requirements-worker.txt` is installed.
- Start the backend and frontend using the current local development guide.

## 2. Automated Regression

Run baseline checks:

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix backend run test:preflight
git diff --check
```

Run RAN-sensitive coverage after any RAN or shared lifecycle change:

```powershell
npm.cmd --prefix backend run test:ran-output-validation
npm.cmd --prefix backend run test:ran-placeholder-runtime
npm.cmd --prefix backend run test:ran-golden
npm.cmd --prefix backend run test:ran-history-reload
npm.cmd --prefix backend run test:ran-concurrency
npm.cmd --prefix backend run test:ran-invalid-safe-errors
npm.cmd --prefix backend run test:ran-worker-service
npm.cmd --prefix backend run test:ran-routes
```

Expected:

- backend and frontend tests pass
- frontend production build passes
- preflight confirms the resolved worker runtime
- RAN output validation rejects false-success placeholders
- RAN Golden tests cover Standard and General Item business content
- shared Firebase-backed tests run serially when they use the same test backend

## 3. Shared Platform Manual UAT

- Open `/` and confirm both MW PR Worker and RAN PR Worker are selectable.
- Confirm worker-specific input fields appear only for the selected worker.
- Confirm upload validation rejects unsupported files and safe error text is shown.
- Create a job and confirm queued, running and terminal state updates are visible.
- Confirm WebSocket progress updates reach the UI during execution.
- Open Job Detail and confirm worker identity, status, timestamps, files, warnings and safe failure information are visible.
- Open `/history`; search by job ID and filter by status and worker identity where available.
- Confirm individual downloads and ZIP downloads work only for valid tracked output files.
- Confirm a cancelled job shows a cancellation state rather than a generic false success.

## 4. MW PR Worker Regression

Use an approved MW test input.

- Select MW PR Worker.
- Run the existing MW TSS flow.
- Run the existing MW TI smoke flow where test data supports it.
- Confirm current MW behavior remains compatible: scope selection, progress, final summary, output files, ZIP, History and Job Detail.
- Confirm no RAN-only control or validation blocks MW execution.

## 5. RAN Standard PR UAT

Use valid RAN sample BOM and EPMS files.

- Select RAN PR Worker.
- Upload BOM to the BOM field and EPMS to the EPMS field.
- Select Standard PR.
- Create the job.
- Confirm the job completes and the ECC workbook is usable.
- Confirm ZIP includes valid platform-tracked output and final summary.
- Confirm Job Detail records RAN identity and engine version/commit metadata.
- Confirm no General Item workbook is claimed in Standard PR mode unless actually generated.

## 6. RAN General Item UAT

Use valid RAN sample BOM and EPMS files.

- Select RAN PR Worker and General Item mode.
- Confirm the project list is catalog-provided; do not accept arbitrary free text.
- Submit a valid project value.
- Confirm the job completes and General Item content appears in the expected ECC result.
- Confirm ZIP, History and Job Detail retain correct worker and mode metadata.

## 7. RAN False-Success and Input Safety UAT

### Wrong BOM guard

- Upload an EPMS workbook into the RAN BOM field.
- Confirm semantic RAN BOM validation blocks the job before queueing.
- Confirm the user sees a safe structure failure message only.

### Invalid output guard

- Use the automated placeholder-runtime and output-validation tests.
- Confirm an empty, header-only or one-cell placeholder ECC file is not counted as valid output.
- Confirm invalid-only output creates no successful ZIP and finalizes as `failed` when not cancelled.

### Cancellation precedence

- Cancel a RAN job before valid output is available.
- Confirm zero valid output results in `cancelled`, not `failed`.
- When safe to test, cancel after valid partial output and confirm `cancelled_with_partial_result`.

## 8. Safe Error and Runtime UAT

- Simulate or use a controlled missing Python dependency.
- Confirm Job Detail shows a safe failure category and bounded diagnosis.
- Confirm no raw command line, upload path, workspace path, token, environment value or raw stderr is displayed.
- Verify valid configured absolute Python path works.
- Verify invalid/unresolved Python command is rejected before process spawn.
- Confirm the configured job timeout applies to RAN Python stages.

## 9. Admin and Health UAT

- Open `/admin/login`; invalid login must fail safely.
- Log in with configured admin credentials.
- Confirm `/health` status is reachable through the current frontend/backend route.
- Confirm audit/history views do not expose secrets or full raw errors.
- Confirm admin asset upload/activation remains unavailable unless explicitly reimplemented; do not test it as a currently supported feature.

## 10. Controlled Docker Deployment UAT

Only perform when Docker Compose is the intended deployment path.

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Validate:

- frontend and backend health are reachable on configured internal ports
- MW and RAN jobs execute with mounted submodules
- Python dependencies and interpreter resolution work inside the backend container
- RAN workspace isolation, output validation, ZIP download and WebSocket progress work
- active persistence configuration is verified; do not assume the Compose MongoDB volume is the authoritative job-history store
- `.env`, backups and generated files remain protected

## 11. Exit Criteria

A change is ready for review only when:

- all applicable automated checks pass
- MW regression passes when shared services or UI changed
- RAN Standard and General Item UAT pass when RAN changed
- wrong BOM and placeholder-output safeguards remain proven
- safe error behavior is confirmed for changed failure paths
- no generated files, runtime workspace, secret or local configuration is included in Git changes
- release notes and current documentation accurately reflect what is implemented
