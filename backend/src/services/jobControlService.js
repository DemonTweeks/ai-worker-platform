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

module.exports = {
  ACTIVE_JOB_STATUSES,
  RUNNING_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  assertNoActiveScopedJob,
  findActiveScopedJob,
  isActiveJobStatus,
  isTerminalJobStatus,
  normalizeSubmissionScopeId,
  normalizeWorkerId
};
