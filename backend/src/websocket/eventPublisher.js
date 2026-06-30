const { Job, JobFile, ReviewRequiredItem, WarningItem } = require('../models');
const workerStateService = require('../services/workerStateService');
const { buildProgressWording } = require('../llm/progressWordingService');
const subscriptionManager = require('./subscriptionManager');
const { JOB_EVENTS, MESSAGE_TYPES } = require('./messageTypes');

const statusByPhase = {
  QUEUED: 'queued',
  VALIDATION_STARTED: 'validating',
  VALIDATION_COMPLETED: 'validating',
  FILTERING_STARTED: 'filtering_sites',
  FILTERING_COMPLETED: 'filtering_sites',
  ASSET_LOADING_STARTED: 'loading_assets',
  ASSET_LOADING_COMPLETED: 'loading_assets',
  GENERATION_STARTED: 'generating',
  GENERATION_COMPLETED: 'generating',
  OUTPUT_COLLECTION_STARTED: 'exporting',
  OUTPUT_COLLECTION_COMPLETED: 'exporting',
  CANCELLING: 'cancelling',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const normalizeJobId = (jobId) => String(jobId || '').trim().toUpperCase();

const buildProgress = (state) => {
  if (!state) {
    return null;
  }

  return {
    processedRows: state.processedRows || 0,
    totalRows: state.totalRows || 0
  };
};

const getStatusForMessage = (job, state, fallbackStatus) => (
  fallbackStatus || (job && job.status) || (state && statusByPhase[state.phase]) || 'unknown'
);

const resolveJobRecord = async (jobId, jobOverride = null) => {
  if (jobOverride) {
    return jobOverride;
  }

  const query = Job.findOne({ jobId });
  return query && typeof query.lean === 'function' ? query.lean() : query;
};

const buildJobStateSnapshot = async (jobId, jobOverride = null) => {
  const normalizedJobId = normalizeJobId(jobId);
  const [job, fileCount, warningCount, reviewRequiredCount] = await Promise.all([
    resolveJobRecord(normalizedJobId, jobOverride),
    JobFile.countDocuments({ jobId: normalizedJobId }),
    WarningItem.countDocuments({ jobId: normalizedJobId }),
    ReviewRequiredItem.countDocuments({ jobId: normalizedJobId })
  ]);

  if (!job) {
    return null;
  }

  const state = workerStateService.getState(normalizedJobId);

  return {
    jobId: normalizedJobId,
    status: getStatusForMessage(job, state),
    phase: state ? state.phase : null,
    progress: buildProgress(state),
    heartbeatAt: state && state.heartbeat ? state.heartbeat.timestamp : null,
    updatedAt: state ? state.updatedAt : (job.completedAt || job.startedAt || job.createdAt),
    cancellationRequested: state ? state.cancellationRequested : false,
    summary: {
      requestedSiteCount: job.requestedSiteCount,
      matchedSiteCount: job.matchedSiteCount,
      unmatchedSiteCount: job.unmatchedSiteCount,
      outputFileCount: job.outputFileCount,
      reviewRequiredCount,
      warningCount,
      fileCount
    }
  };
};

const publishJobEvent = async (jobId, event, payload = {}) => {
  const normalizedJobId = normalizeJobId(jobId);
  const [job, state] = await Promise.all([
    resolveJobRecord(normalizedJobId),
    Promise.resolve(workerStateService.getState(normalizedJobId))
  ]);

  const message = {
    type: MESSAGE_TYPES.JOB_EVENT,
    event,
    jobId: normalizedJobId,
    timestamp: new Date().toISOString(),
    status: getStatusForMessage(job, state, payload.status),
    phase: payload.phase || (state && state.phase) || null,
    progress: payload.progress || buildProgress(state),
    message: payload.message,
    summary: payload.summary
  };

  const wording = await buildProgressWording({
    event,
    jobId: normalizedJobId,
    status: message.status,
    phase: message.phase,
    progress: message.progress,
    message: message.message
  }).catch(() => null);

  if (wording) {
    message.aiMessage = wording.aiMessage;
    message.messageSource = wording.messageSource;
    message.llmStatus = wording.llmStatus;
    if (wording.llmErrorCode) {
      message.llmErrorCode = wording.llmErrorCode;
    }
  }

  subscriptionManager.publishToJob(normalizedJobId, message);
  return message;
};

const publishHeartbeat = async (jobId) => {
  const normalizedJobId = normalizeJobId(jobId);
  const [job, state] = await Promise.all([
    resolveJobRecord(normalizedJobId),
    Promise.resolve(workerStateService.getState(normalizedJobId))
  ]);

  if (!state || !job) {
    return null;
  }

  const message = {
    type: MESSAGE_TYPES.JOB_HEARTBEAT,
    jobId: normalizedJobId,
    timestamp: new Date().toISOString(),
    status: getStatusForMessage(job, state),
    phase: state.phase,
    progress: buildProgress(state),
    heartbeatAt: state.heartbeat ? state.heartbeat.timestamp : null,
    updatedAt: state.updatedAt,
    message: state.heartbeat ? state.heartbeat.message : undefined
  };

  subscriptionManager.publishToJob(normalizedJobId, message);
  return message;
};

module.exports = {
  JOB_EVENTS,
  buildJobStateSnapshot,
  publishHeartbeat,
  publishJobEvent
};
