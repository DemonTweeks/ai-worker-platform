const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generic-skill-contract-'));
process.env.STORAGE_ROOT = tempRoot;

const jobQueue = require('../src/queue/jobQueue');
const originalEnqueue = jobQueue.enqueueJob;
jobQueue.enqueueJob = async (jobId) => ({ queuedJobIds: [jobId], activeJobIds: [], queuedCount: 1, activeCount: 0 });
const app = require('../src/app');
const { Job, JobFile } = require('../src/models');
const { serializeJobSummary } = require('../src/services/jobService');
const { persistResult, validateReconciliation, validateResult } = require('../src/skills/genericSkillRunner');
const { loadApprovedSkill } = require('../src/skills/skillPackageService');

const startServer = async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
};

const run = async () => {
  const { server, baseUrl } = await startServer();
  try {
    const catalogResponse = await fetch(`${baseUrl}/api/skills`);
    assert.strictEqual(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.deepStrictEqual(catalog.skills.map((item) => item.skillId).sort(), ['create-pr-cd', 'create-pr-cd-ran', 'iepms-pr-upload-automation', 'tx-bom-generator', 'tx-pr-auditor']);
    const creatorCatalogEntry = catalog.skills.find((item) => item.skillId === 'create-pr-cd');
    assert.strictEqual(creatorCatalogEntry.ui.schemaVersion, '1.0');
    assert.strictEqual(creatorCatalogEntry.ui.parameters.nonProductionUat.hidden, true);
    assert.strictEqual(creatorCatalogEntry.ui.parameters.siteCodes.visibleWhen.field, 'allSites');
    const ranCatalogEntry = catalog.skills.find((item) => item.skillId === 'create-pr-cd-ran');
    const ranProjectPresentation = ranCatalogEntry.ui.parameters.selectedProject;
    assert.strictEqual(ranCatalogEntry.version, '1.1.2');
    assert.strictEqual(ranProjectPresentation.control, 'select');
    assert.strictEqual(ranProjectPresentation.placeholder, 'Select a validated project');
    assert.strictEqual(ranProjectPresentation.disabledWhen.field, 'runMode');
    assert.strictEqual(ranProjectPresentation.requiredWhen.equals, 'general-item');
    assert.strictEqual(ranProjectPresentation.options.length, 15);
    assert(ranProjectPresentation.options.some((option) => option.value === 'Project Thanos'));
    const auditorCatalogEntry = catalog.skills.find((item) => item.skillId === 'tx-pr-auditor');
    assert.deepStrictEqual(auditorCatalogEntry.ui.uploadGroups[0].fields, ['filterYear', 'filterMonth']);
    assert.strictEqual(auditorCatalogEntry.ui.parameters.annotateEcc.default, true);
    assert.deepStrictEqual(auditorCatalogEntry.inputs.files.map((item) => item.name), ['final_po', 'epms']);
    assert.strictEqual(auditorCatalogEntry.ui.configuration.stageHeading, 'Controlled two-stage run');

    const uploadCatalogEntry = catalog.skills.find((item) => item.skillId === 'iepms-pr-upload-automation');
    assert.deepStrictEqual(uploadCatalogEntry.inputs.files.map((item) => item.name), ['ecc', 'attachment']);
    assert.strictEqual(uploadCatalogEntry.inputs.files.find((item) => item.name === 'ecc').required, true);
    assert.deepStrictEqual(uploadCatalogEntry.inputs.files.find((item) => item.name === 'ecc').acceptedExtensions, ['.xls', '.xlsx']);
    assert.strictEqual(uploadCatalogEntry.version, '0.3.7');
    assert.deepStrictEqual(uploadCatalogEntry.inputs.parametersSchema.properties.duModelName.enum, [
      '2023 TX Rollout', 'TX Mini Project', 'MW EOS Swap', 'ZTE TX MINI',
      '2024 Celcomdigi BAU', 'Celcomdigi USP', 'Jendela TX Migration'
    ]);
    assert.strictEqual(uploadCatalogEntry.inputs.files.find((item) => item.name === 'attachment').required, false);
    assert.strictEqual(uploadCatalogEntry.execution.supportsCancellation, false);
    // Actionable uploader diagnostics survive the same serialization used by portal history.
    const mismatchMessage = 'Contract and subcontractor mismatch at workbook line 1 (site A00298-4357B, PBOM 350000214923): the workbook expects Girobumi, but contract S1MY2024071002WBF1 imported the line under GCI SCIENCE & TECHNOLOGY (MALAYSIA) SDN. BHD. Confirm the correct subcontractor and purchase contract in the workbook. Submission stopped; review the existing PR before retrying. Existing PR: PSQ202611050744.';
    const mismatchSummary = serializeJobSummary({
      jobId: 'OFFLINE-MISMATCH', workerType: 'skill', workerId: 'iepms-pr-upload-automation',
      status: 'failed', createdAt: new Date().toISOString(),
      error: { code: 'IEPMS_CONTRACT_SUBCONTRACTOR_MISMATCH', message: mismatchMessage, retryable: false },
      skillResult: { summary: { message: mismatchMessage, metrics: { submitted: false, verified: false, safeToResume: false } } }
    });
    assert.strictEqual(mismatchSummary.failureSummary, mismatchMessage);
    assert.strictEqual(mismatchSummary.error.message, mismatchMessage);
    assert.strictEqual(mismatchSummary.error.code, 'IEPMS_CONTRACT_SUBCONTRACTOR_MISMATCH');
    const uploadForm = new FormData();
    uploadForm.append('browserTabSessionId', 'iepms-contract-tab-001');
    uploadForm.append('idempotencyKey', 'iepms-contract-create-001');
    uploadForm.append('parameters', JSON.stringify({ projectId: 'c46633e8-6e52-2178-f17e-dcbfdade7cb2', scope: 'TI',
      duModelName: 'TX Mini Project', plannedStartDate: '2026-10-15',
      outsourcedComponentService: 'N', productQualityRectification: 'N' }));
    uploadForm.append('ecc', new Blob(['synthetic-ecc']), 'ECC.xlsx');
    const uploadResponse = await fetch(`${baseUrl}/api/skills/iepms-pr-upload-automation/jobs`, { method: 'POST', body: uploadForm });
    assert.strictEqual(uploadResponse.status, 201);
    const uploadJob = (await uploadResponse.json()).job;
    assert.strictEqual(uploadJob.skillId, 'iepms-pr-upload-automation');
    const uploadEnvelope = JSON.parse(await fs.promises.readFile(path.join(tempRoot, uploadJob.inputManifestPath), 'utf8'));
    assert.deepStrictEqual(uploadEnvelope.files.map((item) => item.name), ['ecc']);
    assert.strictEqual(uploadEnvelope.parameters.scope, 'TI');

    // Test-only queue is stubbed above: neither format can reach live iEPMS.
    for (const extension of ['xls', 'xlsx']) {
      const fixture = fs.readFileSync(path.join(__dirname, '../../skills/iepms-pr-upload-automation/tests/fixtures', `ecc.${extension}`));
      const formatForm = new FormData();
      formatForm.append('browserTabSessionId', `iepms-format-tab-${extension}`);
      formatForm.append('idempotencyKey', `iepms-format-create-${extension}`);
      formatForm.append('parameters', uploadEnvelope.parameters ? JSON.stringify(uploadEnvelope.parameters) : '{}');
      formatForm.append('ecc', new Blob([fixture]), `ECC.${extension}`);
      const response = await fetch(`${baseUrl}/api/skills/iepms-pr-upload-automation/jobs`, { method: 'POST', body: formatForm });
      assert.strictEqual(response.status, 201, await response.clone().text());
      const { job } = await response.json();
      const saved = JSON.parse(fs.readFileSync(path.join(tempRoot, job.inputManifestPath), 'utf8'));
      assert(saved.files[0].path.endsWith(`.${extension}`));
      assert.deepStrictEqual(fs.readFileSync(path.join(tempRoot, job.inputManifestPath, '..', saved.files[0].path)), fixture);
    }
    // Queue is stubbed: exercise transport acceptance only; Python owns project pairing.
    for (const [index, model] of ['2024 Celcomdigi BAU', 'Celcomdigi USP', 'Jendela TX Migration'].entries()) {
      const modelForm = new FormData();
      modelForm.append('browserTabSessionId', `iepms-new-model-tab-${index}`);
      modelForm.append('idempotencyKey', `iepms-new-model-create-${index}`);
      modelForm.append('parameters', JSON.stringify({ ...uploadEnvelope.parameters, duModelName: model }));
      modelForm.append('ecc', new Blob([fs.readFileSync(path.join(__dirname, '../../skills/iepms-pr-upload-automation/tests/fixtures/ecc.xlsx'))]), 'ECC.xlsx');
      const response = await fetch(`${baseUrl}/api/skills/iepms-pr-upload-automation/jobs`, { method: 'POST', body: modelForm });
      assert.strictEqual(response.status, 201, await response.clone().text());
      const { job } = await response.json();
      const saved = JSON.parse(fs.readFileSync(path.join(tempRoot, job.inputManifestPath), 'utf8'));
      assert.strictEqual(saved.parameters.duModelName, model);
      assert.strictEqual(saved.parameters.projectId, 'c46633e8-6e52-2178-f17e-dcbfdade7cb2');
    }
    const invalidModelForm = new FormData();
    invalidModelForm.append('browserTabSessionId', 'iepms-invalid-model-tab');
    invalidModelForm.append('idempotencyKey', 'iepms-invalid-model-create');
    invalidModelForm.append('parameters', JSON.stringify({ ...uploadEnvelope.parameters, duModelName: 'TX Migration' }));
    invalidModelForm.append('ecc', new Blob(['synthetic']), 'ECC.xlsx');
    const invalidModelResponse = await fetch(`${baseUrl}/api/skills/iepms-pr-upload-automation/jobs`, { method: 'POST', body: invalidModelForm });
    assert.strictEqual(invalidModelResponse.status, 400);
    const invalidFormat = new FormData();
    invalidFormat.append('browserTabSessionId', 'iepms-invalid-format-tab');
    invalidFormat.append('idempotencyKey', 'iepms-invalid-format-create');
    invalidFormat.append('parameters', JSON.stringify(uploadEnvelope.parameters));
    invalidFormat.append('ecc', new Blob(['not an ECC workbook']), 'ECC.csv');
    const invalidFormatResponse = await fetch(`${baseUrl}/api/skills/iepms-pr-upload-automation/jobs`, { method: 'POST', body: invalidFormat });
    assert.strictEqual(invalidFormatResponse.status, 400);


    const form = new FormData();
    form.append('browserTabSessionId', 'generic-tab-0001');
    form.append('idempotencyKey', 'generic-create-0001');
    form.append('parameters', JSON.stringify({ scope: 'TSS', allSites: true }));
    form.append('site_data', new Blob([Buffer.from('synthetic-xlsx')]), 'site-data.xlsx');
    const createResponse = await fetch(`${baseUrl}/api/skills/create-pr-cd/jobs`, { method: 'POST', body: form });
    assert.strictEqual(createResponse.status, 201);
    const created = await createResponse.json();
    assert.strictEqual(created.job.skillId, 'create-pr-cd');
    assert.strictEqual(created.job.workerType, 'skill');
    assert.strictEqual(created.job.prScope, 'TSS');
    assert.strictEqual(created.job.generationScope, 'all_sites');
    assert.strictEqual(created.job.queueRuntime.queueState, 'queued');
    const inputs = await JobFile.find({ jobId: created.job.jobId }).lean();
    assert.strictEqual(inputs.length, 1);
    assert.strictEqual(inputs[0].fileType, 'skill_input');
    const envelopePath = path.join(tempRoot, created.job.inputManifestPath);
    const envelope = JSON.parse(await fs.promises.readFile(envelopePath, 'utf8'));
    assert.strictEqual(envelope.files[0].name, 'site_data');
    assert.strictEqual(envelope.paths.result, 'result.json');

    const replayResponse = await fetch(`${baseUrl}/api/skills/create-pr-cd/jobs`, { method: 'POST', body: form });
    assert.strictEqual(replayResponse.status, 200);

    const rerunResponse = await fetch(`${baseUrl}/api/jobs/${created.job.jobId}/rerun`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ browserTabSessionId: 'generic-tab-rerun-001' })
    });
    assert.strictEqual(rerunResponse.status, 201);
    const rerun = await rerunResponse.json();
    assert.strictEqual(rerun.job.skillId, 'create-pr-cd');
    assert.strictEqual(rerun.job.rerunSourceJobId, created.job.jobId);

    assert.deepStrictEqual(creatorCatalogEntry.inputs.parametersSchema.properties.scope.enum, ['TSS', 'TI', 'PLANNING']);
    const planningForm = new FormData();
    planningForm.append('browserTabSessionId', 'planning-tab');
    planningForm.append('idempotencyKey', 'planning-create');
    planningForm.append('parameters', JSON.stringify({ scope: 'PLANNING', allSites: true }));
    planningForm.append('site_data', new Blob(['synthetic input']), 'planning.xlsx');
    const planningResponse = await fetch(`${baseUrl}/api/skills/create-pr-cd/jobs`, { method: 'POST', body: planningForm });
    assert.strictEqual(planningResponse.status, 201, await planningResponse.clone().text());
    const planningCreated = await planningResponse.json();
    assert.strictEqual(planningCreated.job.prScope, 'PLANNING');
    const planningSaved = await Job.findOne({ jobId: planningCreated.job.jobId });
    assert.strictEqual(planningSaved.prScope, 'PLANNING');
    assert.strictEqual(new Job({ workerId: 'create-pr-cd', workerType: 'skill', parameters: { scope: 'PLANNING' } }).prScope, 'PLANNING');
    assert.strictEqual(new Job({ workerId: 'iepms-pr-upload-automation', workerType: 'skill', parameters: { scope: 'PLANNING' } }).prScope, 'PLANNING');
    assert.strictEqual(serializeJobSummary({ workerType: 'skill', workerId: 'iepms-pr-upload-automation', parameters: { scope: 'PLANNING' } }).prScope, 'PLANNING');
    const planningDetailResponse = await fetch(`${baseUrl}/api/jobs/${planningCreated.job.jobId}`);
    const planningDetail = await planningDetailResponse.json();
    assert.strictEqual(planningDetail.job.prScope, 'PLANNING');
    const planningList = await (await fetch(`${baseUrl}/api/jobs?prScope=PLANNING`)).json();
    assert(planningList.items.some((item) => item.jobId === planningCreated.job.jobId));
    assert(planningList.items.every((item) => item.prScope === 'PLANNING'));
    await Job.updateOne({ jobId: planningCreated.job.jobId }, { $set: { status: 'completed' } });
    const planningRerun = await fetch(`${baseUrl}/api/jobs/${planningCreated.job.jobId}/rerun`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browserTabSessionId: 'planning-tab' })
    });
    assert.strictEqual(planningRerun.status, 201, await planningRerun.clone().text());
    assert.strictEqual((await planningRerun.json()).job.prScope, 'PLANNING');
    assert.deepStrictEqual(uploadCatalogEntry.inputs.parametersSchema.properties.scope.enum, ['TSS', 'TI', 'PLANNING']);
    const uploadPlanning = new FormData();
    uploadPlanning.append('browserTabSessionId', 'iepms-planning');
    uploadPlanning.append('idempotencyKey', 'iepms-planning-create');
    uploadPlanning.append('parameters', JSON.stringify({ ...uploadEnvelope.parameters, scope: 'PLANNING' }));
    uploadPlanning.append('ecc', new Blob(['synthetic']), 'ECC.xlsx');
    const upResponse = await fetch(`${baseUrl}/api/skills/iepms-pr-upload-automation/jobs`, { method: 'POST', body: uploadPlanning });
    assert.strictEqual(upResponse.status, 201, await upResponse.clone().text());
    const upJob = (await upResponse.json()).job;
    assert.strictEqual(upJob.prScope, 'PLANNING');
    const upSaved = await Job.findOne({ jobId: upJob.jobId });
    assert.strictEqual(upSaved.parameters.scope, 'PLANNING');
    const upEnvelope = JSON.parse(fs.readFileSync(path.join(tempRoot, upJob.inputManifestPath), 'utf8'));
    assert.strictEqual(upEnvelope.parameters.scope, 'PLANNING');
    const upDetail = await (await fetch(`${baseUrl}/api/jobs/${upJob.jobId}`)).json();
    assert.strictEqual(upDetail.job.prScope, 'PLANNING');
    const upList = await (await fetch(`${baseUrl}/api/jobs?workerId=iepms-pr-upload-automation&prScope=PLANNING`)).json();
    assert(upList.items.some((job) => job.jobId === upJob.jobId));
    assert(upList.items.every((job) => job.workerId === 'iepms-pr-upload-automation' && job.prScope === 'PLANNING'));
    await Job.updateOne({ jobId: upJob.jobId }, { $set: { status: 'completed' } });
    const upRerunResponse = await fetch(`${baseUrl}/api/jobs/${upJob.jobId}/rerun`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browserTabSessionId: 'iepms-planning-rerun' })
    });
    assert.strictEqual(upRerunResponse.status, 201, await upRerunResponse.clone().text());
    const upRerun = (await upRerunResponse.json()).job;
    assert.strictEqual(upRerun.prScope, 'PLANNING');
    const upRerunSaved = await Job.findOne({ jobId: upRerun.jobId });
    assert.strictEqual(upRerunSaved.parameters.scope, 'PLANNING');
    const upRerunEnvelope = JSON.parse(fs.readFileSync(path.join(tempRoot, upRerun.inputManifestPath), 'utf8'));
    assert.deepStrictEqual(upRerunEnvelope.parameters, upEnvelope.parameters);
    assert.deepStrictEqual(upRerunEnvelope.files.map((f) => f.sha256), upEnvelope.files.map((f) => f.sha256));
    for (const workerId of ['create-pr-cd-ran', 'tx-pr-auditor', 'tx-bom-generator']) {
      assert(!new Job({ workerType: 'skill', workerId, parameters: { scope: 'PLANNING' } }).prScope);
    }
    const { sanitizeWorkerErrorForLlm } = require('../src/services/jobContextService');
    const planningError = { workerId: 'create-pr-cd', error: { code: 'WORKER_TIMEOUT', details: { scope: 'PLANNING', secret: 'not-public' } } };
    assert.strictEqual(sanitizeWorkerErrorForLlm(planningError).details.scope, 'PLANNING');
    assert(!sanitizeWorkerErrorForLlm(planningError).details.secret);
    assert.strictEqual(sanitizeWorkerErrorForLlm({ ...planningError, workerId: 'iepms-pr-upload-automation' }).details.scope, 'PLANNING');

    const auditorForm = new FormData();
    auditorForm.append('browserTabSessionId', 'generic-auditor-tab-0001');
    auditorForm.append('idempotencyKey', 'generic-auditor-create-0001');
    auditorForm.append('parameters', JSON.stringify({ filterYear: 2026, filterMonth: 6, annotateEcc: true }));
    auditorForm.append('final_po', new Blob([Buffer.from('synthetic-final-po')]), 'Final PO.xlsx');
    auditorForm.append('epms', new Blob([Buffer.from('synthetic-epms')]), 'EPMS.xlsx');
    const auditorResponse = await fetch(`${baseUrl}/api/skills/tx-pr-auditor/jobs`, { method: 'POST', body: auditorForm });
    assert.strictEqual(auditorResponse.status, 201);
    const auditorJob = (await auditorResponse.json()).job;
    assert.strictEqual(auditorJob.skillId, 'tx-pr-auditor');
    const auditorEnvelope = JSON.parse(await fs.promises.readFile(path.join(tempRoot, auditorJob.inputManifestPath), 'utf8'));
    assert.deepStrictEqual(auditorEnvelope.files.map((item) => item.name), ['final_po', 'epms']);
    assert.deepStrictEqual(auditorEnvelope.parameters, { filterYear: 2026, filterMonth: 6, annotateEcc: true });

    const retiredCreateResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workerId: 'mw-pr' })
    });
    assert.strictEqual(retiredCreateResponse.status, 410);
    const legacy = await Job.create({ jobId: 'LEGACY-RERUN-001', workerId: 'mw-pr', workerType: 'pr-worker', status: 'completed' });
    const legacyRerunResponse = await fetch(`${baseUrl}/api/jobs/${legacy.jobId}/rerun`, { method: 'POST' });
    assert.strictEqual(legacyRerunResponse.status, 409);
    const legacyRerun = await legacyRerunResponse.json();
    assert.strictEqual(legacyRerun.error.code, 'LEGACY_RERUN_REQUIRES_NEW_REQUEST');

    validateReconciliation({
      requestedCount: 2, generatedCount: 1, reviewRequiredCount: 1,
      approvedIgnoredCount: 0, duplicateBlockedCount: 0, failedCount: 0, unaccountedCount: 0,
      siteDispositions: [
        { siteCode: 'SITE-001', disposition: 'GENERATED' },
        { siteCode: 'SITE-002', disposition: 'REVIEW_REQUIRED' }
      ]
    }, 'succeeded_with_warning');
    assert.throws(() => validateReconciliation({
      requestedCount: 2, generatedCount: 1, reviewRequiredCount: 0,
      approvedIgnoredCount: 0, duplicateBlockedCount: 0, failedCount: 0, unaccountedCount: 0
    }, 'succeeded'), /arithmetic/);
    assert.throws(() => validateReconciliation({
      requestedCount: 2, generatedCount: 2, reviewRequiredCount: 0,
      approvedIgnoredCount: 0, duplicateBlockedCount: 0, failedCount: 0, unaccountedCount: 0,
      siteDispositions: [{ siteCode: 'SITE-001', disposition: 'GENERATED' }]
    }, 'succeeded'), /identify every requested site/);

    const identityJob = await Job.create({
      jobId: 'GENERIC-SITE-IDENTITY-001',
      workerId: 'create-pr-cd',
      workerType: 'skill',
      skillId: 'create-pr-cd',
      status: 'generating',
      parameters: { scope: 'TI', allSites: false, siteCodes: ['SITE-001', 'SITE-002'] }
    });
    await persistResult({
      job: identityJob,
      skill: loadApprovedSkill('create-pr-cd'),
      outputs: [],
      result: {
        status: 'succeeded_with_warning',
        summary: { message: 'complete' },
        warnings: [{ code: 'REVIEW', message: 'review' }],
        reconciliation: {
          requestedCount: 2, generatedCount: 1, reviewRequiredCount: 1,
          approvedIgnoredCount: 0, duplicateBlockedCount: 0, failedCount: 0, unaccountedCount: 0,
          siteDispositions: [
            { siteCode: 'SITE-001', disposition: 'GENERATED' },
            { siteCode: 'SITE-002', disposition: 'REVIEW_REQUIRED' }
          ]
        }
      }
    });
    const persistedIdentityJob = await Job.findOne({ jobId: identityJob.jobId });
    assert.strictEqual(persistedIdentityJob.prScope, 'TI');
    assert.deepStrictEqual(persistedIdentityJob.matchedSiteCodes, ['SITE-001', 'SITE-002']);
    assert.strictEqual(persistedIdentityJob.matchedSiteCount, 2);
    assert.strictEqual(persistedIdentityJob.unmatchedSiteCount, 0);

    const historicalSummary = serializeJobSummary({
      jobId: 'GENERIC-HISTORICAL-TI-001',
      workerId: 'create-pr-cd',
      workerType: 'skill',
      status: 'completed_with_warning',
      parameters: { scope: 'TI', siteCodes: ['OLD-SITE-001', 'OLD-SITE-002'] },
      matchedSiteCodes: [],
      matchedSiteCount: 0,
      createdAt: new Date().toISOString()
    });
    assert.strictEqual(historicalSummary.prScope, 'TI');
    assert.deepStrictEqual(historicalSummary.matchedSiteCodes, ['OLD-SITE-001', 'OLD-SITE-002']);
    assert.strictEqual(historicalSummary.matchedSiteCount, 2);

    const workspace = path.join(tempRoot, 'result-validation');
    await fs.promises.mkdir(path.join(workspace, 'output'), { recursive: true });
    await fs.promises.writeFile(path.join(workspace, 'output', 'result.txt'), 'ok');
    const job = { jobId: 'GENERIC-RESULT-001' };
    const skill = loadApprovedSkill('tx-pr-auditor');
    const validated = await validateResult({
      job, skill, workspace,
      result: {
        schemaVersion: '1.0', jobId: job.jobId, skillId: 'tx-pr-auditor', skillVersion: skill.manifest.version,
        status: 'succeeded', summary: { message: 'ok', metrics: {} },
        outputs: [{ name: 'result', path: 'output/result.txt', displayName: 'result.txt' }], warnings: [], error: null
      }
    });
    assert.strictEqual(validated.outputs.length, 1);

    const zipPath = path.join(workspace, 'output', 'delivery.zip');
    await fs.promises.writeFile(zipPath, 'zip-content');
    const zipJob = await Job.create({
      jobId: 'GENERIC-ZIP-OUTPUT-001',
      workerId: 'create-pr-cd-ran',
      workerType: 'skill',
      skillId: 'create-pr-cd-ran',
      status: 'generating'
    });
    await persistResult({
      job: zipJob,
      skill: loadApprovedSkill('create-pr-cd-ran'),
      outputs: [{
        absolutePath: zipPath,
        displayName: 'delivery.zip',
        fileSize: 11,
        mediaType: 'application/zip',
        sha256: 'test-sha'
      }],
      result: { status: 'succeeded', summary: { message: 'complete' }, warnings: [] }
    });
    const persistedArchive = await JobFile.findOne({ jobId: zipJob.jobId, fileType: 'zip_package' });
    assert(persistedArchive);
    assert.strictEqual(persistedArchive.fileName, 'delivery.zip');
    console.log('Generic skill catalog, submission, and result-contract tests passed.');
  } finally {
    jobQueue.enqueueJob = originalEnqueue;
    await new Promise((resolve) => server.close(resolve));
    await Job.deleteMany({}).catch(() => {});
    await JobFile.deleteMany({}).catch(() => {});
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
