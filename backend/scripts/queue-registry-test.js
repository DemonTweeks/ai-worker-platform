const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

setCachedModule(path.join(repoRoot, 'src/services/prWorkerService.js'), {
  runPrWorkerJob: async (jobId) => ({ jobId, worker: 'mw' })
});

setCachedModule(path.join(repoRoot, 'src/workers/adapters/ranPrAdapter.js'), {
  run: async (jobId) => ({ jobId, worker: 'ran' })
});

const { getWorkerAdapter } = require('../src/workers/workerRegistry');
const jobQueue = require('../src/queue/jobQueue');
const { Job } = require('../src/models');

const runTests = async () => {
  console.log('--- Running Queue Registry Dispatch Tests ---');

  const originalJobFindOne = Job.findOne;

  try {
    const mwAdapter = getWorkerAdapter('mw-pr');
    assert.strictEqual(typeof mwAdapter.run, 'function', 'mw-pr should resolve an execution adapter');

    const ranAdapter = getWorkerAdapter('ran-pr');
    assert.strictEqual(typeof ranAdapter.run, 'function', 'ran-pr should resolve an execution adapter');

    Job.findOne = async ({ jobId }) => ({
      jobId,
      workerId: 'mw-pr'
    });
    let resolvedAdapter = await jobQueue.resolveJobAdapter('QA-QUEUE-MW');
    assert.strictEqual(resolvedAdapter, mwAdapter, 'MW jobs should resolve the MW adapter');
    const mwResult = await resolvedAdapter.run('QA-QUEUE-MW');
    assert.deepStrictEqual(mwResult, { jobId: 'QA-QUEUE-MW', worker: 'mw' });

    Job.findOne = async ({ jobId }) => ({
      jobId,
      workerId: 'ran-pr'
    });
    resolvedAdapter = await jobQueue.resolveJobAdapter('QA-QUEUE-RAN');
    assert.strictEqual(resolvedAdapter, ranAdapter, 'RAN jobs should resolve the RAN adapter');
    const ranResult = await resolvedAdapter.run('QA-QUEUE-RAN');
    assert.deepStrictEqual(ranResult, { jobId: 'QA-QUEUE-RAN', worker: 'ran' });

    Job.findOne = async ({ jobId }) => ({
      jobId,
      workerType: 'pr-worker'
    });
    resolvedAdapter = await jobQueue.resolveJobAdapter('QA-QUEUE-DEFAULT');
    assert.strictEqual(resolvedAdapter, mwAdapter, 'jobs without workerId should default to mw-pr');

    Job.findOne = async () => null;
    await assert.rejects(
      () => jobQueue.resolveJobAdapter('QA-QUEUE-MISSING'),
      (error) => error.code === 'JOB_NOT_FOUND',
      'missing queue job should fail with JOB_NOT_FOUND'
    );

    Job.findOne = async ({ jobId }) => ({
      jobId,
      workerId: 'unknown-worker'
    });
    await assert.rejects(
      () => jobQueue.resolveJobAdapter('QA-QUEUE-UNKNOWN'),
      (error) => error.code === 'WORKER_NOT_REGISTERED',
      'unknown worker ids should fail through the registry'
    );

    console.log('--- Queue Registry Dispatch Tests Passed! ---');
  } finally {
    Job.findOne = originalJobFindOne;
  }
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
