const config = require('../config/env');
const { transactionFirebase } = require('../db/firebaseClient');
const workerStateService = require('../services/workerStateService');
const { getRuntimeIdentity } = require('../services/runtimeIdentityService');
const { Job } = require('../models');
const { JOB_EVENTS, publishHeartbeat, publishJobEvent } = require('../websocket/eventPublisher');
const { getWorkerAdapter } = require('../workers/workerRegistry');
const { WORKER_IDS } = require('../workers/workerTypes');

const ACTIVE_STATUSES = new Set([
  'queued', 'validating', 'filtering_sites', 'loading_assets', 'generating',
  'exporting', 'waiting_for_user_input', 'cancelling'
]);
const RUNNING_STATUSES = new Set([...ACTIVE_STATUSES].filter((status) => status !== 'queued'));
const TERMINAL_STATUSES = new Set([
  'completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'
]);

const queuedJobIds = [];
const activeJobIds = new Set();
const knownJobIds = new Set();
const heartbeatTimers = new Map();
let drainInProgress = false;
let drainRequested = false;
let reconciliationTimer = null;

const getMaxConcurrentJobs = () => Math.max(1, config.limits.maxConcurrentJobs);
const now = () => new Date().toISOString();
const leaseExpiry = () => new Date(Date.now() + config.queue.leaseDurationMs).toISOString();
const isLeaseValid = (runtime = {}, at = Date.now()) => (
  Boolean(runtime.leaseExpiresAt) && new Date(runtime.leaseExpiresAt).getTime() > at
);
const isOwnedByThisRuntime = (runtime = {}) => {
  const identity = getRuntimeIdentity();
  return runtime.machineId === identity.machineId && runtime.runtimeInstanceId === identity.runtimeInstanceId;
};
const appendEvent = (job, event) => {
  const events = Array.isArray(job.statusEvents) ? [...job.statusEvents] : [];
  if (!events.some((item) => item.type === event.type && item.runtimeInstanceId === event.runtimeInstanceId)) {
    events.push(event);
  }
  return events;
};

const getQueueState = () => ({
  ...getRuntimeIdentity(),
  maxConcurrentJobs: getMaxConcurrentJobs(),
  activeJobIds: Array.from(activeJobIds),
  queuedJobIds: [...queuedJobIds],
  activeCount: activeJobIds.size,
  queuedCount: queuedJobIds.length
});

const getJobOwnership = (jobId) => {
  if (queuedJobIds.includes(jobId)) return 'queued';
  if (activeJobIds.has(jobId)) return 'running';
  if (knownJobIds.has(jobId)) return 'known';
  return 'unknown';
};

const resolveJobAdapter = async (jobId) => {
  const job = await Job.findOne({ jobId });
  if (!job) {
    const error = new Error(`Queued job ${jobId} was not found.`);
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }
  return getWorkerAdapter(job.workerId || WORKER_IDS.MW_PR);
};

const transactJob = (jobId, updater) => transactionFirebase(`jobs/${jobId}`, (job) => {
  if (!job || job.logicalDeleted) return undefined;
  return updater(job);
});

const claimJob = async (jobId) => {
  const identity = getRuntimeIdentity();
  const result = await transactJob(jobId, (job) => {
    if (TERMINAL_STATUSES.has(job.status) || job.status !== 'queued') return undefined;
    const current = job.queueRuntime || {};
    if (['claimed', 'running'].includes(current.queueState) && isLeaseValid(current) && !isOwnedByThisRuntime(current)) {
      return undefined;
    }
    const timestamp = now();
    return {
      ...job,
      queueRuntime: {
        ...current,
        queueState: 'running',
        machineId: identity.machineId,
        runtimeInstanceId: identity.runtimeInstanceId,
        claimedAt: current.claimedAt && isOwnedByThisRuntime(current) ? current.claimedAt : timestamp,
        heartbeatAt: timestamp,
        leaseExpiresAt: leaseExpiry(),
        reconciliationState: current.reconciliationState || null,
        cancellationRequested: false
      }
    };
  });
  return result.committed ? result.snapshot : null;
};

const renewLease = async (jobId) => {
  const result = await transactJob(jobId, (job) => {
    const current = job.queueRuntime || {};
    if (!isOwnedByThisRuntime(current) || TERMINAL_STATUSES.has(job.status)) return undefined;
    const timestamp = now();
    return {
      ...job,
      queueRuntime: {
        ...current,
        queueState: job.status === 'cancelling' ? 'cancelling' : 'running',
        heartbeatAt: timestamp,
        leaseExpiresAt: leaseExpiry()
      }
    };
  });
  const runtime = result.snapshot && result.snapshot.queueRuntime;
  if (runtime && runtime.cancellationRequested && !workerStateService.isCancellationRequested(jobId)) {
    workerStateService.requestCancellation(jobId);
  }
  if (result.committed) await publishHeartbeat(jobId);
  return result.committed;
};

const startLeaseHeartbeat = (jobId) => {
  const timer = setInterval(() => {
    renewLease(jobId).catch((error) => {
      console.error(`Queue lease heartbeat failed for ${jobId}: ${error.message}`);
    });
  }, Math.min(config.queue.heartbeatIntervalMs, Math.floor(config.queue.leaseDurationMs / 2)));
  timer.unref?.();
  heartbeatTimers.set(jobId, timer);
};

const stopLeaseHeartbeat = (jobId) => {
  const timer = heartbeatTimers.get(jobId);
  if (timer) clearInterval(timer);
  heartbeatTimers.delete(jobId);
};

const finalizeClaim = async (jobId, unhandledError = null) => {
  const identity = getRuntimeIdentity();
  const result = await transactJob(jobId, (job) => {
    const current = job.queueRuntime || {};
    if (!isOwnedByThisRuntime(current)) return undefined;
    const timestamp = now();
    let updated = job;
    if (ACTIVE_STATUSES.has(job.status)) {
      updated = {
        ...job,
        status: 'failed',
        completedAt: timestamp,
        finalWorkerSummary: 'Worker execution stopped without recording a terminal result.',
        error: {
          code: 'UNHANDLED_WORKER_ERROR',
          category: 'internal',
          message: 'Worker execution stopped without recording a terminal result.',
          retryable: true,
          details: unhandledError ? { runtimeInstanceId: identity.runtimeInstanceId } : {}
        },
        statusEvents: appendEvent(job, {
          type: 'runtime_failed',
          createdAt: timestamp,
          machineId: identity.machineId,
          runtimeInstanceId: identity.runtimeInstanceId
        })
      };
    }
    return {
      ...updated,
      queueRuntime: {
        ...current,
        queueState: 'terminal',
        heartbeatAt: timestamp,
        leaseExpiresAt: null,
        reconciliationState: current.reconciliationState || null,
        cancellationRequested: Boolean(current.cancellationRequested)
      }
    };
  });
  return result.committed;
};

const executeClaimedJob = async (jobId) => {
  let unhandledError = null;
  activeJobIds.add(jobId);
  workerStateService.setPhase(jobId, 'VALIDATION_STARTED', 'Job claimed for execution.');
  startLeaseHeartbeat(jobId);
  try {
    const adapter = await resolveJobAdapter(jobId);
    await adapter.run(jobId);
  } catch (error) {
    unhandledError = error;
    console.error(`Unhandled worker error for ${jobId}: ${error.message}`);
  } finally {
    stopLeaseHeartbeat(jobId);
    await finalizeClaim(jobId, unhandledError).catch((error) => {
      console.error(`Queue finalization failed for ${jobId}: ${error.message}`);
    });
    activeJobIds.delete(jobId);
    knownJobIds.delete(jobId);
  }
};

const drainQueue = async () => {
  if (drainInProgress) {
    drainRequested = true;
    return;
  }
  drainInProgress = true;
  try {
    do {
      drainRequested = false;
      while (activeJobIds.size < getMaxConcurrentJobs() && queuedJobIds.length > 0) {
        const jobId = queuedJobIds.shift();
        const claimed = await claimJob(jobId);
        if (!claimed) {
          knownJobIds.delete(jobId);
          continue;
        }
        executeClaimedJob(jobId).finally(() => {
          drainQueue().catch((error) => console.error(`Queue drain failed: ${error.message}`));
        });
      }
    } while (drainRequested);
  } finally {
    drainInProgress = false;
  }
};

const scheduleDrain = () => {
  queueMicrotask(() => drainQueue().catch((error) => console.error(`Queue drain failed: ${error.message}`)));
};

const persistQueuedState = async (jobId, reconciliationState = null) => transactJob(jobId, (job) => {
  if (TERMINAL_STATUSES.has(job.status)) return undefined;
  const current = job.queueRuntime || {};
  if (['claimed', 'running', 'cancelling'].includes(current.queueState) && isLeaseValid(current)) return undefined;
  return {
    ...job,
    status: 'queued',
    queueRuntime: {
      ...current,
      queueState: 'queued',
      machineId: null,
      runtimeInstanceId: null,
      claimedAt: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
      reconciliationState,
      cancellationRequested: false
    }
  };
});

const enqueueJob = async (jobId, { recovered = false } = {}) => {
  if (knownJobIds.has(jobId) || activeJobIds.has(jobId) || queuedJobIds.includes(jobId)) return getQueueState();
  const persisted = await persistQueuedState(jobId, recovered ? 'recovered' : null);
  if (!persisted.committed && (!persisted.snapshot || persisted.snapshot.status !== 'queued')) return getQueueState();
  knownJobIds.add(jobId);
  queuedJobIds.push(jobId);
  workerStateService.createState(jobId, 'QUEUED');
  if (!recovered) {
    await publishJobEvent(jobId, JOB_EVENTS.JOB_QUEUED, {
      phase: 'QUEUED', status: 'queued', message: 'Job queued.'
    });
  }
  scheduleDrain();
  return getQueueState();
};

const cancelQueuedJob = async (jobId) => {
  const queuedIndex = queuedJobIds.indexOf(jobId);
  const locallyQueued = queuedIndex !== -1;
  const locallyActive = activeJobIds.has(jobId);
  const result = await transactJob(jobId, (job) => {
    if (TERMINAL_STATUSES.has(job.status)) return undefined;
    const current = job.queueRuntime || {};
    const running = ['claimed', 'running', 'cancelling'].includes(current.queueState) && isLeaseValid(current);
    return {
      ...job,
      queueRuntime: {
        ...current,
        queueState: running ? 'cancelling' : 'terminal',
        heartbeatAt: now(),
        leaseExpiresAt: running ? current.leaseExpiresAt : null,
        reconciliationState: current.reconciliationState || null,
        cancellationRequested: true
      }
    };
  });
  const runtime = result.snapshot && result.snapshot.queueRuntime;
  const running = Boolean(runtime && runtime.queueState === 'cancelling' && isLeaseValid(runtime));
  if (locallyQueued && !running) {
    queuedJobIds.splice(queuedIndex, 1);
    knownJobIds.delete(jobId);
    workerStateService.setCancelled(jobId, 'Queued job cancelled before execution.');
    return { cancelled: true, running: false, alreadyRequested: false, queueRuntime: runtime };
  }
  if (running || locallyActive) {
    const alreadyRequested = workerStateService.isCancellationRequested(jobId) || Boolean(runtime && runtime.cancellationRequested && !locallyActive);
    if (locallyActive && !workerStateService.isCancellationRequested(jobId)) workerStateService.requestCancellation(jobId);
    await publishHeartbeat(jobId);
    return { cancelled: false, running: true, alreadyRequested, queueRuntime: runtime };
  }
  return { cancelled: false, running: false, alreadyRequested: false, queueRuntime: runtime };
};

const reconcileInterruptedJob = async (jobId) => {
  const identity = getRuntimeIdentity();
  const result = await transactJob(jobId, (job) => {
    if (!ACTIVE_STATUSES.has(job.status)) return undefined;
    const current = job.queueRuntime || {};
    if (['claimed', 'running', 'cancelling'].includes(current.queueState) && isLeaseValid(current)) return undefined;
    if (job.status === 'queued') {
      return {
        ...job,
        queueRuntime: {
          ...current,
          queueState: 'queued', machineId: null, runtimeInstanceId: null,
          claimedAt: null, heartbeatAt: null, leaseExpiresAt: null,
          reconciliationState: 'recovered', cancellationRequested: false
        }
      };
    }
    const timestamp = now();
    const cancelled = job.status === 'cancelling';
    const terminalStatus = cancelled
      ? ((job.outputFileCount || 0) > 0 ? 'cancelled_with_partial_result' : 'cancelled')
      : 'failed';
    const message = cancelled
      ? 'Cancellation completed during restart reconciliation because the worker lease expired.'
      : 'Worker execution was interrupted and cannot be resumed safely; rerun the job when ready.';
    return {
      ...job,
      status: terminalStatus,
      completedAt: timestamp,
      ...(cancelled ? { cancelledAt: timestamp } : {}),
      finalWorkerSummary: message,
      ...(!cancelled ? {
        error: {
          code: 'WORKER_INTERRUPTED_BY_RESTART', category: 'internal', message,
          retryable: true, details: { previousMachineId: current.machineId || null, previousRuntimeInstanceId: current.runtimeInstanceId || null }
        }
      } : {}),
      statusEvents: appendEvent(job, {
        type: 'runtime_reconciled', createdAt: timestamp,
        machineId: identity.machineId, runtimeInstanceId: identity.runtimeInstanceId,
        previousMachineId: current.machineId || null,
        previousRuntimeInstanceId: current.runtimeInstanceId || null,
        finalStatus: terminalStatus
      }),
      queueRuntime: {
        ...current, queueState: 'terminal', heartbeatAt: timestamp, leaseExpiresAt: null,
        reconciliationState: 'recovered', cancellationRequested: Boolean(current.cancellationRequested)
      }
    };
  });
  if (!result.committed) return null;
  const job = result.snapshot;
  if (job.status === 'queued') {
    if (!knownJobIds.has(jobId)) {
      knownJobIds.add(jobId);
      queuedJobIds.push(jobId);
      workerStateService.createState(jobId, 'QUEUED');
    }
  } else {
    workerStateService.createState(jobId, job.status === 'failed' ? 'FAILED' : 'CANCELLED');
    await publishJobEvent(jobId, job.status === 'failed' ? JOB_EVENTS.JOB_FAILED : JOB_EVENTS.JOB_CANCELLED, {
      phase: job.status === 'failed' ? 'FAILED' : 'CANCELLED', status: job.status,
      message: job.finalWorkerSummary
    });
  }
  return job;
};

const reconcileQueue = async () => {
  const jobs = await Job.find({ status: { $in: Array.from(ACTIVE_STATUSES) } }).sort({ createdAt: 1 }).lean();
  for (const job of jobs) await reconcileInterruptedJob(job.jobId);
  scheduleDrain();
  return { inspectedCount: jobs.length, ...getQueueState() };
};

const initializeQueue = async () => {
  const result = await reconcileQueue();
  if (!reconciliationTimer) {
    reconciliationTimer = setInterval(() => {
      reconcileQueue().catch((error) => console.error(`Queue reconciliation failed: ${error.message}`));
    }, config.queue.reconciliationIntervalMs);
    reconciliationTimer.unref?.();
  }
  return result;
};

const shutdownQueue = async () => {
  if (reconciliationTimer) clearInterval(reconciliationTimer);
  reconciliationTimer = null;
  const timestamp = now();
  for (const jobId of Array.from(activeJobIds)) {
    stopLeaseHeartbeat(jobId);
    await transactJob(jobId, (job) => {
      const current = job.queueRuntime || {};
      if (!isOwnedByThisRuntime(current)) return undefined;
      return {
        ...job,
        queueRuntime: {
          ...current, heartbeatAt: timestamp, leaseExpiresAt: timestamp,
          reconciliationState: 'pending'
        }
      };
    }).catch(() => {});
  }
};

module.exports = {
  cancelQueuedJob,
  claimJob,
  drainQueue,
  enqueueJob,
  finalizeClaim,
  getJobOwnership,
  getQueueState,
  initializeQueue,
  isLeaseValid,
  reconcileQueue,
  renewLease,
  resolveJobAdapter,
  shutdownQueue
};
