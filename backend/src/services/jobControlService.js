const { Job } = require('../models');
const { createApiError } = require('../utils/apiError');
const { WORKER_IDS } = require('../workers/workerTypes');

const RUNNING_JOB_STATUSES = [
  'validating',
  'filtering_sites',
  'loading_assets',
  'generating',
  'exporting',
  'waiting_for_user_input'
];

const ACTIVE_JOB_STATUSES = [
  'queued',
  'cancelling',
  ...RUNNING_JOB_STATUSES
];

const TERMINAL_JOB_STATUSES = [
  'completed',
  'completed_with_warning',
  'failed',
  'cancelled',
  'cancelled_with_partial_result'
];

const CANCELLATION_REASON_LABELS = {
  requested_by_user: 'Requested by user',
  wrong_inputs: 'Wrong inputs selected',
  started_by_mistake: 'Started by mistake',
  long_running: 'Taking too long',
  other: 'Other'
};

const submissionScopeReservations = new Set();

const normalizeWorkerId = (workerId) => {
  const normalized = String(workerId || WORKER_IDS.MW_PR).trim();
  return normalized || WORKER_IDS.MW_PR;
};

const normalizeSubmissionScopeId = (submissionScopeId) => {
  const normalized = String(submissionScopeId || '').trim();

  if (!normalized) {
    return '';
  }

  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(normalized)) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'submissionScopeId must be an 8-120 character session-scoped identifier.'
    );
  }

  return normalized;
};

const isTerminalJobStatus = (status) => TERMINAL_JOB_STATUSES.includes(String(status || '').trim().toLowerCase());
const isActiveJobStatus = (status) => ACTIVE_JOB_STATUSES.includes(String(status || '').trim().toLowerCase());

const normalizeCancellationReason = ({ reasonCode, reasonText } = {}) => {
  const normalizedCode = String(reasonCode || 'requested_by_user').trim().toLowerCase();
  const safeReasonCode = Object.prototype.hasOwnProperty.call(CANCELLATION_REASON_LABELS, normalizedCode)
    ? normalizedCode
    : 'requested_by_user';
  const normalizedText = String(reasonText || '').trim().replace(/\s+/g, ' ').slice(0, 160);

  return {
    reasonCode: safeReasonCode,
    reasonLabel: CANCELLATION_REASON_LABELS[safeReasonCode],
    reasonText: normalizedText
  };
};

const buildCancellationMetadata = ({
  job = {},
  requestedAt = new Date().toISOString(),
  completedAt = null,
  requestedBy = null,
  reasonCode,
  reasonLabel,
  reasonText,
  finalStatus = null
} = {}) => {
  const existing = job.cancellation || {};

  return {
    source: 'user',
    requestedAt: existing.requestedAt || requestedAt,
    requestedBy: existing.requestedBy || requestedBy || null,
    reasonCode: existing.reasonCode || reasonCode,
    reasonLabel: existing.reasonLabel || reasonLabel,
    reasonText: existing.reasonText || reasonText || '',
    completedAt: completedAt || existing.completedAt || null,
    finalStatus: finalStatus || existing.finalStatus || null
  };
};

const appendStatusEvent = (job = {}, type, payload = {}) => {
  const existingEvents = Array.isArray(job.statusEvents) ? [...job.statusEvents] : [];

  if (existingEvents.some((event) => event.type === type)) {
    return existingEvents;
  }

  existingEvents.push({
    type,
    createdAt: payload.createdAt || new Date().toISOString(),
    ...payload
  });

  return existingEvents;
};

const findActiveScopedJob = async ({ workerId, submissionScopeId }) => {
  const normalizedScopeId = normalizeSubmissionScopeId(submissionScopeId);

  if (!normalizedScopeId) {
    return null;
  }

  const jobs = await Job.find({
    workerId: normalizeWorkerId(workerId),
    submissionScopeId: normalizedScopeId,
    status: { $in: ACTIVE_JOB_STATUSES }
  }).sort({ createdAt: -1 }).limit(1).lean();

  return Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null;
};

const buildScopeReservationKey = ({ workerId, submissionScopeId }) => {
  const normalizedScopeId = normalizeSubmissionScopeId(submissionScopeId);

  if (!normalizedScopeId) {
    return '';
  }

  return `${normalizeWorkerId(workerId)}::${normalizedScopeId}`;
};

const assertNoActiveScopedJob = async ({ workerId, submissionScopeId }) => {
  const activeJob = await findActiveScopedJob({ workerId, submissionScopeId });

  if (!activeJob) {
    return null;
  }

  throw createApiError(
    409,
    'ACTIVE_JOB_EXISTS',
    'An active job already exists for this worker in the current browser session. Wait for it to finish or stop it before submitting again.',
    {
      jobId: activeJob.jobId,
      workerId: activeJob.workerId || normalizeWorkerId(workerId),
      status: activeJob.status
    }
  );
};

const withSubmissionScopeReservation = async ({ workerId, submissionScopeId }, operation) => {
  const reservationKey = buildScopeReservationKey({ workerId, submissionScopeId });

  if (!reservationKey) {
    return operation();
  }

  if (submissionScopeReservations.has(reservationKey)) {
    throw createApiError(
      409,
      'ACTIVE_JOB_EXISTS',
      'An active job already exists for this worker in the current browser session. Wait for it to finish or stop it before submitting again.',
      {
        workerId: normalizeWorkerId(workerId),
        status: 'reserving'
      }
    );
  }

  submissionScopeReservations.add(reservationKey);

  try {
    return await operation();
  } finally {
    submissionScopeReservations.delete(reservationKey);
  }
};

module.exports = {
  ACTIVE_JOB_STATUSES,
  CANCELLATION_REASON_LABELS,
  RUNNING_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  assertNoActiveScopedJob,
  appendStatusEvent,
  buildCancellationMetadata,
  buildScopeReservationKey,
  findActiveScopedJob,
  isActiveJobStatus,
  isTerminalJobStatus,
  normalizeCancellationReason,
  normalizeSubmissionScopeId,
  normalizeWorkerId,
  withSubmissionScopeReservation
};
