const assert = require('assert');
const { getWorkerAdapter, listWorkers } = require('../src/workers/workerRegistry');
const jobQueue = require('../src/queue/jobQueue');
const { Job } = require('../src/models');

const SKILL_IDS = ['bom-builder', 'create-pr-cd', 'create-pr-cd-ran', 'tx-pr-auditor'];

const runTests = async () => {
  assert.deepStrictEqual(listWorkers().map((worker) => worker.skillId).sort(), [...SKILL_IDS].sort());
  for (const skillId of SKILL_IDS) {
    const adapter = getWorkerAdapter(skillId);
    assert.strictEqual(typeof adapter.run, 'function');
  }
  const originalJobFindOne = Job.findOne;
  try {
    for (const skillId of SKILL_IDS) {
      Job.findOne = async ({ jobId }) => ({ jobId, workerId: skillId, workerType: 'skill', skillId });
      const resolved = await jobQueue.resolveJobAdapter(`QA-${skillId}`);
      assert.strictEqual(typeof resolved.run, 'function');
    }
    Job.findOne = async () => null;
    await assert.rejects(() => jobQueue.resolveJobAdapter('QA-MISSING'), (error) => error.code === 'JOB_NOT_FOUND');
    Job.findOne = async ({ jobId }) => ({ jobId, workerId: 'retired-worker' });
    await assert.rejects(() => jobQueue.resolveJobAdapter('QA-RETIRED'), (error) => error.code === 'WORKER_NOT_REGISTERED');
  } finally {
    Job.findOne = originalJobFindOne;
  }
  console.log('Generic skill queue registry tests passed.');
};

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
