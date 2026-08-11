const fs = require('fs');
const path = require('path');
const {
  Job,
  JobFile,
  ReviewRequiredItem,
  WarningItem
} = require('../models');
const storageService = require('./storageService');
const workerStateService = require('./workerStateService');
const jobQueue = require('../queue/jobQueue');
const { JOB_EVENTS, publishJobEvent } = require('../websocket/eventPublisher');
const { answerReAsk } = require('../llm/reAskService');
const { assertPathInsideRoot, toStorageRelativePath } = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');
const { sanitizeRanStageName } = require('../workers/ranFailureService');
const { WORKER_IDS } = require('../workers/workerTypes');
const {
  ENGINE_PIN_UNAPPROVED_CODE,
  ENGINE_PIN_UNAPPROVED_MESSAGE,
  ENGINE_PIN_UNAPPROVED_TITLE
} = require('../workers/prAuditorFailureService');
const { getWorkerManifest } = require('../workers/workerRegistry');
const { createSkillJob } = require('../skills/genericSkillJobService');
const {
  CANCELLATION_REASON_LABELS,
  RUNNING_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  appendStatusEvent,
  buildCancellationMetadata,
  normalizeBrowserTabSessionId,
  normalizeCancellationReason,
  normalizeIdempotencyKey,
  normalizeWorkerId
} = require('./jobControlService');

const CANCELLABLE_BEFORE_WORKER_STATUSES = ['queued'];
const PR_SCOPES = ['TSS', 'TI'];
const RESULT_RECONCILIATION_INCOMPLETE = 'RESULT_RECONCILIATION_INCOMPLETE';
const INPUT_FILE_TYPES = new Set([
  'uploaded_export',
  'ran_bom_upload',
  'ran_epms_upload',
  'pr_auditor_final_po_upload',
  'pr_auditor_epms_upload',
  'skill_input'
]);

const normalizePrScope = (prScope) => String(prScope || 'TSS').trim().toUpperCase();

const getWorkerPresentation = (job = {}) => {
  const workerId = job.workerId || WORKER_IDS.MW_PR;

  try {
    const manifest = getWorkerManifest(workerId);
    return {
      workerId,
      workerDisplayName: manifest.displayName,
      engineVersion: job.engineVersion || manifest.engineVersion || null,
      engineCommit: job.engineCommit || manifest.engineCommit || null
    };
  } catch (error) {
    return {
      workerId,
      workerDisplayName: workerId,
      engineVersion: job.engineVersion || null,
      engineCommit: job.engineCommit || null
    };
  }
};

const isRanWorker = (workerId) => workerId === WORKER_IDS.RAN_PR;
const isPrAuditorWorker = (workerId) => workerId === WORKER_IDS.PR_AUDITOR;
const getDisplayPrScope = (job = {}) => (
  (isRanWorker(job.workerId) || isPrAuditorWorker(job.workerId)) ? (job.prScope || null) : (job.prScope || 'TSS')
);

const redactTechnicalDetails = (text) => {
  if (!text || typeof text !== 'string') return '';

  let clean = text;
  clean = clean.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  const secretsRegex = /\b[a-zA-Z0-9_\-]*?(?:API_KEY|API\-KEY|APIKEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|BEARER)[a-zA-Z0-9_\-]*?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|Bearer\s+[^\s\r\n]+|Basic\s+[^\s\r\n]+|[^\s\r\n]+)/gi;
  clean = clean.replace(secretsRegex, '[redacted]');

  const uncRegex = /\\\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*(?:\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*)*(?:\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)?/g;
  clean = clean.replace(uncRegex, '[redacted]');

  const fileUrlRegex = /file:\/\/\/[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*(?:\/[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*)*(?:\/[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)?/gi;
  clean = clean.replace(fileUrlRegex, '[redacted]');

  const winPathRegex = /[a-zA-Z]:\\(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\\)*(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)/g;
  clean = clean.replace(winPathRegex, '[redacted]');

  const posixPathRegex = /\/(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\/)*(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)/g;
  clean = clean.replace(posixPathRegex, (match) => {
    if (match === '/api/health' || match === '/api/jobs' || match === '/history') {
      return match;
    }
    return '[redacted]';
  });

  const cmdArgValRegex = /(--[a-zA-Z0-9\-]+|-[a-zA-Z0-9])(?:\s+|=)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+(?:\s+[^\s\-\r\n]+)*)/gi;
  clean = clean.replace(cmdArgValRegex, '$1 [redacted]');

  return clean;
};

const knownCountOrNull = (value) => Number.isInteger(value) && value >= 0 ? value : null;

const getIncompleteResultMessage = (job = {}) => {
  const requested = knownCountOrNull(job.requestedSiteCount);
  const generated = knownCountOrNull(job.generatedSiteCount);
  const missing = knownCountOrNull(job.unaccountedSiteCount);

  if (requested !== null && generated !== null && missing !== null) {
    return `${generated} of ${requested} requested sites generated. ${missing} sites have no confirmed result.`;
  }
  if (requested !== null && generated !== null) {
    return `${generated} of ${requested} requested sites generated. The number of sites without confirmed result could not be determined.`;
  }
  return 'Result reconciliation could not be completed. The number of sites without confirmed result could not be determined.';
};

const getFailureSummary = (job) => {
  if (job.status !== 'failed') return null;
  const error = job.error;
  if (!error) {
    if (job.workerId === WORKER_IDS.PR_AUDITOR) return 'PR Auditor execution failed.';
    if (job.workerId === WORKER_IDS.RAN_PR) return 'RAN PR Worker execution failed.';
    return 'PR Worker execution failed.';
  }

  const code = error.code;
  const details = error.details || {};
  const ranStage = sanitizeRanStageName(details.stage);
  const isRanJob = job.workerId === WORKER_IDS.RAN_PR;
  const isPrAuditorJob = job.workerId === WORKER_IDS.PR_AUDITOR;

  if (code === RESULT_RECONCILIATION_INCOMPLETE) {
    return getIncompleteResultMessage(job);
  }

  if (isPrAuditorJob && code === ENGINE_PIN_UNAPPROVED_CODE) {
    return ENGINE_PIN_UNAPPROVED_MESSAGE;
  }

  if (code === 'PREFLIGHT_FAILED') {
    const allowedPkgs = ['pandas', 'openpyxl'];
    let validPkgs = [];
    if (Array.isArray(details.missingPackages)) {
      validPkgs = details.missingPackages.filter(p => allowedPkgs.includes(p));
    }
    if (validPkgs.length > 0) {
      return `Dependency missing: ${validPkgs.join(', ')}`;
    }
    return 'PR worker dependency check failed.';
  } else if (code === 'WORKER_TIMEOUT') {
    if (isPrAuditorJob) return 'PR Auditor execution timed out.';
    if (isRanJob) return ranStage ? `RAN PR worker execution timed out (${ranStage}).` : 'RAN PR worker execution timed out.';
    if (details.scope === 'TSS' || details.scope === 'TI') return `PR worker execution timed out (${details.scope}).`;
    return 'PR worker execution timed out.';
  } else if (code === 'WORKER_PROCESS_FAILED') {
    if (isPrAuditorJob) return 'PR Auditor process failed.';
    if (isRanJob) return ranStage ? `RAN PR worker process failed (${ranStage}).` : 'RAN PR worker process failed.';
    if (details.scope === 'TSS' || details.scope === 'TI') return `PR worker process failed (${details.scope}).`;
    return 'PR worker process failed.';
  } else if (code === 'RAN_INVALID_ECC_OUTPUT' || code === 'RAN_ZERO_VALID_ECC_OUTPUT') {
    return 'RAN PR worker produced no valid ECC output.';
  }
  if (isPrAuditorJob) return 'PR Auditor execution failed.';
  if (isRanJob) return 'RAN PR Worker execution failed.';
  return 'PR Worker execution failed.';
};

const getFailureDiagnosis = (job) => {
  if (job.status !== 'failed') return undefined;
  const error = job.error;
  if (!error) {
    const isPrAuditorJob = job.workerId === WORKER_IDS.PR_AUDITOR;
    const isRanJob = job.workerId === WORKER_IDS.RAN_PR;
    return {
      category: 'WORKER_ERROR',
      title: isPrAuditorJob ? 'PR Auditor execution failed' : isRanJob ? 'RAN PR Worker execution failed' : 'PR Worker execution failed',
      summary: isPrAuditorJob
        ? 'An unexpected error occurred during the PR Auditor execution process.'
        : isRanJob
        ? 'An unexpected error occurred during the RAN PR worker execution process.'
        : 'An unexpected error occurred during the PR worker execution process.',
      technicalDetails: ''
    };
  }

  const code = error.code || 'WORKER_ERROR';
  const details = error.details || {};
  const ranStage = sanitizeRanStageName(details.stage);
  const isRanJob = job.workerId === WORKER_IDS.RAN_PR;
  const isPrAuditorJob = job.workerId === WORKER_IDS.PR_AUDITOR;

  const allowedCategories = [
    'PREFLIGHT_FAILED',
    'WORKER_TIMEOUT',
    'WORKER_PROCESS_FAILED',
    'RAN_INVALID_ECC_OUTPUT',
    'RAN_ZERO_VALID_ECC_OUTPUT',
    RESULT_RECONCILIATION_INCOMPLETE
  ];
  if (isPrAuditorJob) allowedCategories.push(ENGINE_PIN_UNAPPROVED_CODE);
  const category = allowedCategories.includes(code) ? code : 'WORKER_ERROR';

  let title = isPrAuditorJob ? 'PR Auditor execution failed' : isRanJob ? 'RAN PR Worker execution failed' : 'PR Worker execution failed';
  let summary = isPrAuditorJob
    ? 'An unexpected error occurred during the PR Auditor execution process.'
    : isRanJob
      ? 'An unexpected error occurred during the RAN PR worker execution process.'
      : 'An unexpected error occurred during the PR worker execution process.';
  let missingPackages;
  let pythonExecutable;
  let recommendedCommand;
  let scope;
  let exitCode;

  const rawStderr = typeof details.stderr === 'string' ? details.stderr : '';
  const technicalDetails = (category === ENGINE_PIN_UNAPPROVED_CODE || category === RESULT_RECONCILIATION_INCOMPLETE)
    ? ''
    : redactTechnicalDetails(rawStderr).slice(-2000);

  if (category === RESULT_RECONCILIATION_INCOMPLETE) {
    title = 'Incomplete Result';
    summary = getIncompleteResultMessage(job);
  } else if (category === ENGINE_PIN_UNAPPROVED_CODE && isPrAuditorJob) {
    title = ENGINE_PIN_UNAPPROVED_TITLE;
    summary = ENGINE_PIN_UNAPPROVED_MESSAGE;
  } else if (category === 'PREFLIGHT_FAILED') {
    title = 'Python worker dependency missing';
    summary = 'PR worker preflight check failed because some required Python packages are not installed in the environment.';

    const allowedPkgs = ['pandas', 'openpyxl'];
    if (Array.isArray(details.missingPackages)) {
      const filtered = details.missingPackages.filter(p => allowedPkgs.includes(p));
      if (filtered.length > 0) missingPackages = filtered;
    }

    if (typeof details.pythonExecutable === 'string') {
      const cleanPython = details.pythonExecutable.replace(/[\r\n\t]/g, '').replace(/["']/g, '').trim();
      if (cleanPython.length > 0) {
        pythonExecutable = cleanPython.slice(0, 200);
        recommendedCommand = `"${pythonExecutable}" -m pip install -r requirements-worker.txt`;
      }
    }
  } else if (category === 'WORKER_TIMEOUT') {
    title = 'Worker timeout';
    summary = isPrAuditorJob
      ? 'PR Auditor execution exceeded the maximum allowed time limit.'
      : isRanJob
      ? `RAN PR worker execution exceeded the maximum allowed time limit${ranStage ? ` while running ${ranStage}` : ''}.`
      : 'PR worker execution exceeded the maximum allowed time limit.';
    if (!isPrAuditorJob && !isRanJob && (details.scope === 'TSS' || details.scope === 'TI')) scope = details.scope;
  } else if (category === 'WORKER_PROCESS_FAILED') {
    title = 'Worker process failed';
    summary = isPrAuditorJob
      ? 'PR Auditor child process exited with an error status during execution.'
      : isRanJob
      ? `RAN PR worker stage failed${ranStage ? ` while running ${ranStage}` : ''}.`
      : 'PR worker child process exited with an error status during execution.';
    if (!isPrAuditorJob && !isRanJob && (details.scope === 'TSS' || details.scope === 'TI')) scope = details.scope;
    if (Number.isInteger(details.exitCode)) exitCode = details.exitCode;
  } else if (category === 'RAN_INVALID_ECC_OUTPUT' || category === 'RAN_ZERO_VALID_ECC_OUTPUT') {
    title = 'RAN ECC output invalid';
    summary = 'The RAN PR worker completed its pipeline, but it did not produce any valid ECC workbook output for delivery.';
  }

  return {
    category,
    title,
    summary,
    missingPackages,
    pythonExecutable,
    recommendedCommand,
    scope,
    ...(ranStage ? { stage: ranStage } : {}),
    exitCode,
    technicalDetails
  };
};

const serializeSafeError = (job = {}) => {
  if (job.status !== 'failed' || !job.error) return null;
  const rawCode = String(job.error.code || 'WORKER_ERROR').trim();
  const code = /^[A-Z0-9_]+$/.test(rawCode) ? rawCode.slice(0, 120) : 'WORKER_ERROR';
  const diagnosis = getFailureDiagnosis(job) || {};
  const details = {
    ...(diagnosis.scope ? { scope: diagnosis.scope } : {}),
    ...(diagnosis.stage ? { stage: diagnosis.stage } : {}),
    ...(Number.isInteger(diagnosis.exitCode) ? { exitCode: diagnosis.exitCode } : {}),
    ...(Array.isArray(diagnosis.missingPackages) ? { missingPackages: diagnosis.missingPackages } : {}),
    ...(diagnosis.technicalDetails ? { technicalDetails: diagnosis.technicalDetails } : {})
  };

  if (code === RESULT_RECONCILIATION_INCOMPLETE) {
    Object.assign(details, {
      requestedSiteCount: knownCountOrNull(job.requestedSiteCount),
      generatedSiteCount: knownCountOrNull(job.generatedSiteCount),
      reviewRequiredSiteCount: knownCountOrNull(job.reviewRequiredSiteCount),
      approvedIgnoredSiteCount: knownCountOrNull(job.approvedIgnoredSiteCount),
      duplicateBlockedSiteCount: knownCountOrNull(job.duplicateBlockedSiteCount),
      failedSiteCount: knownCountOrNull(job.failedSiteCount),
      sitesWithoutConfirmedResultCount: knownCountOrNull(job.unaccountedSiteCount)
    });
  }

  return {
    code,
    category: code === RESULT_RECONCILIATION_INCOMPLETE ? 'RESULT_INCOMPLETE' : (diagnosis.category || 'WORKER_ERROR'),
    title: diagnosis.title || 'Worker execution failed',
    message: getFailureSummary(job) || diagnosis.summary || 'Worker execution failed.',
    details
  };
};

const serializeCancellation = (job = {}) => {
  if (!job.cancellation) return null;
  return {
    source: job.cancellation.source || 'user',
    requestedAt: job.cancellation.requestedAt || null,
    requestedBy: job.cancellation.requestedBy || null,
    reasonCode: job.cancellation.reasonCode || 'requested_by_user',
    reasonLabel: job.cancellation.reasonLabel || CANCELLATION_REASON_LABELS.requested_by_user,
    reasonText: job.cancellation.reasonText || '',
    completedAt: job.cancellation.completedAt || null,
    finalStatus: job.cancellation.finalStatus || null
  };
};

const serializeJobSummary = (job) => ({
  ...getWorkerPresentation(job),
  jobId: job.jobId,
  workerType: job.workerType,
  status: job.status,
  resultStatus: job.status === 'failed' && job.error && job.error.code === RESULT_RECONCILIATION_INCOMPLETE ? 'incomplete_result' : null,
  error: serializeSafeError(job),
  createdAt: job.createdAt,
  completedAt: job.completedAt,
  generationScope: job.generationScope,
  prScope: getDisplayPrScope(job),
  runMode: job.runMode || null,
  selectedProject: job.selectedProject || null,
  requestedSiteCount: job.requestedSiteCount,
  matchedSiteCount: job.matchedSiteCount,
  matchedSiteCodes: Array.isArray(job.matchedSiteCodes) ? job.matchedSiteCodes : [],
  unmatchedSiteCount: job.unmatchedSiteCount,
  outputFileCount: job.outputFileCount,
  reviewRequiredCount: job.reviewRequiredCount,
  warningCount: job.warningCount,
  generatedSiteCount: job.generatedSiteCount ?? null,
  reviewRequiredSiteCount: job.reviewRequiredSiteCount ?? null,
  approvedIgnoredSiteCount: job.approvedIgnoredSiteCount ?? null,
  duplicateBlockedSiteCount: job.duplicateBlockedSiteCount ?? null,
  failedSiteCount: job.failedSiteCount ?? null,
  accountedSiteCount: job.accountedSiteCount ?? null,
  unaccountedSiteCount: job.unaccountedSiteCount ?? null,
  reconciliationConsistent: job.reconciliationConsistent ?? null,
  auditSummary: job.auditSummary || null,
  auditYear: job.auditYear || null,
  auditMonth: job.auditMonth || null,
  finalWorkerSummary: job.finalWorkerSummary,
  browserTabSessionId: job.browserTabSessionId || null,
  idempotencyKey: job.idempotencyKey || null,
  cancellation: serializeCancellation(job),
  failureSummary: getFailureSummary(job)
});

const assertJobExists = async (jobId) => {
  const job = await Job.findOne({ jobId });
  if (!job) throw createApiError(404, 'JOB_NOT_FOUND', 'Job was not found.');
  return job;
};

const createJob = async () => {
  throw createApiError(
    410,
    'LEGACY_JOB_CREATION_RETIRED',
    'Legacy job creation has been retired. Submit the approved package through /api/skills/:skillId/jobs.'
  );
};

const rerunJob = async (sourceJobId, { browserTabSessionId } = {}) => {
  const sourceJob = await assertJobExists(sourceJobId);
  if (sourceJob.workerType !== 'skill' || !sourceJob.skillId) {
    throw createApiError(
      409,
      'LEGACY_RERUN_REQUIRES_NEW_REQUEST',
      'This historical job used a retired worker contract. Download its retained files and submit a new request through the matching approved skill.'
    );
  }
  const trackedInputs = await JobFile.find({ jobId: sourceJobId, fileType: 'skill_input' }).sort({ createdAt: 1 }).lean();
  if (trackedInputs.length === 0) {
    throw createApiError(409, 'RERUN_INPUTS_UNAVAILABLE', 'This job cannot be rerun because its original input files are unavailable.');
  }
  const files = [];
  for (const file of trackedInputs) {
    let absolutePath;
    try {
      absolutePath = (await resolveTrackedFilePath(file)).absolutePath;
    } catch (_error) {
      throw createApiError(409, 'RERUN_INPUTS_UNAVAILABLE', 'This job cannot be rerun because one or more original input files are unavailable.');
    }
    const buffer = await fs.promises.readFile(absolutePath);
    files.push({
      fieldname: file.inputName,
      originalname: file.fileName,
      size: buffer.length,
      buffer
    });
  }
  const result = await createSkillJob(sourceJob.skillId, {
    browserTabSessionId: normalizeBrowserTabSessionId(browserTabSessionId || sourceJob.browserTabSessionId),
    idempotencyKey: `rerun-${sourceJobId}-${Date.now()}`,
    parameters: JSON.stringify(sourceJob.parameters || {})
  }, files);
  await Job.updateOne({ jobId: result.job.jobId }, { $set: { rerunSourceJobId: sourceJobId } });
  result.job.rerunSourceJobId = sourceJobId;
  result.message = `Job ${sourceJobId} was recreated through the approved ${sourceJob.skillId} contract.`;
  return result;
};

const buildListFilter = async (query) => {
  const filter = {};
  if (query.workerId) filter.workerId = normalizeWorkerId(query.workerId);
  if (query.workerType) filter.workerType = query.workerType;
  if (query.browserTabSessionId) filter.browserTabSessionId = normalizeBrowserTabSessionId(query.browserTabSessionId);
  if (query.idempotencyKey) filter.idempotencyKey = normalizeIdempotencyKey(query.idempotencyKey);
  if (query.status) filter.status = query.status;
  if (query.prScope) {
    const normalizedPrScope = normalizePrScope(query.prScope);
    if (PR_SCOPES.includes(normalizedPrScope)) filter.prScope = normalizedPrScope;
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }
  const search = String(query.search || '').trim();
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    const fileMatches = await JobFile.find({ fileName: searchRegex }).select({ jobId: 1 }).lean();
    const matchedJobIds = fileMatches.map((file) => file.jobId);
    filter.$or = [{ jobId: searchRegex }, { jobId: { $in: matchedJobIds } }];
  }
  return filter;
};

const listJobs = async (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;
  const filter = await buildListFilter(query);
  const [items, total] = await Promise.all([Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Job.countDocuments(filter)]);
  return { page, limit, total, items: items.map(serializeJobSummary) };
};

const isExpired = (file) => Boolean(file.isExpired) || (file.retentionUntil && new Date(file.retentionUntil).getTime() < Date.now());

const getFileAvailability = async (file) => {
  const absolutePath = assertPathInsideRoot(storageService.getStorageRoot(), path.join(storageService.getStorageRoot(), file.filePath));
  const expired = isExpired(file);
  const exists = fs.existsSync(absolutePath);
  const unavailableByCleanup = Boolean(file.deletedAt || file.fileAvailable === false);
  return { id: file._id.toString(), fileType: file.fileType, fileName: file.fileName, fileSize: file.fileSize, createdAt: file.createdAt, retentionUntil: file.retentionUntil, isExpired: Boolean(file.isExpired), expiredAt: file.expiredAt, deletedAt: file.deletedAt, fileAvailable: file.fileAvailable !== false, cleanupReason: file.cleanupReason, available: exists && !expired && !unavailableByCleanup, expired, exists, unavailableReason: expired ? 'retention_expired' : unavailableByCleanup ? (file.cleanupReason || 'cleanup_removed') : exists ? null : 'file_missing' };
};

const getJobDetail = async (jobId) => {
  const job = await assertJobExists(jobId);
  const [files, reviewRequiredItems, warnings] = await Promise.all([JobFile.find({ jobId }).sort({ createdAt: 1 }).lean(), ReviewRequiredItem.find({ jobId }).sort({ createdAt: 1 }).lean(), WarningItem.find({ jobId }).sort({ createdAt: 1 }).lean()]);
  const filesWithAvailability = await Promise.all(files.map(getFileAvailability));
  return {
    job: { ...serializeJobSummary(job), startedAt: job.startedAt, cancelledAt: job.cancelledAt, statusEvents: Array.isArray(job.statusEvents) ? job.statusEvents : [], prScope: getDisplayPrScope(job), assetVersions: job.assetVersions || {}, fileRetentionUntil: job.fileRetentionUntil, failureDiagnosis: getFailureDiagnosis(job) },
    workerState: workerStateService.getState(jobId),
    finalWorkerSummary: job.finalWorkerSummary,
    outputs: filesWithAvailability.filter((file) => !INPUT_FILE_TYPES.has(file.fileType)),
    files: filesWithAvailability,
    reviewRequiredItems,
    warnings,
    assetVersions: job.assetVersions || {}
  };
};

const resolveRequestedBy = (requestContext = {}) => {
  const requestedBy = requestContext.requestedBy;
  return typeof requestedBy === 'string' && requestedBy.trim() ? requestedBy.trim().slice(0, 120) : null;
};

const cancelJob = async (jobId, cancellationRequest = {}, requestContext = {}) => {
  const job = await assertJobExists(jobId);
  const requestedBy = resolveRequestedBy(requestContext);
  const reason = normalizeCancellationReason(cancellationRequest);
  const requestedAt = new Date().toISOString();
  if (TERMINAL_JOB_STATUSES.includes(job.status)) return { job: serializeJobSummary(job), message: 'Job cancellation has already been recorded.' };
  job.cancellation = buildCancellationMetadata({ job, requestedAt, requestedBy, ...reason });
  job.statusEvents = appendStatusEvent(job, 'cancellation_requested', { createdAt: requestedAt, requestedBy, reasonCode: reason.reasonCode, reasonLabel: reason.reasonLabel, reasonText: reason.reasonText });
  const queueCancelResult = await jobQueue.cancelQueuedJob(jobId);
  if (queueCancelResult.queueRuntime) job.queueRuntime = queueCancelResult.queueRuntime;
  if (queueCancelResult.cancelled) {
    const cancelledAt = new Date();
    job.status = 'cancelled';
    job.cancelledAt = cancelledAt;
    job.completedAt = cancelledAt;
    job.finalWorkerSummary = 'Task cancelled. Any completed partial output files have been preserved where available.';
    job.cancellation = buildCancellationMetadata({ job, requestedAt, requestedBy, completedAt: cancelledAt.toISOString(), finalStatus: 'cancelled', ...reason });
    job.statusEvents = appendStatusEvent(job, 'cancellation_completed', { createdAt: cancelledAt.toISOString(), requestedBy: job.cancellation.requestedBy, reasonCode: job.cancellation.reasonCode, reasonLabel: job.cancellation.reasonLabel, reasonText: job.cancellation.reasonText, finalStatus: 'cancelled' });
    await job.save();
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, { phase: 'CANCELLED', status: 'cancelled', message: 'Queued job cancelled before execution.' });
    const cancelledJob = await Job.findOne({ jobId });
    return { job: serializeJobSummary(cancelledJob), message: 'Queued job cancelled. Existing files are preserved.' };
  }
  if (queueCancelResult.running) {
    job.status = 'cancelling';
    await job.save();
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLATION_REQUESTED, { phase: 'CANCELLING', status: 'cancelling', message: 'Cancellation requested. The running worker will stop at the next safe checkpoint.' });
    return { job: serializeJobSummary(job), message: queueCancelResult.alreadyRequested ? 'Cancellation is already in progress for this job.' : 'Cancellation requested. The running worker will stop at the next safe checkpoint.' };
  }
  if (RUNNING_JOB_STATUSES.includes(job.status) || job.status === 'cancelling') {
    const cancelledAt = new Date();
    const finalStatus = (job.outputFileCount || 0) > 0 ? 'cancelled_with_partial_result' : 'cancelled';
    const orphanResolutionMessage = 'Cancellation completed after runtime ownership was lost; no live worker process was found.';
    job.status = finalStatus;
    job.cancelledAt = cancelledAt;
    job.completedAt = cancelledAt;
    job.finalWorkerSummary = orphanResolutionMessage;
    job.cancellation = buildCancellationMetadata({ job, requestedAt, requestedBy, completedAt: cancelledAt.toISOString(), finalStatus, ...reason });
    job.statusEvents = appendStatusEvent(job, 'cancellation_completed', { createdAt: cancelledAt.toISOString(), requestedBy: job.cancellation.requestedBy, reasonCode: job.cancellation.reasonCode, reasonLabel: job.cancellation.reasonLabel, reasonText: job.cancellation.reasonText, finalStatus });
    await job.save();
    workerStateService.setCancelled(jobId, orphanResolutionMessage);
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, { phase: 'CANCELLED', status: finalStatus, message: orphanResolutionMessage });
    return { job: serializeJobSummary(job), message: orphanResolutionMessage };
  }
  if (!CANCELLABLE_BEFORE_WORKER_STATUSES.includes(job.status)) throw createApiError(409, 'JOB_NOT_CANCELLABLE', `Job status ${job.status} cannot be cancelled by this layer.`);
  job.status = 'cancelled';
  job.cancelledAt = new Date();
  job.finalWorkerSummary = 'Task cancelled. Any completed partial output files have been preserved where available.';
  await job.save();
  return { job: serializeJobSummary(job), message: 'Queued job cancelled. Existing files are preserved.' };
};

const buildStructuredJobData = async (jobId) => {
  const detail = await getJobDetail(jobId);
  return { job: detail.job, warnings: detail.warnings, reviewRequiredItems: detail.reviewRequiredItems, assetVersions: detail.assetVersions, files: detail.files.map((file) => ({ id: file.id, fileType: file.fileType, fileName: file.fileName, fileSize: file.fileSize, available: file.available, expired: file.expired, deletedAt: file.deletedAt, cleanupReason: file.cleanupReason, unavailableReason: file.unavailableReason })) };
};

const askJob = async (jobId, question) => answerReAsk(jobId, question);

const ensureObjectId = (fileId) => {
  if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') throw createApiError(400, 'VALIDATION_ERROR', 'fileId is invalid.');
};

const getFileByJob = async (jobId, fileId) => {
  await assertJobExists(jobId);
  ensureObjectId(fileId);
  const file = await JobFile.findById(fileId);
  if (!file || file.jobId !== jobId) throw createApiError(404, 'FILE_NOT_FOUND', 'File was not found for this job.');
  return file;
};

const resolveTrackedFilePath = async (file) => {
  if (isExpired(file) || file.deletedAt || file.fileAvailable === false) throw createApiError(410, 'FILE_EXPIRED', 'File Expired.');
  const absolutePath = assertPathInsideRoot(storageService.getStorageRoot(), path.join(storageService.getStorageRoot(), file.filePath));
  try { await fs.promises.access(absolutePath, fs.constants.R_OK); } catch (error) { throw createApiError(404, 'FILE_NOT_AVAILABLE', 'Tracked file is not available on local storage.'); }
  return { absolutePath, relativePath: toStorageRelativePath(storageService.getStorageRoot(), absolutePath) };
};

const getDownloadFile = async (jobId, fileId) => {
  const file = await getFileByJob(jobId, fileId);
  const resolved = await resolveTrackedFilePath(file);
  return { file, absolutePath: resolved.absolutePath };
};

const getZipDownloadFile = async (jobId) => {
  await assertJobExists(jobId);
  const zipFile = await JobFile.findOne({ jobId, fileType: 'zip_package' }).sort({ createdAt: -1 });
  if (!zipFile) throw createApiError(501, 'ZIP_NOT_READY', 'ZIP package generation belongs to the output/report layer and is not available in EPIC 3.');
  const resolved = await resolveTrackedFilePath(zipFile);
  return { file: zipFile, absolutePath: resolved.absolutePath };
};

module.exports = {
  askJob,
  cancelJob,
  createJob,
  getDownloadFile,
  getJobDetail,
  getZipDownloadFile,
  listJobs,
  rerunJob,
  serializeJobSummary
};
