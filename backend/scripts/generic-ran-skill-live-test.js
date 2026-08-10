const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';
process.env.MAX_CONCURRENT_JOBS = '1';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generic-ran-skill-live-'));
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

const upload = async (fieldname, sourcePath) => {
  const buffer = await fs.promises.readFile(sourcePath);
  return { fieldname, originalname: path.basename(sourcePath), size: buffer.length, buffer };
};

const run = async () => {
  try {
    const root = path.resolve(__dirname, '../../skills/create-pr-cd-ran');
    const files = await Promise.all([
      upload('bom', path.join(root, 'input', 'BOM.xlsx')),
      upload('epms', path.join(root, 'input', 'EPMS.xlsx'))
    ]);
    const created = await createSkillJob('create-pr-cd-ran', {
      browserTabSessionId: 'generic-ran-live-tab-001',
      idempotencyKey: 'generic-ran-live-create-001',
      parameters: JSON.stringify({ runMode: 'standard-pr' })
    }, files);
    const completed = await waitForTerminal(created.job.jobId);
    assert.notStrictEqual(completed.status, 'failed', JSON.stringify(completed.error || {}));
    assert.strictEqual(completed.skillResult.skillId, 'create-pr-cd-ran');
    const outputs = await JobFile.find({ jobId: completed.jobId, fileType: 'skill_output' }).lean();
    assert(outputs.some((file) => file.fileName === 'ECC_PR_Output.xlsx'));
    console.log(JSON.stringify({ jobId: completed.jobId, status: completed.status, outputFileCount: outputs.length }, null, 2));
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
