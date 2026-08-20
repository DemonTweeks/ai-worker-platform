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
    assert.deepStrictEqual(catalog.skills.map((item) => item.skillId).sort(), ['bom-builder', 'create-pr-cd', 'create-pr-cd-ran', 'tx-pr-auditor']);
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
    const bomCatalogEntry = catalog.skills.find((item) => item.skillId === 'bom-builder');
    assert.deepStrictEqual(bomCatalogEntry.inputs.files.map((item) => item.name), ['epms', 'scm_inventory', 'huawei_stock']);
    assert.deepStrictEqual(bomCatalogEntry.inputs.parametersSchema.properties.mode.enum, ['analyze', 'validate']);
    assert.strictEqual(bomCatalogEntry.ui.parameters.profile.hidden, true);

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

    const bomForm = new FormData();
    bomForm.append('browserTabSessionId', 'generic-bom-tab-0001');
    bomForm.append('idempotencyKey', 'generic-bom-create-0001');
    bomForm.append('parameters', JSON.stringify({ mode: 'validate', profile: 'auto' }));
    bomForm.append('epms', new Blob([Buffer.from('synthetic-epms')]), 'TX Mini EPMS.xlsx');
    const bomResponse = await fetch(`${baseUrl}/api/skills/bom-builder/jobs`, { method: 'POST', body: bomForm });
    assert.strictEqual(bomResponse.status, 201);
    const bomJob = (await bomResponse.json()).job;
    assert.strictEqual(bomJob.skillId, 'bom-builder');
    const bomEnvelope = JSON.parse(await fs.promises.readFile(path.join(tempRoot, bomJob.inputManifestPath), 'utf8'));
    assert.deepStrictEqual(bomEnvelope.files.map((item) => item.name), ['epms']);
    assert.deepStrictEqual(bomEnvelope.parameters, { mode: 'validate', profile: 'auto' });

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
        schemaVersion: '1.0', jobId: job.jobId, skillId: 'tx-pr-auditor', skillVersion: '1.1.0',
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
