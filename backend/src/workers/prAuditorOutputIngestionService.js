const fs = require('fs');
const path = require('path');
const { Job, JobFile } = require('../models');
const storageService = require('../services/storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const PR_AUDITOR_OUTPUT_DEFINITIONS = [
  {
    workspaceFileName: 'PR_Audit_Result.xlsx',
    trackedFileType: 'pr_audit_result_xlsx',
    required: true
  },
  {
    workspaceFileName: 'pr_audit_summary.json',
    trackedFileType: 'pr_audit_summary_json',
    required: false
  }
];

const PR_AUDITOR_GENERATED_FILE_TYPES = PR_AUDITOR_OUTPUT_DEFINITIONS.map((definition) => definition.trackedFileType);

const buildFailureResult = () => ({
  code: 'PR_AUDITOR_OUTPUT_MISSING',
  message: 'PR Auditor did not produce the required audit report output.',
  details: {
    requiredOutput: 'PR_Audit_Result.xlsx'
  }
});

const coerceNonNegativeInteger = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
};

const normalizeWarningList = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const warnings = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .slice(0, 100);

  return warnings;
};

const normalizeAuditSummary = (rawSummary) => {
  const candidate = rawSummary && typeof rawSummary === 'object' && rawSummary.auditSummary
    ? rawSummary.auditSummary
    : rawSummary;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const normalized = {
    normalCount: coerceNonNegativeInteger(candidate.normalCount),
    invalidPoCount: coerceNonNegativeInteger(candidate.invalidPoCount),
    wrongPoCount: coerceNonNegativeInteger(candidate.wrongPoCount),
    duplicatePoCount: coerceNonNegativeInteger(candidate.duplicatePoCount),
    reviewRequiredCount: coerceNonNegativeInteger(candidate.reviewRequiredCount),
    warnings: normalizeWarningList(candidate.warnings)
  };

  const hasRequiredCounts = [
    normalized.normalCount,
    normalized.invalidPoCount,
    normalized.wrongPoCount,
    normalized.duplicatePoCount,
    normalized.reviewRequiredCount
  ].every((value) => value !== null);

  if (!hasRequiredCounts || normalized.warnings === null) {
    return null;
  }

  return normalized;
};

const copyApprovedOutput = async ({ jobId, workspaceOutputRoot, definition }) => {
  const sourcePath = assertPathInsideRoot(
    workspaceOutputRoot,
    path.join(workspaceOutputRoot, definition.workspaceFileName)
  );

  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  const destinationPath = storageService.resolveJobOutputPath(jobId, definition.workspaceFileName);
  await fs.promises.copyFile(sourcePath, destinationPath);

  const metadata = await storageService.buildFileMetadata(destinationPath);
  return JobFile.create({
    jobId,
    fileType: definition.trackedFileType,
    fileName: metadata.fileName,
    filePath: metadata.filePath,
    fileSize: metadata.fileSize,
    retentionUntil: metadata.retentionUntil
  });
};

const readTrustedAuditSummary = async (workspaceOutputRoot) => {
  const summaryPath = assertPathInsideRoot(
    workspaceOutputRoot,
    path.join(workspaceOutputRoot, 'pr_audit_summary.json')
  );

  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(await fs.promises.readFile(summaryPath, 'utf8'));
    return normalizeAuditSummary(raw);
  } catch (error) {
    return null;
  }
};

const ingestPrAuditorOutputs = async ({ jobId, workspaceOutputRoot }) => {
  await JobFile.deleteMany({ jobId, fileType: { $in: PR_AUDITOR_GENERATED_FILE_TYPES } });

  const trackedFiles = [];
  let reportTracked = false;

  for (const definition of PR_AUDITOR_OUTPUT_DEFINITIONS) {
    const trackedFile = await copyApprovedOutput({ jobId, workspaceOutputRoot, definition });
    if (trackedFile) {
      trackedFiles.push(trackedFile);
      if (definition.trackedFileType === 'pr_audit_result_xlsx') {
        reportTracked = true;
      }
    }
  }

  const auditSummary = await readTrustedAuditSummary(workspaceOutputRoot);
  const outputFileCount = trackedFiles.filter((file) => file.fileType === 'pr_audit_result_xlsx').length;

  await Job.updateOne(
    { jobId },
    {
      $set: {
        outputFileCount,
        reviewRequiredCount: auditSummary ? auditSummary.reviewRequiredCount : 0,
        warningCount: auditSummary ? auditSummary.warnings.length : 0,
        auditSummary
      }
    }
  );

  return {
    trackedFiles,
    outputFileCount,
    auditSummary,
    failure: reportTracked ? null : buildFailureResult()
  };
};

module.exports = {
  PR_AUDITOR_GENERATED_FILE_TYPES,
  PR_AUDITOR_OUTPUT_DEFINITIONS,
  ingestPrAuditorOutputs,
  normalizeAuditSummary
};
