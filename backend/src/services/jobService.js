const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config/env');
const {
  Job,
  JobFile,
  ReviewRequiredItem,
  WarningItem
} = require('../models');
const storageService = require('./storageService');
const { consumePrevalidatedUpload } = require('./prevalidationService');
const { parseSiteCodes } = require('./siteCodeParser');
const workerStateService = require('./workerStateService');
const jobQueue = require('../queue/jobQueue');
const { answerReAsk } = require('../llm/reAskService');
const { generateUniqueJobId } = require('../utils/jobIdGenerator');
const { assertPathInsideRoot, toStorageRelativePath } = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');

const CANCELLABLE_BEFORE_WORKER_STATUSES = ['queued'];
const RUNNING_STATUSES = [
  'validating',
  'filtering_sites',
  'loading_assets',
  'generating',
  'exporting',
  'waiting_for_user_input'
];
const TERMINAL_STATUSES = [
  'completed',
  'completed_with_warning',
  'failed',
  'cancelled',
  'cancelled_with_partial_result'
];
const PR_SCOPES = ['TSS', 'TI'];

const normalizeSiteCodes = (siteCodes = []) => parseSiteCodes(siteCodes).siteCodes;

const normalizePrScope = (prScope) => String(prScope || 'TSS').trim().toUpperCase();

const addRetentionDays = () => (
  new Date(Date.now() + config.limits.fileRetentionDays * 24 * 60 * 60 * 1000)
);

const serializeJobSummary = (job) => ({
  jobId: job.jobId,
  workerType: job.workerType,
  status: job.status,
  createdAt: job.createdAt,
  completedAt: job.completedAt,
  generationScope: job.generationScope,
  prScope: job.prScope || 'TSS',
  requestedSiteCount: job.requestedSiteCount,
  matchedSiteCount: job.matchedSiteCount,
  unmatchedSiteCount: job.unmatchedSiteCount,
  outputFileCount: job.outputFileCount,
  reviewRequiredCount: job.reviewRequiredCount,
  warningCount: job.warningCount,
  finalWorkerSummary: job.finalWorkerSummary
});

const assertJobExists = async (jobId) => {
  const job = await Job.findOne({ jobId });

  if (!job) {
    throw createApiError(404, 'JOB_NOT_FOUND', 'Job was not found.');
  }

  return job;
};

const createJob = async ({ prevalidatedFileId, generationScope, siteCodes, prScope }) => {
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

  if (generationScope === 'site_code' && normalizedSiteCodes.length === 0) {
    throw createApiError(400, 'VALIDATION_ERROR', 'siteCodes must be provided when generationScope is site_code.');
  }

  if (normalizedSiteCodes.length > config.limits.maxSiteCodes) {
    throw createApiError(400, 'SITE_CODE_LIMIT_EXCEEDED', `Site code count exceeds the configured limit of ${config.limits.maxSiteCodes}.`);
  }

  const upload = await consumePrevalidatedUpload(prevalidatedFileId);
  const jobId = await generateUniqueJobId();
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
      prScope: normalizedPrScope,
      generationScope,
      siteCodes: normalizedSiteCodes,
      createdAt: new Date().toISOString()
    }, null, 2))
  );

  const job = await Job.create({
    jobId,
    workerType: 'pr-worker',
    status: 'queued',
    prScope: normalizedPrScope,
    generationScope,
    requestedSiteCount: generationScope === 'site_code' ? normalizedSiteCodes.length : 0,
    fileRetentionUntil: retentionUntil,
    finalWorkerSummary: 'Job created and queued. PR Worker execution will run after the worker queue layer is implemented.'
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
};

const buildListFilter = async (query) => {
  const filter = {};

  if (query.workerType) {
    filter.workerType = query.workerType;
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
      prScope: job.prScope || 'TSS',
      assetVersions: job.assetVersions || {},
      engineVersion: job.engineVersion,
      fileRetentionUntil: job.fileRetentionUntil,
      error: job.error
    },
    workerState: workerStateService.getState(jobId),
    finalWorkerSummary: job.finalWorkerSummary,
    outputs: filesWithAvailability.filter((file) => file.fileType !== 'uploaded_export'),
    files: filesWithAvailability,
    reviewRequiredItems,
    warnings,
    assetVersions: job.assetVersions || {}
  };
};

const cancelJob = async (jobId) => {
  const job = await assertJobExists(jobId);

  if (TERMINAL_STATUSES.includes(job.status)) {
    throw createApiError(409, 'JOB_NOT_CANCELLABLE', `Job is already in terminal status ${job.status}.`);
  }

  const queueCancelResult = await jobQueue.cancelQueuedJob(jobId);

  if (queueCancelResult.cancelled) {
    const cancelledJob = await Job.findOne({ jobId });
    return {
      job: serializeJobSummary(cancelledJob),
      message: 'Queued job cancelled. Existing files are preserved.'
    };
  }

  if (queueCancelResult.running || RUNNING_STATUSES.includes(job.status)) {
    return {
      job: serializeJobSummary(job),
      message: 'Cancellation requested. The running worker will stop at the next safe checkpoint.'
    };
  }

  if (!CANCELLABLE_BEFORE_WORKER_STATUSES.includes(job.status)) {
    throw createApiError(409, 'JOB_NOT_CANCELLABLE', `Job status ${job.status} cannot be cancelled by this layer.`);
  }

  job.status = 'cancelled';
  job.cancelledAt = new Date();
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
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
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
