const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const {
  Job,
  JobFile,
  ReviewRequiredItem,
  WarningItem
} = require('../models');
const storageService = require('./storageService');

const WARNING_REPORT_FILE = 'Error_Warning_Report.xlsx';
const REVIEW_REPORT_FILE = 'Review_Required_Report.xlsx';
const SUMMARY_FILE = 'Summary.json';
const ECC_OUTPUT_FILE_TYPES = ['ecc_output', 'ran_ecc_output', 'ran_ecc_output_with_general_items'];
const PR_AUDITOR_OUTPUT_FILE_TYPES = ['pr_audit_result_xlsx'];

const setColumns = (worksheet, columns) => {
  worksheet.columns = columns;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF7' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle' };
};

const normalizeDate = (value) => (value ? new Date(value).toISOString() : null);

const buildAdditionalDetails = (item = {}) => {
  const details = {};

  if (item.warningType) {
    details.warningType = item.warningType;
  }

  return Object.keys(details).length > 0 ? JSON.stringify(details) : '';
};

const writeWorkbook = async (workbook, filePath) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await workbook.xlsx.writeFile(filePath);
  return storageService.buildFileMetadata(filePath);
};

const createJobFileRecord = async ({ jobId, fileType, metadata }) => JobFile.create({
  jobId,
  fileType,
  fileName: metadata.fileName,
  filePath: metadata.filePath,
  fileSize: metadata.fileSize,
  retentionUntil: metadata.retentionUntil
});

const generateWarningReport = async (jobId) => {
  const [warnings, reviewRequiredItems] = await Promise.all([
    WarningItem.find({ jobId }).sort({ createdAt: 1 }).lean(),
    ReviewRequiredItem.find({ jobId }).sort({ createdAt: 1 }).lean()
  ]);

  if (warnings.length === 0 && reviewRequiredItems.length === 0) {
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Worker Platform';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Warnings');

  setColumns(worksheet, [
    { header: 'Category', key: 'category', width: 28 },
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Site Code', key: 'siteCode', width: 18 },
    { header: 'Source Row', key: 'sourceRow', width: 14 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Created At', key: 'createdAt', width: 26 },
    { header: 'Additional Details', key: 'additionalDetails', width: 40 }
  ]);

  warnings.forEach((warning) => {
    worksheet.addRow({
      category: warning.warningType || 'warning',
      severity: 'warning',
      siteCode: warning.siteCode || '',
      sourceRow: warning.sourceRow || '',
      description: warning.description || '',
      createdAt: normalizeDate(warning.createdAt),
      additionalDetails: buildAdditionalDetails(warning)
    });
  });

  reviewRequiredItems.forEach((item) => {
    worksheet.addRow({
      category: 'REVIEW_REQUIRED',
      severity: item.severity || 'medium',
      siteCode: item.siteCode || '',
      sourceRow: item.sourceRow || '',
      description: item.description || '',
      createdAt: normalizeDate(item.createdAt),
      additionalDetails: JSON.stringify({
        scope: item.scope || '',
        subcon: item.subcon || '',
        issueType: item.issueType || ''
      })
    });
  });

  const reportPath = storageService.resolveJobFilePath(jobId, 'reports', WARNING_REPORT_FILE);
  const metadata = await writeWorkbook(workbook, reportPath);
  return createJobFileRecord({ jobId, fileType: 'warning_report', metadata });
};

const generateReviewRequiredReport = async (jobId) => {
  const items = await ReviewRequiredItem.find({ jobId }).sort({ createdAt: 1 }).lean();

  if (items.length === 0) {
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Worker Platform';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('REVIEW_REQUIRED');

  setColumns(worksheet, [
    { header: 'Site Code', key: 'siteCode', width: 18 },
    { header: 'Source Row', key: 'sourceRow', width: 14 },
    { header: 'Scope', key: 'scope', width: 14 },
    { header: 'Subcon', key: 'subcon', width: 20 },
    { header: 'Issue Type', key: 'issueType', width: 24 },
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Created At', key: 'createdAt', width: 26 }
  ]);

  items.forEach((item) => {
    worksheet.addRow({
      siteCode: item.siteCode || '',
      sourceRow: item.sourceRow || '',
      scope: item.scope || '',
      subcon: item.subcon || '',
      issueType: item.issueType || '',
      severity: item.severity || '',
      description: item.description || '',
      createdAt: normalizeDate(item.createdAt)
    });
  });

  const reportPath = storageService.resolveJobFilePath(jobId, 'reports', REVIEW_REPORT_FILE);
  const metadata = await writeWorkbook(workbook, reportPath);
  return createJobFileRecord({ jobId, fileType: 'review_required_report', metadata });
};

const buildSummaryData = async (jobId) => {
  const [job, eccFileCount, reviewRequiredCount, warningCount] = await Promise.all([
    Job.findOne({ jobId }).lean(),
    JobFile.countDocuments({ jobId, fileType: { $in: ECC_OUTPUT_FILE_TYPES } }),
    ReviewRequiredItem.countDocuments({ jobId }),
    WarningItem.countDocuments({ jobId })
  ]);

  if (!job) {
    throw new Error(`Job ${jobId} was not found while building summary.`);
  }

  return {
    jobId: job.jobId,
    workerId: job.workerId || null,
    workerType: job.workerType,
    prScope: job.prScope || 'TSS',
    generationScope: job.generationScope,
    requestedSiteCount: job.requestedSiteCount || 0,
    matchedSiteCount: job.matchedSiteCount || 0,
    unmatchedSiteCount: job.unmatchedSiteCount || 0,
    eccFileCount,
    reviewRequiredCount,
    warningCount,
    outputFileCount: job.outputFileCount || eccFileCount,
    status: job.status,
    startedAt: normalizeDate(job.startedAt),
    completedAt: normalizeDate(job.completedAt),
    assetVersions: job.assetVersions || {},
    finalWorkerSummary: job.finalWorkerSummary || '',
    auditSummary: job.auditSummary || null
  };
};

const generateSummaryJson = async (jobId) => {
  const summary = await buildSummaryData(jobId);
  const summaryPath = storageService.resolveJobFilePath(jobId, 'reports', SUMMARY_FILE);
  const metadata = await storageService.saveBufferToFile(
    summaryPath,
    Buffer.from(JSON.stringify(summary, null, 2), 'utf8')
  );

  return createJobFileRecord({ jobId, fileType: 'summary', metadata });
};

module.exports = {
  ECC_OUTPUT_FILE_TYPES,
  REVIEW_REPORT_FILE,
  SUMMARY_FILE,
  WARNING_REPORT_FILE,
  buildSummaryData,
  generateReviewRequiredReport,
  generateSummaryJson,
  generateWarningReport
};
