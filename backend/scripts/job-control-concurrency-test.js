const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-concurrency-'));
process.env.STORAGE_ROOT = tempRoot;

const jobQueue = require('../src/queue/jobQueue');
const originalEnqueue = jobQueue.enqueueJob;
jobQueue.enqueueJob = async (jobId) => ({ queuedJobIds: [jobId], activeJobIds: [], queuedCount: 1, activeCount: 0 });
const { Job, JobFile } = require('../src/models');
const { createSkillJob } = require('../src/skills/genericSkillJobService');

const request = () => createSkillJob('create-pr-cd', {
  browserTabSessionId: 'concurrency-tab-001',
  idempotencyKey: 'concurrent-skill-create-001',
  parameters: JSON.stringify({ scope: 'TSS', allSites: true })
}, [{
  fieldname: 'site_data',
  originalname: 'site-data.xlsx',
  size: 14,
  buffer: Buffer.from('synthetic-xlsx')
}]);

const run = async () => {
  try {
    const results = await Promise.all([request(), request()]);
    assert.deepStrictEqual(results.map((item) => item.created).sort(), [false, true]);
    assert.strictEqual(results[0].job.jobId, results[1].job.jobId);
    assert.strictEqual((await Job.find({ skillId: 'create-pr-cd' }).lean()).length, 1);
    assert.strictEqual((await JobFile.find({ jobId: results[0].job.jobId, fileType: 'skill_input' }).lean()).length, 1);
    console.log('Generic skill concurrent idempotency test passed.');
  } finally {
    jobQueue.enqueueJob = originalEnqueue;
    await Job.deleteMany({}).catch(() => {});
    await JobFile.deleteMany({}).catch(() => {});
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
