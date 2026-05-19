const path = require('path');
const { Job, JobFile, ReviewRequiredItem, WarningItem } = require('../models');
const workerStateService = require('./workerStateService');

const serializeFile = (file) => ({
  id: file._id.toString(),
  fileType: file.fileType,
  fileName: path.basename(file.fileName),
  fileSize: file.fileSize,
  retentionUntil: file.retentionUntil,
  createdAt: file.createdAt
});

const buildSafeJobContext = async (jobId) => {
  const [job, files, warnings, reviewRequiredItems] = await Promise.all([
    Job.findOne({ jobId }).lean(),
    JobFile.find({ jobId }).sort({ createdAt: 1 }).lean(),
    WarningItem.find({ jobId }).sort({ createdAt: 1 }).limit(200).lean(),
    ReviewRequiredItem.find({ jobId }).sort({ createdAt: 1 }).limit(200).lean()
  ]);

  if (!job) {
    return null;
  }

  const summary = {
    requestedSiteCount: job.requestedSiteCount,
    matchedSiteCount: job.matchedSiteCount,
    unmatchedSiteCount: job.unmatchedSiteCount,
    outputFileCount: job.outputFileCount,
    reviewRequiredCount: job.reviewRequiredCount,
    warningCount: job.warningCount
  };

  return {
    job: {
      jobId: job.jobId,
      workerType: job.workerType,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      generationScope: job.generationScope,
      finalWorkerSummary: job.finalWorkerSummary,
      assetVersions: job.assetVersions || {},
      error: job.error ? {
        code: job.error.code,
        message: job.error.message,
        details: job.error.details
      } : null
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
    outputs: files.filter((file) => file.fileType !== 'uploaded_export').map(serializeFile),
    files: files.map(serializeFile)
  };
};

module.exports = {
  buildSafeJobContext
};
