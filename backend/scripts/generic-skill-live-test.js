const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';
process.env.MAX_CONCURRENT_JOBS = '1';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generic-skill-live-'));
process.env.STORAGE_ROOT = tempRoot;

const { Job, JobFile } = require('../src/models');
const { createSkillJob } = require('../src/skills/genericSkillJobService');
const { shutdownQueue } = require('../src/queue/jobQueue');

const waitForTerminal = async (jobId, timeoutMs = 120000) => {
  const terminal = new Set(['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result']);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await Job.findOne({ jobId });
    if (job && terminal.has(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${jobId}.`);
};

const run = async () => {
  try {
    const sourcePath = path.resolve(__dirname, '../../skills/create-pr-cd/Info/input/site_pr_po_view.xlsx');
    const buffer = await fs.promises.readFile(sourcePath);
    const created = await createSkillJob('create-pr-cd', {
      browserTabSessionId: 'generic-live-tab-001',
      idempotencyKey: 'generic-live-create-001',
      parameters: JSON.stringify({ scope: 'TSS', allSites: true, nonProductionUat: false })
    }, [{
      fieldname: 'site_data',
      originalname: 'site_pr_po_view.xlsx',
      size: buffer.length,
      buffer
    }]);
    const completed = await waitForTerminal(created.job.jobId);
    assert.notStrictEqual(completed.status, 'failed', JSON.stringify(completed.error || {}));
    assert(completed.skillResult, 'generic runner must persist the authoritative result envelope');
    assert.strictEqual(completed.skillResult.skillId, 'create-pr-cd');
    assert.strictEqual(completed.reconciliationConsistent, true);
    const files = await JobFile.find({ jobId: completed.jobId }).lean();
    assert(files.some((file) => file.fileType === 'skill_output'));
    console.log(JSON.stringify({
      jobId: completed.jobId,
      status: completed.status,
      outputFileCount: completed.outputFileCount,
      reconciliation: completed.skillResult.reconciliation
    }, null, 2));
  } finally {
    await shutdownQueue();
    await Job.deleteMany({}).catch(() => {});
    await JobFile.deleteMany({}).catch(() => {});
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
