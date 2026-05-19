const config = require('../config/env');
const workerStateService = require('../services/workerStateService');
const { runPrWorkerJob } = require('../services/prWorkerService');
const { Job } = require('../models');

const queuedJobIds = [];
const activeJobIds = new Set();
const knownJobIds = new Set();

const getMaxConcurrentJobs = () => Math.max(1, config.limits.maxConcurrentJobs);

const getQueueState = () => ({
  maxConcurrentJobs: getMaxConcurrentJobs(),
  activeJobIds: Array.from(activeJobIds),
  queuedJobIds: [...queuedJobIds],
  activeCount: activeJobIds.size,
  queuedCount: queuedJobIds.length
});

const drainQueue = () => {
  while (activeJobIds.size < getMaxConcurrentJobs() && queuedJobIds.length > 0) {
    const jobId = queuedJobIds.shift();
    activeJobIds.add(jobId);
    workerStateService.setPhase(jobId, 'VALIDATION_STARTED', 'Job dequeued for execution.');

    runPrWorkerJob(jobId)
      .catch((error) => {
        console.error(`Unhandled worker error for ${jobId}: ${error.message}`);
      })
      .finally(() => {
        activeJobIds.delete(jobId);
        knownJobIds.delete(jobId);
        drainQueue();
      });
  }
};

const enqueueJob = async (jobId) => {
  if (knownJobIds.has(jobId) || activeJobIds.has(jobId) || queuedJobIds.includes(jobId)) {
    return getQueueState();
  }

  knownJobIds.add(jobId);
  queuedJobIds.push(jobId);
  workerStateService.createState(jobId, 'QUEUED');
  drainQueue();
  return getQueueState();
};

const cancelQueuedJob = async (jobId) => {
  const queuedIndex = queuedJobIds.indexOf(jobId);

  if (queuedIndex !== -1) {
    queuedJobIds.splice(queuedIndex, 1);
    knownJobIds.delete(jobId);
    await Job.updateOne({ jobId }, { $set: { status: 'cancelled', cancelledAt: new Date() } });
    workerStateService.setCancelled(jobId, 'Queued job cancelled before execution.');
    return { cancelled: true, running: false };
  }

  if (activeJobIds.has(jobId)) {
    workerStateService.requestCancellation(jobId);
    return { cancelled: false, running: true };
  }

  return { cancelled: false, running: false };
};

module.exports = {
  cancelQueuedJob,
  enqueueJob,
  getQueueState
};
