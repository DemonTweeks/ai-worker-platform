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

const idempotencyReservations = new Map();

const normalizeWorkerId = (workerId) => {
  const normalized = String(workerId || WORKER_IDS.MW_PR).trim();
  return normalized || WORKER_IDS.MW_PR;
};

const normalizeBrowserTabSessionId = (browserTabSessionId) => {
  const normalized = String(browserTabSessionId || '').trim();

  if (!normalized) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'browserTabSessionId must be an 8-120 character browser-tab identifier.'
    );
  }

  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(normalized)) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'browserTabSessionId must be an 8-120 character browser-tab identifier.'
    );
  }

  return normalized;
};

const normalizeIdempotencyKey = (idempotencyKey) => {
  const normalized = String(idempotencyKey || '').trim();

  if (!normalized) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'idempotencyKey must be an 8-160 character logical-create identifier.'
    );
  }

  if (!/^[A-Za-z0-9:_-]{8,160}$/.test(normalized)) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'idempotencyKey must be an 8-160 character logical-create identifier.'
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

const findJobByIdempotency = async ({ workerId, idempotencyKey }) => {
  const jobs = await Job.find({
    workerId: normalizeWorkerId(workerId),
    idempotencyKey: normalizeIdempotencyKey(idempotencyKey)
  }).sort({ createdAt: -1 }).limit(1).lean();

  return Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null;
};

const buildIdempotencyReservationKey = ({ workerId, idempotencyKey }) => (
  `${normalizeWorkerId(workerId)}::${normalizeIdempotencyKey(idempotencyKey)}`
);

const withIdempotencyReservation = async ({ workerId, idempotencyKey }, operation) => {
  const reservationKey = buildIdempotencyReservationKey({ workerId, idempotencyKey });
  const inFlightReservation = idempotencyReservations.get(reservationKey);

  if (inFlightReservation) {
    await inFlightReservation.catch(() => {});
    return withIdempotencyReservation({ workerId, idempotencyKey }, operation);
  }

  let releaseReservation;
  const reservationPromise = new Promise((resolve) => {
    releaseReservation = resolve;
  });
  idempotencyReservations.set(reservationKey, reservationPromise);

  try {
    return await operation();
  } finally {
    idempotencyReservations.delete(reservationKey);
    releaseReservation();
  }
};

module.exports = {
  ACTIVE_JOB_STATUSES,
  CANCELLATION_REASON_LABELS,
  RUNNING_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  appendStatusEvent,
  buildCancellationMetadata,
  buildIdempotencyReservationKey,
  findJobByIdempotency,
  isActiveJobStatus,
  isTerminalJobStatus,
  normalizeBrowserTabSessionId,
  normalizeCancellationReason,
  normalizeIdempotencyKey,
  normalizeWorkerId,
  withIdempotencyReservation
};
