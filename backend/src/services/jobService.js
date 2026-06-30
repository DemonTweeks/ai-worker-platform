const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const {
  Job,
  JobFile,
  ReviewRequiredItem,
  WarningItem
} = require('../models');
const storageService = require('./storageService');
const { consumePrevalidatedUpload, UPLOAD_KINDS } = require('./prevalidationService');
const { parseSiteCodes } = require('./siteCodeParser');
const workerStateService = require('./workerStateService');
const jobQueue = require('../queue/jobQueue');
const { JOB_EVENTS, publishJobEvent } = require('../websocket/eventPublisher');
const { answerReAsk } = require('../llm/reAskService');
const { generateUniqueJobId } = require('../utils/jobIdGenerator');
const { assertPathInsideRoot, toStorageRelativePath } = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');
const { sanitizeRanStageName } = require('../workers/ranFailureService');
const { validateRanRunConfiguration } = require('../workers/ranProjectCatalogService');
const { WORKER_IDS } = require('../workers/workerTypes');
const { getWorkerManifest } = require('../workers/workerRegistry');
const {
  CANCELLATION_REASON_LABELS,
  RUNNING_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  appendStatusEvent,
  buildCancellationMetadata,
  findJobByIdempotency,
  normalizeBrowserTabSessionId,
  normalizeCancellationReason,
  normalizeIdempotencyKey,
  normalizeWorkerId,
  withIdempotencyReservation
} = require('./jobControlService');

const CANCELLABLE_BEFORE_WORKER_STATUSES = ['queued'];
const PR_SCOPES = ['TSS', 'TI'];
const INPUT_FILE_TYPES = new Set(['uploaded_export', 'ran_bom_upload', 'ran_epms_upload']);

const normalizeSiteCodes = (siteCodes = []) => parseSiteCodes(siteCodes).siteCodes;

const normalizePrScope = (prScope) => String(prScope || 'TSS').trim().toUpperCase();
const addRetentionDays = () => (
  new Date(Date.now() + config.limits.fileRetentionDays * 24 * 60 * 60 * 1000)
);

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
const getDisplayPrScope = (job = {}) => (
  isRanWorker(job.workerId) ? (job.prScope || null) : (job.prScope || 'TSS')
);

const assertUploadKind = (upload, expectedKind, label) => {
  if (!upload || upload.uploadKind !== expectedKind) {
    throw createApiError(400, 'VALIDATION_ERROR', `${label} prevalidated file is invalid or expired.`);
  }
};

const redactTechnicalDetails = (text) => {
  if (!text || typeof text !== 'string') return '';

  let clean = text;

  // 1. Remove ANSI escape codes and non-printable control characters
  clean = clean.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 2. Redact secrets, credentials, tokens, bearer/basic headers entirely
  const secretsRegex = /\b[a-zA-Z0-9_\-]*?(?:API_KEY|API\-KEY|APIKEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|BEARER)[a-zA-Z0-9_\-]*?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|Bearer\s+[^\s\r\n]+|Basic\s+[^\s\r\n]+|[^\s\r\n]+)/gi;
  clean = clean.replace(secretsRegex, '[redacted]');

  // 3. Redact absolute paths (including paths containing spaces)
  // UNC paths: \\server\share\...
  const uncRegex = /\\\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*(?:\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*)*(?:\\[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)?/g;
  clean = clean.replace(uncRegex, '[redacted]');

  // file:// URLs
  const fileUrlRegex = /file:\/\/\/[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*(?:\/[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*)*(?:\/[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)?/gi;
  clean = clean.replace(fileUrlRegex, '[redacted]');

  // Windows paths: C:\Users\..., D:\temp...
  const winPathRegex = /[a-zA-Z]:\\(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\\)*(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)/g;
  clean = clean.replace(winPathRegex, '[redacted]');

  // POSIX absolute paths (starts with /)
  const posixPathRegex = /\/(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\/)*(?:[a-zA-Z0-9_\-\.%~]+(?:\s+[a-zA-Z0-9_\-\.%~]+)*\.[a-zA-Z0-9]{2,4}|[a-zA-Z0-9_\-\.%~]+)/g;
  clean = clean.replace(posixPathRegex, (match) => {
    if (match === '/health' || match === '/api/jobs' || match === '/history') {
      return match;
    }
    return '[redacted]';
  });

  // 4. Redact command line argument values
  const cmdArgValRegex = /(--[a-zA-Z0-9\-]+|-[a-zA-Z0-9])(?:\s+|=)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+(?:\s+[^\s\-\r\n]+)*)/gi;
  clean = clean.replace(cmdArgValRegex, '$1 [redacted]');

  return clean;
};

const getFailureSummary = (job) => {
  if (job.status !== 'failed') return null;
  const error = job.error;
  if (!error) return 'PR Worker execution failed.';

  const code = error.code;
  const details = error.details || {};
  const ranStage = sanitizeRanStageName(details.stage);
  const isRanJob = job.workerId === WORKER_IDS.RAN_PR;

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
    if (isRanJob) {
      return ranStage
        ? `RAN PR worker execution timed out (${ranStage}).`
        : 'RAN PR worker execution timed out.';
    }
    if (details.scope === 'TSS' || details.scope === 'TI') {
      return `PR worker execution timed out (${details.scope}).`;
    }
    return 'PR worker execution timed out.';
  } else if (code === 'WORKER_PROCESS_FAILED') {
    if (isRanJob) {
      return ranStage
        ? `RAN PR worker process failed (${ranStage}).`
        : 'RAN PR worker process failed.';
    }
    if (details.scope === 'TSS' || details.scope === 'TI') {
      return `PR worker process failed (${details.scope}).`;
    }
    return 'PR worker process failed.';
  } else if (code === 'RAN_INVALID_ECC_OUTPUT' || code === 'RAN_ZERO_VALID_ECC_OUTPUT') {
    return 'RAN PR worker produced no valid ECC output.';
  }
  return 'PR Worker execution failed.';
};

const getFailureDiagnosis = (job) => {
  if (job.status !== 'failed') return undefined;
  const error = job.error;
  if (!error) {
    return {
      category: 'WORKER_ERROR',
      title: job.workerId === WORKER_IDS.RAN_PR ? 'RAN PR Worker execution failed' : 'PR Worker execution failed',
      summary: job.workerId === WORKER_IDS.RAN_PR
        ? 'An unexpected error occurred during the RAN PR worker execution process.'
        : 'An unexpected error occurred during the PR worker execution process.',
      technicalDetails: ''
    };
  }

  const code = error.code || 'WORKER_ERROR';
  const details = error.details || {};
  const ranStage = sanitizeRanStageName(details.stage);
  const isRanJob = job.workerId === WORKER_IDS.RAN_PR;

  const allowedCategories = ['PREFLIGHT_FAILED', 'WORKER_TIMEOUT', 'WORKER_PROCESS_FAILED', 'RAN_INVALID_ECC_OUTPUT', 'RAN_ZERO_VALID_ECC_OUTPUT'];
  const category = allowedCategories.includes(code) ? code : 'WORKER_ERROR';

  let title = 'PR Worker execution failed';
  let summary = 'An unexpected error occurred during the PR worker execution process.';
  let missingPackages;
  let pythonExecutable;
  let recommendedCommand;
  let scope;
  let exitCode;

  const rawStderr = typeof details.stderr === 'string' ? details.stderr : '';
  const technicalDetails = redactTechnicalDetails(rawStderr).slice(-2000);

  if (category === 'PREFLIGHT_FAILED') {
    title = 'Python worker dependency missing';
    summary = 'PR worker preflight check failed because some required Python packages are not installed in the environment.';

    const allowedPkgs = ['pandas', 'openpyxl'];
    if (Array.isArray(details.missingPackages)) {
      const filtered = details.missingPackages.filter(p => allowedPkgs.includes(p));
      if (filtered.length > 0) {
        missingPackages = filtered;
      }
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
    summary = isRanJob
      ? `RAN PR worker execution exceeded the maximum allowed time limit${ranStage ? ` while running ${ranStage}` : ''}.`
      : 'PR worker execution exceeded the maximum allowed time limit.';

    if (isRanJob && ranStage) {
      scope = undefined;
    } else if (details.scope === 'TSS' || details.scope === 'TI') {
      scope = details.scope;
    }
  } else if (category === 'WORKER_PROCESS_FAILED') {
    title = 'Worker process failed';
    summary = isRanJob
      ? `RAN PR worker stage failed${ranStage ? ` while running ${ranStage}` : ''}.`
      : 'PR worker child process exited with an error status during execution.';

    if (isRanJob && ranStage) {
      scope = undefined;
    } else if (details.scope === 'TSS' || details.scope === 'TI') {
      scope = details.scope;
    }

    if (Number.isInteger(details.exitCode)) {
      exitCode = details.exitCode;
    }
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

const serializeCancellation = (job = {}) => {
  if (!job.cancellation) {
    return null;
  }

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
  createdAt: job.createdAt,
  completedAt: job.completedAt,
  generationScope: job.generationScope,
  prScope: getDisplayPrScope(job),
  runMode: job.runMode || null,
  selectedProject: job.selectedProject || null,
  requestedSiteCount: job.requestedSiteCount,
  matchedSiteCount: job.matchedSiteCount,
  unmatchedSiteCount: job.unmatchedSiteCount,
  outputFileCount: job.outputFileCount,
  reviewRequiredCount: job.reviewRequiredCount,
  warningCount: job.warningCount,
  finalWorkerSummary: job.finalWorkerSummary,
  browserTabSessionId: job.browserTabSessionId || null,
  idempotencyKey: job.idempotencyKey || null,
  cancellation: serializeCancellation(job),
  failureSummary: getFailureSummary(job)
});

const buildIdempotentReplayResult = async ({ workerId, idempotencyKey }) => {
  const existingJob = await findJobByIdempotency({ workerId, idempotencyKey });

  if (!existingJob) {
    return null;
  }

  return {
    created: false,
    job: serializeJobSummary(existingJob),
    queue: jobQueue.getQueueState(),
    message: 'Existing job returned for the repeated idempotent create request.'
  };
};

const assertJobExists = async (jobId) => {
  const job = await Job.findOne({ jobId });

  if (!job) {
    throw createApiError(404, 'JOB_NOT_FOUND', 'Job was not found.');
  }

  return job;
};

const createMwJob = async ({
  prevalidatedFileId,
  generationScope,
  siteCodes,
  prScope,
  browserTabSessionId,
  idempotencyKey,
  workerManifest,
  normalizedWorkerId
}) => {
  if (!prevalidatedFileId) {
    throw createApiError(400, 'VALIDATION_ERROR', 'prevalidatedFileId is required.');
  }

  if (!['site_code', 'all_sites'].includes(generationScope)) {
    throw createApiError(400, 'VALIDATION_ERROR', 'generationScope must be site_code or all_sites.');
  }

  const normalizedPrScope = normalizePrScope(prScope);

  if (!PR_SCOPES.includes(normalizedPrScope)) {
    throw createApiError(400, 'VALIDATION_ERROR', 'prScope must be TSS or TI.');
  }

  const normalizedSiteCodes = normalizeSiteCodes(siteCodes);
  const normalizedBrowserTabSessionId = normalizeBrowserTabSessionId(browserTabSessionId);
  const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);

  if (generationScope === 'site_code' && normalizedSiteCodes.length === 0) {
    throw createApiError(400, 'VALIDATION_ERROR', 'siteCodes must be provided when generationScope is site_code.');
  }

  if (normalizedSiteCodes.length > config.limits.maxSiteCodes) {
    throw createApiError(400, 'SITE_CODE_LIMIT_EXCEEDED', `Site code count exceeds the configured limit of ${config.limits.maxSiteCodes}.`);
  }

  return withIdempotencyReservation({
    workerId: normalizedWorkerId,
    idempotencyKey: normalizedIdempotencyKey
  }, async () => {
    let jobId = null;

    try {
      const replayResult = await buildIdempotentReplayResult({
        workerId: normalizedWorkerId,
        idempotencyKey: normalizedIdempotencyKey
      });

      if (replayResult) {
        return replayResult;
      }

      const upload = await consumePrevalidatedUpload(prevalidatedFileId);
      if (upload.uploadKind && upload.uploadKind !== UPLOAD_KINDS.MW_EXPORT) {
        throw createApiError(400, 'VALIDATION_ERROR', 'prevalidatedFileId must reference an iEPMS export upload.');
      }
      jobId = await generateUniqueJobId();
      await storageService.createJobFolders(jobId);

      const inputPath = storageService.resolveJobInputPath(jobId, upload.originalFileName);
      await fs.promises.copyFile(upload.absolutePath, inputPath);
      await storageService.deleteFileSafe(upload.absolutePath);
      const inputMetadata = await storageService.buildFileMetadata(inputPath);
      const retentionUntil = addRetentionDays();
      const requestPath = storageService.resolveJobTempPath(jobId, 'job-request.json');
      await storageService.saveBufferToFile(
        requestPath,
        Buffer.from(JSON.stringify({
          jobId,
          workerId: normalizedWorkerId,
          browserTabSessionId: normalizedBrowserTabSessionId,
          idempotencyKey: normalizedIdempotencyKey,
          prScope: normalizedPrScope,
          generationScope,
          siteCodes: normalizedSiteCodes,
          createdAt: new Date().toISOString()
        }, null, 2))
      );

      const job = await Job.create({
        jobId,
        workerId: normalizedWorkerId,
        engineVersion: workerManifest.engineVersion,
        engineCommit: workerManifest.engineCommit,
        workerType: 'pr-worker',
        status: 'queued',
        browserTabSessionId: normalizedBrowserTabSessionId,
        idempotencyKey: normalizedIdempotencyKey,
        prScope: normalizedPrScope,
        generationScope,
        requestedSiteCount: generationScope === 'site_code' ? normalizedSiteCodes.length : 0,
        fileRetentionUntil: retentionUntil
      });

      const jobFile = await JobFile.create({
        jobId,
        fileType: 'uploaded_export',
        fileName: upload.originalFileName,
        filePath: inputMetadata.filePath,
        fileSize: inputMetadata.fileSize,
        retentionUntil
      });
      const queueState = await jobQueue.enqueueJob(jobId);

      return {
        created: true,
        job: serializeJobSummary(job),
        jobFile: {
          id: jobFile._id.toString(),
          fileType: jobFile.fileType,
          fileName: jobFile.fileName,
          fileSize: jobFile.fileSize,
          retentionUntil: jobFile.retentionUntil
        },
        normalizedSiteCodes,
        queue: queueState,
        message: 'Job record and input file were prepared and queued for PR Worker execution.'
      };
    } catch (error) {
      if (jobId) {
        await Promise.all([
          Job.deleteMany({ jobId }),
          JobFile.deleteMany({ jobId }),
          storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {})
        ]).catch(() => {});
      }
      throw error;
    }
  });
};

const createRanJob = async ({
  bomPrevalidatedFileId,
  epmsPrevalidatedFileId,
  runMode,
  selectedProject,
  browserTabSessionId,
  idempotencyKey,
  workerManifest,
  normalizedWorkerId
}) => {
  if (!bomPrevalidatedFileId) {
    throw createApiError(400, 'VALIDATION_ERROR', 'bomPrevalidatedFileId is required for RAN PR Worker jobs.');
  }

  if (!epmsPrevalidatedFileId) {
    throw createApiError(400, 'VALIDATION_ERROR', 'epmsPrevalidatedFileId is required for RAN PR Worker jobs.');
  }

  let normalizedRunConfiguration;
  try {
    normalizedRunConfiguration = validateRanRunConfiguration({ runMode, selectedProject });
  } catch (error) {
    throw createApiError(400, 'VALIDATION_ERROR', error.message);
  }

  const normalizedBrowserTabSessionId = normalizeBrowserTabSessionId(browserTabSessionId);
  const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);

  return withIdempotencyReservation({
    workerId: normalizedWorkerId,
    idempotencyKey: normalizedIdempotencyKey
  }, async () => {
    let jobId = null;

    try {
      const replayResult = await buildIdempotentReplayResult({
        workerId: normalizedWorkerId,
        idempotencyKey: normalizedIdempotencyKey
      });

      if (replayResult) {
        return replayResult;
      }

      const [bomUpload, epmsUpload] = await Promise.all([
        consumePrevalidatedUpload(bomPrevalidatedFileId),
        consumePrevalidatedUpload(epmsPrevalidatedFileId)
      ]);
      assertUploadKind(bomUpload, UPLOAD_KINDS.RAN_BOM, 'BOM');
      assertUploadKind(epmsUpload, UPLOAD_KINDS.RAN_EPMS, 'EPMS');

      jobId = await generateUniqueJobId();
      await storageService.createJobFolders(jobId);

      const retentionUntil = addRetentionDays();
      const bomInputPath = storageService.resolveJobInputPath(jobId, bomUpload.originalFileName);
      const epmsInputPath = storageService.resolveJobInputPath(jobId, epmsUpload.originalFileName);

      await Promise.all([
        fs.promises.copyFile(bomUpload.absolutePath, bomInputPath),
        fs.promises.copyFile(epmsUpload.absolutePath, epmsInputPath)
      ]);
      await Promise.all([
        storageService.deleteFileSafe(bomUpload.absolutePath),
        storageService.deleteFileSafe(epmsUpload.absolutePath)
      ]);

      const [bomMetadata, epmsMetadata] = await Promise.all([
        storageService.buildFileMetadata(bomInputPath),
        storageService.buildFileMetadata(epmsInputPath)
      ]);
      const requestPath = storageService.resolveJobTempPath(jobId, 'job-request.json');
      await storageService.saveBufferToFile(
        requestPath,
        Buffer.from(JSON.stringify({
          jobId,
          workerId: normalizedWorkerId,
          browserTabSessionId: normalizedBrowserTabSessionId,
          idempotencyKey: normalizedIdempotencyKey,
          runMode: normalizedRunConfiguration.runMode,
          selectedProject: normalizedRunConfiguration.selectedProject,
          createdAt: new Date().toISOString(),
          inputs: {
            bomFileName: bomUpload.originalFileName,
            epmsFileName: epmsUpload.originalFileName
          }
        }, null, 2))
      );

      const job = await Job.create({
        jobId,
        workerId: normalizedWorkerId,
        engineVersion: workerManifest.engineVersion,
        engineCommit: workerManifest.engineCommit,
        workerType: 'pr-worker',
        status: 'queued',
        browserTabSessionId: normalizedBrowserTabSessionId,
        idempotencyKey: normalizedIdempotencyKey,
        generationScope: 'all_sites',
        prScope: null,
        runMode: normalizedRunConfiguration.runMode,
        selectedProject: normalizedRunConfiguration.selectedProject,
        requestedSiteCount: 0,
        fileRetentionUntil: retentionUntil
      });

      const jobFiles = await JobFile.insertMany([
        {
          jobId,
          fileType: 'ran_bom_upload',
          fileName: bomUpload.originalFileName,
          filePath: bomMetadata.filePath,
          fileSize: bomMetadata.fileSize,
          retentionUntil
        },
        {
          jobId,
          fileType: 'ran_epms_upload',
          fileName: epmsUpload.originalFileName,
          filePath: epmsMetadata.filePath,
          fileSize: epmsMetadata.fileSize,
          retentionUntil
        }
      ]);
      const queueState = await jobQueue.enqueueJob(jobId);

      return {
        created: true,
        job: serializeJobSummary(job),
        jobFiles: jobFiles.map((file) => ({
          id: file._id.toString(),
          fileType: file.fileType,
          fileName: file.fileName,
          fileSize: file.fileSize,
          retentionUntil: file.retentionUntil
        })),
        queue: queueState,
        message: 'RAN job record and tracked BOM/EPMS inputs were prepared and queued for PR Worker execution.'
      };
    } catch (error) {
      if (jobId) {
        await Promise.all([
          Job.deleteMany({ jobId }),
          JobFile.deleteMany({ jobId }),
          storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {})
        ]).catch(() => {});
      }
      throw error;
    }
  });
};

const createJob = async ({
  prevalidatedFileId,
  generationScope,
  siteCodes,
  prScope,
  workerId,
  bomPrevalidatedFileId,
  epmsPrevalidatedFileId,
  runMode,
  selectedProject,
  browserTabSessionId,
  idempotencyKey
}) => {
  const normalizedWorkerId = normalizeWorkerId(workerId);
  let workerManifest;

  try {
    workerManifest = getWorkerManifest(normalizedWorkerId);
  } catch (error) {
    throw createApiError(400, 'VALIDATION_ERROR', `workerId must be one of ${Object.values(WORKER_IDS).join(' or ')}.`);
  }

  if (normalizedWorkerId === WORKER_IDS.MW_PR) {
    return createMwJob({
      prevalidatedFileId,
      generationScope,
      siteCodes,
      prScope,
      browserTabSessionId,
      idempotencyKey,
      workerManifest,
      normalizedWorkerId
    });
  }

  return createRanJob({
    bomPrevalidatedFileId,
    epmsPrevalidatedFileId,
    runMode,
    selectedProject,
    browserTabSessionId,
    idempotencyKey,
    workerManifest,
    normalizedWorkerId
  });
};

const buildListFilter = async (query) => {
  const filter = {};

  if (query.workerId) {
    filter.workerId = normalizeWorkerId(query.workerId);
  }

  if (query.workerType) {
    filter.workerType = query.workerType;
  }

  if (query.browserTabSessionId) {
    filter.browserTabSessionId = normalizeBrowserTabSessionId(query.browserTabSessionId);
  }

  if (query.idempotencyKey) {
    filter.idempotencyKey = normalizeIdempotencyKey(query.idempotencyKey);
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.prScope) {
    const normalizedPrScope = normalizePrScope(query.prScope);

    if (PR_SCOPES.includes(normalizedPrScope)) {
      filter.prScope = normalizedPrScope;
    }
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};

    if (query.dateFrom) {
      filter.createdAt.$gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      filter.createdAt.$lte = new Date(query.dateTo);
    }
  }

  const search = String(query.search || '').trim();

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    const fileMatches = await JobFile.find({ fileName: searchRegex }).select({ jobId: 1 }).lean();
    const matchedJobIds = fileMatches.map((file) => file.jobId);

    filter.$or = [
      { jobId: searchRegex },
      { jobId: { $in: matchedJobIds } }
    ];
  }

  return filter;
};

const listJobs = async (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;
  const filter = await buildListFilter(query);
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter)
  ]);

  return {
    page,
    limit,
    total,
    items: items.map(serializeJobSummary)
  };
};

const isExpired = (file) => (
  Boolean(file.isExpired) || (
    file.retentionUntil && new Date(file.retentionUntil).getTime() < Date.now()
  )
);

const getFileAvailability = async (file) => {
  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), file.filePath)
  );
  const expired = isExpired(file);
  const exists = fs.existsSync(absolutePath);
  const unavailableByCleanup = Boolean(file.deletedAt || file.fileAvailable === false);

  return {
    id: file._id.toString(),
    fileType: file.fileType,
    fileName: file.fileName,
    fileSize: file.fileSize,
    retentionUntil: file.retentionUntil,
    isExpired: Boolean(file.isExpired),
    expiredAt: file.expiredAt,
    deletedAt: file.deletedAt,
    fileAvailable: file.fileAvailable !== false,
    cleanupReason: file.cleanupReason,
    available: exists && !expired && !unavailableByCleanup,
    expired,
    exists,
    unavailableReason: expired
      ? 'retention_expired'
      : unavailableByCleanup
        ? (file.cleanupReason || 'cleanup_removed')
        : exists ? null : 'file_missing'
  };
};

const getJobDetail = async (jobId) => {
  const job = await assertJobExists(jobId);
  const [files, reviewRequiredItems, warnings] = await Promise.all([
    JobFile.find({ jobId }).sort({ createdAt: 1 }).lean(),
    ReviewRequiredItem.find({ jobId }).sort({ createdAt: 1 }).lean(),
    WarningItem.find({ jobId }).sort({ createdAt: 1 }).lean()
  ]);

  const filesWithAvailability = await Promise.all(files.map(getFileAvailability));

  return {
    job: {
      ...serializeJobSummary(job),
      startedAt: job.startedAt,
      cancelledAt: job.cancelledAt,
      statusEvents: Array.isArray(job.statusEvents) ? job.statusEvents : [],
      prScope: getDisplayPrScope(job),
      assetVersions: job.assetVersions || {},
      fileRetentionUntil: job.fileRetentionUntil,
      failureDiagnosis: getFailureDiagnosis(job)
    },
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

  if (TERMINAL_JOB_STATUSES.includes(job.status)) {
    return {
      job: serializeJobSummary(job),
      message: 'Job cancellation has already been recorded.'
    };
  }

  job.cancellation = buildCancellationMetadata({
    job,
    requestedAt,
    requestedBy,
    ...reason
  });
  job.statusEvents = appendStatusEvent(job, 'cancellation_requested', {
    createdAt: requestedAt,
    requestedBy,
    reasonCode: reason.reasonCode,
    reasonLabel: reason.reasonLabel,
    reasonText: reason.reasonText
  });

  const queueCancelResult = await jobQueue.cancelQueuedJob(jobId);

  if (queueCancelResult.cancelled) {
    const cancelledAt = new Date();
    job.status = 'cancelled';
    job.cancelledAt = cancelledAt;
    job.completedAt = cancelledAt;
    job.finalWorkerSummary = 'Task cancelled. Any completed partial output files have been preserved where available.';
    job.cancellation = buildCancellationMetadata({
      job,
      requestedAt,
      requestedBy,
      completedAt: cancelledAt.toISOString(),
      finalStatus: 'cancelled',
      ...reason
    });
    job.statusEvents = appendStatusEvent(job, 'cancellation_completed', {
      createdAt: cancelledAt.toISOString(),
      requestedBy: job.cancellation.requestedBy,
      reasonCode: job.cancellation.reasonCode,
      reasonLabel: job.cancellation.reasonLabel,
      reasonText: job.cancellation.reasonText,
      finalStatus: 'cancelled'
    });
    await job.save();
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
      phase: 'CANCELLED',
      status: 'cancelled',
      message: 'Queued job cancelled before execution.'
    });
    const cancelledJob = await Job.findOne({ jobId });
    return {
      job: serializeJobSummary(cancelledJob),
      message: 'Queued job cancelled. Existing files are preserved.'
    };
  }

  if (queueCancelResult.running) {
    job.status = 'cancelling';
    await job.save();
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLATION_REQUESTED, {
      phase: 'CANCELLING',
      status: 'cancelling',
      message: 'Cancellation requested. The running worker will stop at the next safe checkpoint.'
    });
    return {
      job: serializeJobSummary(job),
      message: queueCancelResult.alreadyRequested
        ? 'Cancellation is already in progress for this job.'
        : 'Cancellation requested. The running worker will stop at the next safe checkpoint.'
    };
  }

  if (RUNNING_JOB_STATUSES.includes(job.status) || job.status === 'cancelling') {
    const cancelledAt = new Date();
    const finalStatus = (job.outputFileCount || 0) > 0 ? 'cancelled_with_partial_result' : 'cancelled';
    const orphanResolutionMessage = 'Cancellation completed after runtime ownership was lost; no live worker process was found.';

    job.status = finalStatus;
    job.cancelledAt = cancelledAt;
    job.completedAt = cancelledAt;
    job.finalWorkerSummary = orphanResolutionMessage;
    job.cancellation = buildCancellationMetadata({
      job,
      requestedAt,
      requestedBy,
      completedAt: cancelledAt.toISOString(),
      finalStatus,
      ...reason
    });
    job.statusEvents = appendStatusEvent(job, 'cancellation_completed', {
      createdAt: cancelledAt.toISOString(),
      requestedBy: job.cancellation.requestedBy,
      reasonCode: job.cancellation.reasonCode,
      reasonLabel: job.cancellation.reasonLabel,
      reasonText: job.cancellation.reasonText,
      finalStatus
    });
    await job.save();
    workerStateService.setCancelled(jobId, orphanResolutionMessage);
    await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
      phase: 'CANCELLED',
      status: finalStatus,
      message: orphanResolutionMessage
    });
    return {
      job: serializeJobSummary(job),
      message: orphanResolutionMessage
    };
  }

  if (!CANCELLABLE_BEFORE_WORKER_STATUSES.includes(job.status)) {
    throw createApiError(409, 'JOB_NOT_CANCELLABLE', `Job status ${job.status} cannot be cancelled by this layer.`);
  }

  job.status = 'cancelled';
  job.cancelledAt = new Date();
  job.finalWorkerSummary = 'Task cancelled. Any completed partial output files have been preserved where available.';
  await job.save();

  return {
    job: serializeJobSummary(job),
    message: 'Queued job cancelled. Existing files are preserved.'
  };
};

const buildStructuredJobData = async (jobId) => {
  const detail = await getJobDetail(jobId);

  return {
    job: detail.job,
    warnings: detail.warnings,
    reviewRequiredItems: detail.reviewRequiredItems,
    assetVersions: detail.assetVersions,
    files: detail.files.map((file) => ({
      id: file.id,
      fileType: file.fileType,
      fileName: file.fileName,
      fileSize: file.fileSize,
      available: file.available,
      expired: file.expired,
      deletedAt: file.deletedAt,
      cleanupReason: file.cleanupReason,
      unavailableReason: file.unavailableReason
    }))
  };
};

const askJob = async (jobId, question) => {
  return answerReAsk(jobId, question);
};

const ensureObjectId = (fileId) => {
  if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
    throw createApiError(400, 'VALIDATION_ERROR', 'fileId is invalid.');
  }
};

const getFileByJob = async (jobId, fileId) => {
  await assertJobExists(jobId);
  ensureObjectId(fileId);

  const file = await JobFile.findById(fileId);

  if (!file || file.jobId !== jobId) {
    throw createApiError(404, 'FILE_NOT_FOUND', 'File was not found for this job.');
  }

  return file;
};

const resolveTrackedFilePath = async (file) => {
  if (isExpired(file) || file.deletedAt || file.fileAvailable === false) {
    throw createApiError(410, 'FILE_EXPIRED', 'File Expired.');
  }

  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), file.filePath)
  );

  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
  } catch (error) {
    throw createApiError(404, 'FILE_NOT_AVAILABLE', 'Tracked file is not available on local storage.');
  }

  return {
    absolutePath,
    relativePath: toStorageRelativePath(storageService.getStorageRoot(), absolutePath)
  };
};

const getDownloadFile = async (jobId, fileId) => {
  const file = await getFileByJob(jobId, fileId);
  const resolved = await resolveTrackedFilePath(file);

  return {
    file,
    absolutePath: resolved.absolutePath
  };
};

const getZipDownloadFile = async (jobId) => {
  await assertJobExists(jobId);
  const zipFile = await JobFile.findOne({ jobId, fileType: 'zip_package' }).sort({ createdAt: -1 });

  if (!zipFile) {
    throw createApiError(
      501,
      'ZIP_NOT_READY',
      'ZIP package generation belongs to the output/report layer and is not available in EPIC 3.'
    );
  }

  const resolved = await resolveTrackedFilePath(zipFile);

  return {
    file: zipFile,
    absolutePath: resolved.absolutePath
  };
};

module.exports = {
  askJob,
  cancelJob,
  createJob,
  getDownloadFile,
  getJobDetail,
  getZipDownloadFile,
  listJobs,
  normalizeSiteCodes
};
