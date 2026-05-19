const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { Job, JobFile } = require('../models');
const storageService = require('./storageService');
const { assertPathInsideRoot, toStorageRelativePath } = require('../utils/pathUtils');

const ACTIVE_JOB_STATUSES = new Set([
  'queued',
  'validating',
  'filtering_sites',
  'loading_assets',
  'generating',
  'exporting',
  'waiting_for_user_input'
]);

const TERMINAL_JOB_STATUSES = new Set([
  'completed',
  'completed_with_warning',
  'failed',
  'cancelled',
  'cancelled_with_partial_result'
]);

let lastCleanupRun = null;

const nowIso = () => new Date().toISOString();

const getRetentionCutoff = (now = new Date()) => (
  new Date(now.getTime() - config.limits.fileRetentionDays * 24 * 60 * 60 * 1000)
);

const safeFileSummary = (file, reason) => ({
  id: file._id.toString(),
  jobId: file.jobId,
  fileType: file.fileType,
  fileName: file.fileName,
  fileSize: file.fileSize || 0,
  retentionUntil: file.retentionUntil,
  reason
});

const resolveTrackedStoragePath = (relativePath) => {
  const root = storageService.getStorageRoot();
  const candidatePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(root, relativePath);

  return assertPathInsideRoot(root, candidatePath);
};

const inspectDeletionSafety = async (file) => {
  if (!file.filePath) {
    return { safe: false, reason: 'missing_file_path' };
  }

  let absolutePath;

  try {
    absolutePath = resolveTrackedStoragePath(file.filePath);
  } catch (error) {
    return { safe: false, reason: 'outside_storage_root' };
  }

  try {
    const stats = await fs.promises.lstat(absolutePath);

    if (stats.isSymbolicLink()) {
      return { safe: false, reason: 'symlink_skipped' };
    }

    if (!stats.isFile()) {
      return { safe: false, reason: 'not_regular_file' };
    }

    return {
      safe: true,
      absolutePath,
      relativePath: toStorageRelativePath(storageService.getStorageRoot(), absolutePath),
      fileSize: stats.size
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { safe: true, absolutePath, missing: true, reason: 'file_missing' };
    }

    return { safe: false, reason: 'stat_failed' };
  }
};

const getCandidateJobFiles = async (now = new Date()) => {
  const retentionCutoff = getRetentionCutoff(now);

  return JobFile.find({
    fileAvailable: { $ne: false },
    deletedAt: { $exists: false },
    $or: [
      { retentionUntil: { $lte: now } },
      { retentionUntil: { $exists: false }, createdAt: { $lte: retentionCutoff } }
    ]
  }).sort({ createdAt: 1 });
};

const classifyCandidate = async (file) => {
  const job = await Job.findOne({ jobId: file.jobId }).select({ jobId: 1, status: 1 }).lean();

  if (!job) {
    return { action: 'skip', reason: 'job_missing' };
  }

  if (ACTIVE_JOB_STATUSES.has(job.status)) {
    return { action: 'skip', reason: 'active_job' };
  }

  if (!TERMINAL_JOB_STATUSES.has(job.status)) {
    return { action: 'skip', reason: 'non_terminal_job' };
  }

  const safety = await inspectDeletionSafety(file);

  if (!safety.safe) {
    return { action: 'skip', reason: safety.reason };
  }

  return {
    action: 'delete',
    reason: safety.missing ? 'retention_expired_missing_file' : 'retention_expired',
    safety
  };
};

const getCleanupPlan = async ({ dryRun = true, now = new Date() } = {}) => {
  const files = await getCandidateJobFiles(now);
  const candidates = [];
  const skipped = [];
  let totalBytesCandidate = 0;

  for (const file of files) {
    const classification = await classifyCandidate(file);

    if (classification.action === 'delete') {
      const summary = safeFileSummary(file, classification.reason);
      candidates.push({
        ...summary,
        relativePath: classification.safety.relativePath || undefined,
        missing: Boolean(classification.safety.missing)
      });
      totalBytesCandidate += classification.safety.fileSize || file.fileSize || 0;
    } else {
      skipped.push(safeFileSummary(file, classification.reason));
    }
  }

  return {
    dryRun,
    retentionDays: config.limits.fileRetentionDays,
    cutoff: getRetentionCutoff(now).toISOString(),
    generatedAt: now.toISOString(),
    candidates,
    skipped,
    deleted: [],
    errors: [],
    totalBytesCandidate,
    totalBytesDeleted: 0
  };
};

const markFileUnavailable = async (fileId, reason, now) => {
  await JobFile.updateOne(
    { _id: fileId },
    {
      $set: {
        isExpired: true,
        expiredAt: now,
        deletedAt: now,
        fileAvailable: false,
        cleanupReason: reason
      }
    }
  );
};

const runCleanup = async ({ dryRun = true, now = new Date() } = {}) => {
  const plan = await getCleanupPlan({ dryRun, now });

  if (dryRun) {
    return plan;
  }

  for (const candidate of plan.candidates) {
    try {
      const file = await JobFile.findById(candidate.id);

      if (!file) {
        plan.skipped.push({ ...candidate, reason: 'job_file_missing' });
        continue;
      }

      const classification = await classifyCandidate(file);

      if (classification.action !== 'delete') {
        plan.skipped.push({ ...candidate, reason: classification.reason });
        continue;
      }

      if (!classification.safety.missing) {
        await storageService.deleteFileSafe(classification.safety.absolutePath);
        plan.totalBytesDeleted += classification.safety.fileSize || file.fileSize || 0;
      }

      await markFileUnavailable(file._id, classification.reason, now);
      plan.deleted.push(candidate);
    } catch (error) {
      plan.errors.push({
        ...candidate,
        reason: error.message || 'cleanup_failed'
      });
    }
  }

  lastCleanupRun = {
    ranAt: nowIso(),
    deletedCount: plan.deleted.length,
    errorCount: plan.errors.length,
    totalBytesDeleted: plan.totalBytesDeleted
  };

  return {
    ...plan,
    dryRun: false
  };
};

const getCleanupStatus = () => ({
  status: 'available',
  retentionDays: config.limits.fileRetentionDays,
  dryRunSupported: true,
  automaticScheduleEnabled: false,
  lastCleanupRun
});

module.exports = {
  ACTIVE_JOB_STATUSES,
  getCleanupPlan,
  getCleanupStatus,
  runCleanup
};
