const assert = require('assert');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.AI_WORKER_MACHINE_ID = 'queue-test-machine';
process.env.AI_WORKER_RUNTIME_INSTANCE_ID = 'queue-test-runtime-new';
process.env.QUEUE_LEASE_DURATION_MS = '10000';
process.env.QUEUE_HEARTBEAT_INTERVAL_MS = '1000';

const repoRoot = path.resolve(__dirname, '..');
const workerRegistryPath = path.join(repoRoot, 'src', 'workers', 'workerRegistry.js');
require.cache[require.resolve(workerRegistryPath)] = {
  exports: {
    getWorkerAdapter: () => ({
      run: async (jobId) => {
        const { Job } = require('../src/models');
        await Job.updateOne({ jobId }, { $set: { status: 'completed', completedAt: new Date().toISOString() } });
      }
    })
  }
};

const { Job } = require('../src/models');
const queue = require('../src/queue/jobQueue');

const expired = () => new Date(Date.now() - 60000).toISOString();
const future = () => new Date(Date.now() + 60000).toISOString();
const runtime = ({ machineId = 'queue-test-machine', runtimeInstanceId = 'queue-test-runtime-old', leaseExpiresAt = expired() } = {}) => ({
  queueState: 'running', machineId, runtimeInstanceId,
  claimedAt: expired(), heartbeatAt: expired(), leaseExpiresAt,
  reconciliationState: null, cancellationRequested: false
});
const waitFor = async (predicate, timeoutMs = 2000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for durable queue condition.');
};

const run = async () => {
  const claimedJob = await Job.create({ jobId: 'QUEUE-CLAIM', workerId: 'synthetic', status: 'queued' });
  const claimed = await queue.claimJob(claimedJob.jobId);
  assert(claimed, 'queued job should be atomically claimable');
  assert.strictEqual(claimed.queueRuntime.machineId, 'queue-test-machine');
  assert.strictEqual(claimed.queueRuntime.runtimeInstanceId, 'queue-test-runtime-new');
  assert.strictEqual(claimed.queueRuntime.queueState, 'running');

  await Job.create({
    jobId: 'QUEUE-COMPETING', workerId: 'synthetic', status: 'queued',
    queueRuntime: runtime({ machineId: 'other-machine', runtimeInstanceId: 'other-runtime', leaseExpiresAt: future() })
  });
  assert.strictEqual(await queue.claimJob('QUEUE-COMPETING'), null, 'a valid foreign lease must reject a competing claim');

  await Job.create({
    jobId: 'QUEUE-SAME-MACHINE-OLD-RUNTIME', workerId: 'synthetic', status: 'generating',
    queueRuntime: runtime({ leaseExpiresAt: expired() })
  });
  const reconciled = await queue.reconcileQueue();
  assert(reconciled.inspectedCount >= 1);
  const interrupted = await Job.findOne({ jobId: 'QUEUE-SAME-MACHINE-OLD-RUNTIME' });
  assert.strictEqual(interrupted.status, 'failed');
  assert.strictEqual(interrupted.error.code, 'WORKER_INTERRUPTED_BY_RESTART');
  assert.strictEqual(interrupted.queueRuntime.reconciliationState, 'recovered');
  assert.strictEqual(interrupted.statusEvents.filter((event) => event.type === 'runtime_reconciled').length, 1);
  await queue.reconcileQueue();
  const repeated = await Job.findOne({ jobId: interrupted.jobId });
  assert.strictEqual(repeated.statusEvents.filter((event) => event.type === 'runtime_reconciled').length, 1, 'reconciliation must be idempotent');

  for (const status of ['validating', 'filtering_sites', 'loading_assets', 'exporting', 'waiting_for_user_input']) {
    await Job.create({ jobId: `QUEUE-${status.toUpperCase()}`, workerId: 'synthetic', status, queueRuntime: runtime() });
  }
  await Job.create({ jobId: 'QUEUE-CANCELLING', workerId: 'synthetic', status: 'cancelling', queueRuntime: runtime() });
  await queue.reconcileQueue();
  for (const status of ['validating', 'filtering_sites', 'loading_assets', 'exporting', 'waiting_for_user_input']) {
    const job = await Job.findOne({ jobId: `QUEUE-${status.toUpperCase()}` });
    assert.strictEqual(job.status, 'failed', `${status} must fail safely after an expired lease`);
  }
  assert.strictEqual((await Job.findOne({ jobId: 'QUEUE-CANCELLING' })).status, 'cancelled');

  await Job.create({ jobId: 'QUEUE-RECOVER', workerId: 'synthetic', status: 'queued', queueRuntime: runtime() });
  await queue.reconcileQueue();
  await waitFor(async () => (await Job.findOne({ jobId: 'QUEUE-RECOVER' })).status === 'completed');
  const recovered = await Job.findOne({ jobId: 'QUEUE-RECOVER' });
  assert.strictEqual(recovered.queueRuntime.queueState, 'terminal');
  assert.strictEqual(recovered.queueRuntime.reconciliationState, 'recovered');

  await queue.shutdownQueue();
  console.log('Durable queue restart and ownership reconciliation tests passed.');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
