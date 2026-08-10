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
const { validateReconciliation, validateResult } = require('../src/skills/genericSkillRunner');
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
    assert.deepStrictEqual(catalog.skills.map((item) => item.skillId).sort(), ['create-pr-cd', 'create-pr-cd-ran', 'tx-pr-auditor']);

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
      approvedIgnoredCount: 0, duplicateBlockedCount: 0, failedCount: 0, unaccountedCount: 0
    }, 'succeeded_with_warning');
    assert.throws(() => validateReconciliation({
      requestedCount: 2, generatedCount: 1, reviewRequiredCount: 0,
      approvedIgnoredCount: 0, duplicateBlockedCount: 0, failedCount: 0, unaccountedCount: 0
    }, 'succeeded'), /arithmetic/);

    const workspace = path.join(tempRoot, 'result-validation');
    await fs.promises.mkdir(path.join(workspace, 'output'), { recursive: true });
    await fs.promises.writeFile(path.join(workspace, 'output', 'result.txt'), 'ok');
    const job = { jobId: 'GENERIC-RESULT-001' };
    const skill = loadApprovedSkill('tx-pr-auditor');
    const validated = await validateResult({
      job, skill, workspace,
      result: {
        schemaVersion: '1.0', jobId: job.jobId, skillId: 'tx-pr-auditor', skillVersion: '1.0.0',
        status: 'succeeded', summary: { message: 'ok', metrics: {} },
        outputs: [{ name: 'result', path: 'output/result.txt', displayName: 'result.txt' }], warnings: [], error: null
      }
    });
    assert.strictEqual(validated.outputs.length, 1);
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
