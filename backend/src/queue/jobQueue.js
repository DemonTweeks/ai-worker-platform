const config = require('../config/env');
const workerStateService = require('../services/workerStateService');
const { Job } = require('../models');
const { JOB_EVENTS, publishHeartbeat, publishJobEvent } = require('../websocket/eventPublisher');
const { getWorkerAdapter } = require('../workers/workerRegistry');
const { WORKER_IDS } = require('../workers/workerTypes');

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

const resolveJobAdapter = async (jobId) => {
  const job = await Job.findOne({ jobId });

  if (!job) {
    const error = new Error(`Queued job ${jobId} was not found.`);
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }

  const workerId = job.workerId || WORKER_IDS.MW_PR;
  return getWorkerAdapter(workerId);
};

const drainQueue = () => {
  while (activeJobIds.size < getMaxConcurrentJobs() && queuedJobIds.length > 0) {
    const jobId = queuedJobIds.shift();
    activeJobIds.add(jobId);
    workerStateService.setPhase(jobId, 'VALIDATION_STARTED', 'Job dequeued for execution.');

    resolveJobAdapter(jobId)
      .then((adapter) => adapter.run(jobId))
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
  await publishJobEvent(jobId, JOB_EVENTS.JOB_QUEUED, {
    phase: 'QUEUED',
    status: 'queued',
    message: 'Job queued.'
  });
  drainQueue();
  return getQueueState();
};

const cancelQueuedJob = async (jobId) => {
  const queuedIndex = queuedJobIds.indexOf(jobId);

  if (queuedIndex !== -1) {
    queuedJobIds.splice(queuedIndex, 1);
    knownJobIds.delete(jobId);
    await Job.updateOne({ jobId }, {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        finalWorkerSummary: 'Task cancelled. Any completed partial output files have been preserved where available.'
      }
    });
    workerStateService.setCancelled(jobId, 'Queued job cancelled before execution.');
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
      phase: 'CANCELLED',
      status: 'cancelled',
      message: 'Queued job cancelled before execution.'
    });
    return { cancelled: true, running: false };
  }

  if (activeJobIds.has(jobId)) {
    workerStateService.requestCancellation(jobId);
    await publishHeartbeat(jobId);
    return { cancelled: false, running: true };
  }

  return { cancelled: false, running: false };
};

module.exports = {
  cancelQueuedJob,
  enqueueJob,
  getQueueState,
  resolveJobAdapter
};
