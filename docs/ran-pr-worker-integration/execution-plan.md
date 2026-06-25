# RAN PR Worker Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-oriented `ran-pr` worker to the AI Worker Platform without regressing the existing MW flow, ending with pinned upstream engine integration, unified platform job handling, platform-native UI, and verified delivery on `feature/ran-pr-worker-integration`.

**Architecture:** Introduce a worker registry with manifests and platform adapters so `mw-pr` and `ran-pr` run behind the same platform contract. Keep platform-owned routes, storage, persistence, history, downloads, websocket updates, and safe errors while isolating RAN execution into per-job workspaces populated from the pinned upstream submodule. Evolve the frontend from MW-only assumptions to worker-aware rendering on the existing home, history, and job-detail routes.

**Tech Stack:** Node.js 20, Express, Vue 2, Firebase REST-backed models, websocket updates over `ws`, filesystem-backed job storage, Python pipeline execution with the platform-resolved interpreter, Git submodules, npm test/build scripts.

---

## File Structure

### Backend files to create

- `backend/src/workers/workerRegistry.js`
  Platform-owned worker registration and lookup.
- `backend/src/workers/workerTypes.js`
  Shared worker IDs, run modes, and capability constants.
- `backend/src/workers/manifests/mwPrManifest.js`
  Manifest wrapper for the existing MW worker.
- `backend/src/workers/manifests/ranPrManifest.js`
  Manifest for pinned RAN metadata, capabilities, inputs, and outputs.
- `backend/src/workers/adapters/mwPrAdapter.js`
  Compatibility wrapper around the current MW execution path.
- `backend/src/workers/adapters/ranPrAdapter.js`
  Platform adapter for isolated RAN execution.
- `backend/src/workers/ranWorkspaceService.js`
  Creates per-job RAN workspaces, copies approved engine assets, and stages uploads.
- `backend/src/workers/ranProjectCatalogService.js`
  Reads and validates workbook-derived General Item projects from the RAN config workbook.
- `backend/src/workers/ranOutputIngestionService.js`
  Maps RAN output files into platform `JobFile`, warning, and review-required records.

### Backend files to modify

- `backend/src/config/env.js`
  Add RAN submodule root, workspace root, and optional engine settings.
- `backend/src/models/Job.js`
  Extend job records with explicit worker identity, engine metadata, run mode, and selected project.
- `backend/src/models/JobFile.js`
  Add or document any RAN-specific file types if needed.
- `backend/src/routes/jobRoutes.js`
  Preserve route surface while accepting worker-aware create and detail payloads.
- `backend/src/services/jobService.js`
  Shift job creation, listing, detail, and download logic to worker-aware behavior.
- `backend/src/queue/jobQueue.js`
  Dispatch jobs through the registry instead of calling `runPrWorkerJob` directly.
- `backend/src/services/prWorkerService.js`
  Either delegate to `mwPrAdapter` or be reduced to MW-specific internals behind the adapter.
- `backend/src/services/childProcessRunner.js`
  Preserve MW behavior while adding reusable explicit-interpreter execution helpers for RAN.
- `backend/src/services/outputCollector.js`
  Keep MW behavior intact; only extend if common packaging behavior is reusable.
- `backend/src/services/workerStateService.js`
  Add worker-aware phase/status helpers if needed.
- `backend/src/websocket/eventPublisher.js`
  Ensure worker metadata and any RAN-specific phases fit the existing message model.

### Frontend files to modify

- `frontend/src/views/HomeView.vue`
  Add worker selection and RAN-specific launch inputs while preserving MW mode.
- `frontend/src/api/jobApi.js`
  Send worker-aware create payloads and handle any project-list API.
- `frontend/src/views/JobHistoryView.vue`
  Add worker filtering and worker-aware listing behavior.
- `frontend/src/components/history/JobHistoryFilters.vue`
  Add worker filter control.
- `frontend/src/components/history/JobHistoryCard.vue`
  Show worker identity and RAN summary data.
- `frontend/src/views/JobDetailView.vue`
  Render worker metadata and RAN audit details.
- `frontend/src/components/detail/JobDetailHeader.vue`
  Show worker display name and identity.
- `frontend/src/components/detail/JobDetailSummary.vue`
  Show run mode, selected project, engine version, and engine commit.
- `frontend/src/utils/jobStatusUtils.js`
  Add worker-aware labels if needed.

### Test files to create or modify

- `frontend/src/views/__tests__/HomeView.spec.js`
  Extend for worker switching and RAN launch validation.
- `frontend/src/components/history/__tests__/JobHistoryCard.spec.js`
  Extend for worker badge rendering.
- `backend/scripts/integration-test.js`
  Add worker-aware backend integration coverage.
- `backend/scripts/smoke-test.js`
  Preserve MW assertions and add worker metadata assertions if appropriate.
- `backend/scripts/error-visibility-test.js`
  Add RAN safe-error coverage.

---

### Task 1: Pin The RAN Engine And Add Worker Metadata Foundations

**Files:**
- Modify: `.gitmodules`
- Create: `backend/src/workers/workerTypes.js`
- Create: `backend/src/workers/manifests/mwPrManifest.js`
- Create: `backend/src/workers/manifests/ranPrManifest.js`
- Create: `backend/src/workers/workerRegistry.js`
- Modify: `backend/src/config/env.js`
- Test: `git submodule status`, `git diff --check`

- [ ] **Step 1: Add the RAN engine submodule at the required path**

Run:
```powershell
git submodule add https://github.com/ammarofficial11/create-pr-cd-ran.git skills/create-pr-cd-ran
git -C skills/create-pr-cd-ran checkout 239910e2816153339a94881597bbb95355059741
git submodule status
```

Expected:
- submodule path is `skills/create-pr-cd-ran`
- detached SHA is `239910e2816153339a94881597bbb95355059741`

- [ ] **Step 2: Create shared worker constants and manifests**

Define:
```js
module.exports = {
  WORKER_IDS: { MW_PR: 'mw-pr', RAN_PR: 'ran-pr' },
  RAN_RUN_MODES: { STANDARD_PR: 'standard-pr', GENERAL_ITEM: 'general-item' }
};
```

Ensure the RAN manifest includes:
```js
{
  workerId: 'ran-pr',
  displayName: 'RAN PR Worker',
  engineRepository: 'ammarofficial11/create-pr-cd-ran',
  engineVersion: 'v1.0.0',
  engineCommit: '239910e2816153339a94881597bbb95355059741',
  capabilities: ['standard-pr', 'general-item'],
  limitations: ['bom-comparison not implemented'],
  compatibilityStatus: 'verified'
}
```

- [ ] **Step 3: Create the initial worker registry**

Expose a simple lookup:
```js
getWorkerManifest(workerId)
getWorkerAdapter(workerId)
listWorkers()
```

Start with registration for:
- `mw-pr`
- `ran-pr`

- [ ] **Step 4: Add config entries for RAN engine resolution**

Add env-backed paths for:
- RAN submodule root
- RAN workspace root under platform storage or temp storage

Expected behavior:
- no existing MW config path changes
- all new paths resolve from repo root

- [ ] **Step 5: Run repository hygiene checks**

Run:
```powershell
git diff --check
git submodule status
```

Expected:
- no whitespace errors
- correct submodule pin visible

- [ ] **Step 6: Commit the submodule and metadata foundation**

Run:
```powershell
git add .gitmodules skills/create-pr-cd-ran backend/src/workers backend/src/config/env.js
git commit -m "feat: add ran worker manifests and submodule pin"
```

### Task 2: Build The RAN Project Catalog And Isolated Workspace Services

**Files:**
- Create: `backend/src/workers/ranProjectCatalogService.js`
- Create: `backend/src/workers/ranWorkspaceService.js`
- Modify: `backend/src/services/storageService.js`
- Test: `backend/scripts/integration-test.js`

- [ ] **Step 1: Add workbook-derived project catalog parsing**

Parse projects from:
```text
skills/create-pr-cd-ran/config/GENERAL ITEM FOR ALL DU PROJECT Overall.xlsx
```

Required behavior:
- return dynamic distinct project names
- skip empty and `Unnamed` columns
- preserve the exact workbook labels used by upstream logic

- [ ] **Step 2: Add project validation**

Implement:
```js
listRanProjects()
isValidRanProject(projectName)
assertValidRanProject(projectName)
```

Validation rules:
- `standard-pr` allows no project
- `general-item` requires a validated workbook-derived project
- arbitrary user strings are rejected

- [ ] **Step 3: Create isolated workspace preparation**

Per-job workspace contents should include only:
```text
src/
config/
input/BOM.xlsx
input/EPMS.xlsx
output/
```

Required behavior:
- create unique workspace path
- copy engine `src/` and `config/`
- copy uploaded BOM and EPMS using the filenames expected upstream
- never copy `api/`, `web/`, `build/`, `dist/`, or generated artifacts

- [ ] **Step 4: Add cleanup hooks for temporary workspaces**

Expected behavior:
- platform retains outputs in platform storage
- temporary workspace can be cleaned independently of durable job files

- [ ] **Step 5: Add integration coverage for project listing and workspace staging**

Run:
```powershell
npm.cmd --prefix backend test
```

Expected:
- existing MW checks still pass
- new tests prove project catalog parsing and isolated staging

- [ ] **Step 6: Commit the project catalog and workspace staging layer**

Run:
```powershell
git add backend/src/workers/ranProjectCatalogService.js backend/src/workers/ranWorkspaceService.js backend/src/services/storageService.js backend/scripts/integration-test.js
git commit -m "feat: add ran project catalog and workspace staging"
```

### Task 3: Implement The RAN Adapter And Execution Flow

**Files:**
- Create: `backend/src/workers/adapters/ranPrAdapter.js`
- Modify: `backend/src/services/childProcessRunner.js`
- Create: `backend/src/workers/ranOutputIngestionService.js`
- Modify: `backend/src/models/Job.js`
- Modify: `backend/src/models/JobFile.js`
- Test: `backend/scripts/integration-test.js`, `backend/scripts/error-visibility-test.js`

- [ ] **Step 1: Add explicit-interpreter RAN command execution**

Expose a reusable helper shape such as:
```js
runPythonStage({ pythonExecutable, scriptPath, cwd, env, timeoutMs, isCancellationRequested })
```

Constraints:
- no `shell: true`
- no bare `python`
- cwd is the isolated job workspace

- [ ] **Step 2: Implement the four RAN pipeline stages**

Run exactly:
```text
src/simple_normalize.py
src/simple_calculation.py
src/simple_pr_generator.py
src/simple_ecc_export.py
```

Behavior:
- `standard-pr` runs with no project selected
- `general-item` passes the validated project via environment and/or explicit argument

- [ ] **Step 3: Capture RAN engine metadata onto the job record**

Persist fields like:
```js
{
  workerId: 'ran-pr',
  workerType: 'pr-worker',
  engineVersion: 'v1.0.0',
  engineCommit: '239910e2816153339a94881597bbb95355059741',
  runMode: 'standard-pr' | 'general-item',
  selectedProject: '...'
}
```

- [ ] **Step 4: Ingest approved RAN outputs into platform storage**

Track at minimum:
- `ECC_PR_Output.xlsx`
- `ECC_PR_Output_With_GeneralItems.xlsx` when applicable
- approved JSON intermediates only if useful for audit or summary
- platform ZIP package

Do not expose upstream raw directories directly.

- [ ] **Step 5: Add safe error conversion for RAN failures**

Expected behavior:
- redact raw paths, commands, and secrets
- keep actionable summaries
- preserve consistency with existing failure diagnosis UI

- [ ] **Step 6: Verify Standard PR and General Item execution in backend tests**

Run:
```powershell
npm.cmd --prefix backend test
```

Expected:
- tests cover Standard PR path
- tests cover General Item path
- tests confirm invalid project rejection

- [ ] **Step 7: Commit the RAN adapter**

Run:
```powershell
git add backend/src/workers/adapters/ranPrAdapter.js backend/src/workers/ranOutputIngestionService.js backend/src/services/childProcessRunner.js backend/src/models/Job.js backend/src/models/JobFile.js backend/scripts/integration-test.js backend/scripts/error-visibility-test.js
git commit -m "feat: add isolated ran execution adapter"
```

### Task 4: Introduce The Worker Registry Into Backend Job Creation And Dispatch

**Files:**
- Create: `backend/src/workers/adapters/mwPrAdapter.js`
- Modify: `backend/src/services/jobService.js`
- Modify: `backend/src/queue/jobQueue.js`
- Modify: `backend/src/routes/jobRoutes.js`
- Modify: `backend/src/services/prWorkerService.js`
- Test: `backend/scripts/smoke-test.js`, `backend/scripts/integration-test.js`

- [ ] **Step 1: Wrap the current MW flow behind `mwPrAdapter`**

Goal:
- preserve existing MW route behavior
- move direct knowledge of MW execution out of queue dispatch

- [ ] **Step 2: Make job creation worker-aware**

Create payload shape should support:
```json
{
  "workerId": "mw-pr|ran-pr",
  "prevalidatedFileId": "...",
  "prScope": "TSS|TI",
  "generationScope": "site_code|all_sites",
  "siteCodes": [],
  "ranBomFileId": "...",
  "ranEpmsFileId": "...",
  "runMode": "standard-pr|general-item",
  "selectedProject": "..."
}
```

Preserve current MW callers by defaulting missing `workerId` to the existing MW path.

- [ ] **Step 3: Make queue dispatch registry-based**

Replace direct calls with:
```js
const adapter = getWorkerAdapter(job.workerId)
await adapter.run(jobId)
```

- [ ] **Step 4: Extend detail and list payloads with worker metadata**

Ensure history and detail responses expose:
- `workerId`
- `workerDisplayName`
- `runMode`
- `selectedProject`
- `engineVersion`
- `engineCommit`

- [ ] **Step 5: Re-run backend smoke and integration coverage**

Run:
```powershell
npm.cmd --prefix backend test
```

Expected:
- MW create/list/detail/download behavior still passes
- RAN create/dispatch paths pass

- [ ] **Step 6: Commit the registry-backed backend transition**

Run:
```powershell
git add backend/src/workers/adapters/mwPrAdapter.js backend/src/services/jobService.js backend/src/queue/jobQueue.js backend/src/routes/jobRoutes.js backend/src/services/prWorkerService.js backend/scripts/smoke-test.js backend/scripts/integration-test.js
git commit -m "feat: route jobs through worker registry"
```

### Task 5: Add Platform-Native RAN UI And Worker-Aware History/Detail Rendering

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/api/jobApi.js`
- Modify: `frontend/src/views/JobHistoryView.vue`
- Modify: `frontend/src/components/history/JobHistoryFilters.vue`
- Modify: `frontend/src/components/history/JobHistoryCard.vue`
- Modify: `frontend/src/views/JobDetailView.vue`
- Modify: `frontend/src/components/detail/JobDetailHeader.vue`
- Modify: `frontend/src/components/detail/JobDetailSummary.vue`
- Modify: `frontend/src/components/detail/JobDetailFiles.vue`
- Test: `frontend/src/views/__tests__/HomeView.spec.js`, `frontend/src/components/history/__tests__/JobHistoryCard.spec.js`

- [ ] **Step 1: Add worker selection and RAN inputs to the home workbench**

Required fields in RAN mode:
- BOM upload
- EPMS upload
- run mode selector
- project selector shown only for `General Item`

- [ ] **Step 2: Preserve MW mode behavior**

Expected:
- existing MW create flow remains the default-compatible path
- current timeout notification tests still pass

- [ ] **Step 3: Add worker-aware API calls**

Frontend create requests must send:
- `workerId`
- RAN-specific upload references
- run mode
- selected project when needed

- [ ] **Step 4: Add worker filter and worker badges in history**

UI changes:
- filter by worker
- show worker label on cards
- keep existing status and summary layout

- [ ] **Step 5: Add RAN audit metadata to job detail**

Display:
- worker name
- worker ID
- run mode
- selected project
- engine version
- engine commit

- [ ] **Step 6: Run frontend tests and build**

Run:
```powershell
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
```

Expected:
- unit tests pass
- build passes
- route smoke passes through frontend test script

- [ ] **Step 7: Commit the frontend integration**

Run:
```powershell
git add frontend/src/views/HomeView.vue frontend/src/api/jobApi.js frontend/src/views/JobHistoryView.vue frontend/src/components/history/JobHistoryFilters.vue frontend/src/components/history/JobHistoryCard.vue frontend/src/views/JobDetailView.vue frontend/src/components/detail/JobDetailHeader.vue frontend/src/components/detail/JobDetailSummary.vue frontend/src/components/detail/JobDetailFiles.vue frontend/src/views/__tests__/HomeView.spec.js frontend/src/components/history/__tests__/JobHistoryCard.spec.js
git commit -m "feat: add platform-native ran worker ui"
```

### Task 6: Golden Verification, Regression Testing, And Delivery Preparation

**Files:**
- Modify: `docs/ran-pr-worker-integration/verification-log.md`
- Modify: `docs/ran-pr-worker-integration/final-report.md`
- Create: `docs/ran-pr-worker-integration/golden-test-evidence.md`
- Optional: `docs/ran-pr-worker-integration/review-findings.md`

- [ ] **Step 1: Run the required project-native commands**

Run:
```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
git diff --check
```

Expected:
- all commands pass cleanly

- [ ] **Step 2: Run the required RAN acceptance checks**

Verify:
- Standard PR golden test
- General Item golden test
- workspace isolation/concurrency test
- invalid input safe-error test
- MW regression
- history persistence/reload proof

- [ ] **Step 3: Review staged scope and generated-file hygiene**

Confirm:
- no secrets
- no generated ECC outputs
- no uploads
- no `node_modules`
- no build artifacts

- [ ] **Step 4: Update final mission documentation**

Write:
- verification evidence
- final report
- review findings if needed

- [ ] **Step 5: Rebase and publish only when all gates pass**

Run:
```powershell
git fetch origin
git rebase origin/main
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
git push origin feature/ran-pr-worker-integration
```

Expected:
- branch rebased safely
- validations still pass
- only `feature/ran-pr-worker-integration` is pushed

- [ ] **Step 6: Create completion markers and Draft PR**

Required outputs:
- update `final-report.md`
- create `COMPLETED`
- set `completed=true`
- set `acceptance_status=passed`
- set `next_action=NO_OP_COMPLETED`
- create final checkpoint commit
- create GitHub Draft PR only

## Spec Self-Review

- Coverage check: this plan covers Phase 1 engine pinning and adapter work, Phase 2 backend registry integration, Phase 3 frontend worker-aware integration, and Phase 4 verification/delivery requirements from the master prompt.
- Placeholder scan: no `TODO` or `TBD` placeholders remain; each task names concrete files and commands.
- Consistency check: worker IDs, run modes, engine version, engine commit, and route expectations match the Phase 0 UX and ADR documents.

## Current Bounded Step

Translate the Phase 0 design checkpoint into a concrete implementation plan with exact file boundaries, commands, and checkpoint order.

## Next Bounded Step

Begin Task 1 by pinning the RAN submodule at `skills/create-pr-cd-ran`, adding worker manifests and registry scaffolding, and verifying the required SHA.
