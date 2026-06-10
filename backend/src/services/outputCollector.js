const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const config = require('../config/env');
const { JobFile } = require('../models');
const storageService = require('./storageService');
const { createApiError } = require('../utils/apiError');
const {
  generateReviewRequiredReport,
  generateSummaryJson,
  generateWarningReport,
  REVIEW_REPORT_FILE,
  SUMMARY_FILE,
  WARNING_REPORT_FILE
} = require('./reportGenerator');

const OUTPUT_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv', '.json', '.txt']);
const GENERATED_FILE_TYPES = [
  'ecc_output',
  'source_review_required',
  'source_duplicates_skipped',
  'review_required_report',
  'warning_report',
  'summary',
  'zip_package'
];

const classifyFileType = (fileName) => {
  const lower = fileName.toLowerCase();

  if (/^review_required_ti_.*\.csv$/i.test(fileName)) {
    return 'source_review_required';
  }

  if (/^duplicates_skipped_ti_.*\.csv$/i.test(fileName)) {
    return 'source_duplicates_skipped';
  }

  if (lower.includes('review')) {
    return 'review_required_report';
  }

  if (lower.includes('warning') || lower.includes('error')) {
    return 'warning_report';
  }

  if (lower.endsWith('.json')) {
    return 'summary';
  }

  return 'ecc_output';
};

const listFilesRecursive = async (directoryPath) => {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
};

const createZipPackage = async ({ jobId, outputFiles }) => {
  if (outputFiles.length === 0) {
    return null;
  }

  const zipPath = storageService.resolveJobOutputPath(jobId, `${jobId}-outputs.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const file of outputFiles) {
      archive.file(file.absolutePath, { name: file.archiveName });
    }

    archive.finalize();
  });

  const metadata = await storageService.buildFileMetadata(zipPath);
  return JobFile.create({
    jobId,
    fileType: 'zip_package',
    fileName: metadata.fileName,
    filePath: metadata.filePath,
    fileSize: metadata.fileSize,
    retentionUntil: metadata.retentionUntil
  });
};

const collectOutputs = async (jobId) => {
  const outputFolder = storageService.resolveJobFolderPath(jobId, 'output');
  const existingFiles = await listFilesRecursive(outputFolder);
  const collectableFiles = existingFiles.filter((filePath) => (
    OUTPUT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
    && !path.basename(filePath).toLowerCase().endsWith('.zip')
  ));

  if (collectableFiles.length > config.limits.maxOutputFiles) {
    throw createApiError(
      400,
      'OUTPUT_FILE_LIMIT_EXCEEDED',
      `Generated output file count ${collectableFiles.length} exceeds the configured limit of ${config.limits.maxOutputFiles}.`
    );
  }

  await JobFile.deleteMany({ jobId, fileType: { $in: GENERATED_FILE_TYPES } });

  const createdFiles = [];

  for (const filePath of collectableFiles) {
    const metadata = await storageService.buildFileMetadata(filePath);
    const jobFile = await JobFile.create({
      jobId,
      fileType: classifyFileType(metadata.fileName),
      fileName: metadata.fileName,
      filePath: metadata.filePath,
      fileSize: metadata.fileSize,
      retentionUntil: metadata.retentionUntil
    });
    createdFiles.push(jobFile);
  }

  return {
    outputFiles: createdFiles,
    zipFile: null,
    outputFileCount: createdFiles.filter((file) => file.fileType === 'ecc_output').length
  };
};

const resolveJobFileAbsolutePath = (jobFile) => path.join(storageService.getStorageRoot(), jobFile.filePath);

const buildArchiveEntries = (jobFiles) => jobFiles.map((file) => {
  let archiveName = path.basename(file.fileName);

  if (file.fileType === 'ecc_output') {
    archiveName = `ECC_Output/${archiveName}`;
  }

  if (file.fileType === 'review_required_report') {
    archiveName = REVIEW_REPORT_FILE;
  }

  if (file.fileType === 'warning_report') {
    archiveName = WARNING_REPORT_FILE;
  }

  if (file.fileType === 'source_review_required' || file.fileType === 'source_duplicates_skipped') {
    archiveName = `Create_PR_CD_Source/${path.basename(file.fileName)}`;
  }

  if (file.fileType === 'summary') {
    archiveName = SUMMARY_FILE;
  }

  return {
    absolutePath: resolveJobFileAbsolutePath(file),
    archiveName
  };
});

const generateReportsAndPackage = async (jobId) => {
  await JobFile.deleteMany({ jobId, fileType: { $in: ['review_required_report', 'warning_report', 'summary', 'zip_package'] } });

  const [warningReport, reviewReport, summaryFile] = await Promise.all([
    generateWarningReport(jobId),
    generateReviewRequiredReport(jobId),
    generateSummaryJson(jobId)
  ]);

  const packageFiles = await JobFile.find({
    jobId,
    fileType: { $in: [
      'ecc_output',
      'source_review_required',
      'source_duplicates_skipped',
      'review_required_report',
      'warning_report',
      'summary'
    ] }
  }).sort({ fileType: 1, createdAt: 1 });

  const zipFile = await createZipPackage({
    jobId,
    outputFiles: buildArchiveEntries(packageFiles)
  });

  return {
    warningReport,
    reviewReport,
    summaryFile,
    zipFile
  };
};

module.exports = {
  collectOutputs,
  generateReportsAndPackage
};
