const path = require('path');
const { Job, JobFile, ReviewRequiredItem, WarningItem } = require('../models');
const workerStateService = require('./workerStateService');
const { sanitizePrAuditorError } = require('../workers/prAuditorFailureService');
const INPUT_FILE_TYPES = new Set(['uploaded_export', 'ran_bom_upload', 'ran_epms_upload']);
const RESULT_RECONCILIATION_INCOMPLETE = 'RESULT_RECONCILIATION_INCOMPLETE';

const serializeFile = (file) => ({
  id: file._id.toString(),
  fileType: file.fileType,
  fileName: path.basename(file.fileName),
  fileSize: file.fileSize,
  retentionUntil: file.retentionUntil,
  createdAt: file.createdAt
});

const safeCode = (value) => {
  const code = String(value || 'WORKER_ERROR').trim();
  return /^[A-Z0-9_]+$/.test(code) ? code.slice(0, 120) : 'WORKER_ERROR';
};

const safeScope = (value) => (
  value === 'TSS' || value === 'TI' ? value : undefined
);

const safeStage = (value) => {
  const stage = String(value || '').trim();
  return /^[A-Za-z0-9 _-]{1,80}$/.test(stage) ? stage : undefined;
};

const knownCountOrNull = (value) => Number.isInteger(value) && value >= 0 ? value : null;

const buildIncompleteResultMessage = (job) => {
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

const sanitizeWorkerErrorForLlm = (job) => {
  if (!job.error) return null;
  if (job.error.code === 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED') {
    return sanitizePrAuditorError(job.error);
  }

  const code = safeCode(job.error.code);
  const rawDetails = job.error.details && typeof job.error.details === 'object'
    ? job.error.details
    : {};
  const details = {};
  const scope = safeScope(rawDetails.scope);
  const stage = safeStage(rawDetails.stage);
  if (scope) details.scope = scope;
  if (stage) details.stage = stage;
  if (Number.isInteger(rawDetails.exitCode)) details.exitCode = rawDetails.exitCode;
  if (Array.isArray(rawDetails.missingPackages)) {
    const packages = rawDetails.missingPackages
      .filter((value) => value === 'pandas' || value === 'openpyxl')
      .slice(0, 10);
    if (packages.length > 0) details.missingPackages = packages;
  }

  let message = 'Worker execution failed.';
  let category = code;
  let title = 'Worker execution failed';

  if (code === RESULT_RECONCILIATION_INCOMPLETE) {
    category = 'RESULT_INCOMPLETE';
    title = 'Incomplete Result';
    message = buildIncompleteResultMessage(job);
    Object.assign(details, {
      requestedSiteCount: knownCountOrNull(job.requestedSiteCount),
      generatedSiteCount: knownCountOrNull(job.generatedSiteCount),
      reviewRequiredSiteCount: knownCountOrNull(job.reviewRequiredSiteCount),
      approvedIgnoredSiteCount: knownCountOrNull(job.approvedIgnoredSiteCount),
      duplicateBlockedSiteCount: knownCountOrNull(job.duplicateBlockedSiteCount),
      failedSiteCount: knownCountOrNull(job.failedSiteCount),
      sitesWithoutConfirmedResultCount: knownCountOrNull(job.unaccountedSiteCount)
    });
  } else if (code === 'WORKER_TIMEOUT') {
    title = 'Worker timeout';
    message = scope ? `Worker execution timed out (${scope}).` : 'Worker execution timed out.';
  } else if (code === 'WORKER_PROCESS_FAILED') {
    title = 'Worker process failed';
    message = scope ? `Worker process failed (${scope}).` : 'Worker process failed.';
  } else if (code === 'PREFLIGHT_FAILED') {
    title = 'Worker dependency check failed';
    message = 'Worker dependency check failed.';
  } else if (code === 'RAN_INVALID_ECC_OUTPUT' || code === 'RAN_ZERO_VALID_ECC_OUTPUT') {
    title = 'RAN ECC output invalid';
    message = 'The RAN PR worker did not produce valid ECC output.';
  }

  return { code, category, title, message, details };
};

const buildSafeJobContext = async (jobId) => {
  const [job, files, warnings, reviewRequiredItems] = await Promise.all([
    Job.findOne({ jobId }).lean(),
    JobFile.find({ jobId }).sort({ createdAt: 1 }).lean(),
    WarningItem.find({ jobId }).sort({ createdAt: 1 }).limit(200).lean(),
    ReviewRequiredItem.find({ jobId }).sort({ createdAt: 1 }).limit(200).lean()
  ]);

  if (!job) return null;

  const summary = {
    requestedSiteCount: job.requestedSiteCount,
    matchedSiteCount: job.matchedSiteCount,
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
    reconciliationConsistent: job.reconciliationConsistent ?? null
  };
  const safeJobError = sanitizeWorkerErrorForLlm(job);

  return {
    job: {
      jobId: job.jobId,
      workerType: job.workerType,
      status: job.status,
      resultStatus: job.status === 'failed' && safeJobError && safeJobError.code === RESULT_RECONCILIATION_INCOMPLETE
        ? 'incomplete_result'
        : null,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      generationScope: job.generationScope,
      finalWorkerSummary: job.finalWorkerSummary,
      assetVersions: job.assetVersions || {},
      error: safeJobError
    },
    workerState: workerStateService.getState(jobId),
    summary,
    warnings: warnings.map((warning) => ({
      warningType: warning.warningType,
      siteCode: warning.siteCode,
      description: warning.description,
      sourceRow: warning.sourceRow,
      createdAt: warning.createdAt
    })),
    reviewRequiredItems: reviewRequiredItems.map((item) => ({
      siteCode: item.siteCode,
      sourceRow: item.sourceRow,
      scope: item.scope,
      subcon: item.subcon,
      issueType: item.issueType,
      description: item.description,
      severity: item.severity,
      createdAt: item.createdAt
    })),
    outputs: files.filter((file) => !INPUT_FILE_TYPES.has(file.fileType)).map(serializeFile),
    files: files.map(serializeFile)
  };
};

module.exports = {
  buildSafeJobContext,
  sanitizeWorkerErrorForLlm
};