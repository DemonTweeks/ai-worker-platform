const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const storageService = require('./storageService');
const {
  assertPathInsideRoot,
  sanitizeFileName,
  sanitizeSegment,
  toStorageRelativePath
} = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const MANIFEST_SUFFIX = '.prevalidation.json';

const buildChecklistItem = (key, label, passed, message) => ({
  key,
  label,
  passed,
  message
});

const buildWorkerExplanation = (passed, failedMessages = []) => {
  if (passed) {
    return 'The uploaded iEPMS export passed the initial technical checks. You can continue to job creation; business-rule validation will run in the worker layer later.';
  }

  return `I cannot start the task yet. ${failedMessages.join(' ')}`;
};

const getManifestPath = (prevalidatedFileId) => {
  const safeId = sanitizeSegment(prevalidatedFileId, 'prevalidated file id');
  return storageService.resolveTempPath(`${safeId}${MANIFEST_SUFFIX}`);
};

const readManifest = async (prevalidatedFileId) => {
  const manifestPath = getManifestPath(prevalidatedFileId);

  try {
    const raw = await fs.promises.readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw createApiError(404, 'PREVALIDATED_FILE_NOT_FOUND', 'Prevalidated file was not found or has expired.');
    }

    throw error;
  }
};

const deleteManifest = async (prevalidatedFileId) => {
  await storageService.deleteFileSafe(getManifestPath(prevalidatedFileId));
};

const validateUpload = async (file) => {
  const checklist = [];
  const failedMessages = [];
  const maxBytes = config.limits.maxUploadSizeMb * 1024 * 1024;
  const originalName = file ? file.originalname : '';
  const extension = path.extname(originalName || '').toLowerCase();
  const fileExists = Boolean(file && file.buffer && file.size > 0);
  const extensionAllowed = ALLOWED_EXTENSIONS.includes(extension);
  const sizeAllowed = fileExists && file.size <= maxBytes;

  checklist.push(buildChecklistItem(
    'file_exists',
    'File exists',
    fileExists,
    fileExists ? 'File was received.' : 'No uploaded file was received.'
  ));

  checklist.push(buildChecklistItem(
    'file_type',
    'File type is supported',
    extensionAllowed,
    extensionAllowed
      ? 'File extension is supported.'
      : `Only ${ALLOWED_EXTENSIONS.join(', ')} files are supported in this layer.`
  ));

  checklist.push(buildChecklistItem(
    'file_size',
    'File size is within limit',
    sizeAllowed,
    sizeAllowed
      ? `File size is within ${config.limits.maxUploadSizeMb} MB.`
      : `File size must be greater than 0 and no larger than ${config.limits.maxUploadSizeMb} MB.`
  ));

  let safeOriginalFileName = null;
  let safeFileName = false;

  try {
    safeOriginalFileName = sanitizeFileName(originalName);
    safeFileName = true;
  } catch (error) {
    failedMessages.push('The uploaded file name is unsafe.');
  }

  checklist.push(buildChecklistItem(
    'safe_file_name',
    'File name is safe',
    safeFileName,
    safeFileName ? 'File name can be stored safely.' : 'File name contains unsafe path characters.'
  ));

  const passed = checklist.every((item) => item.passed);

  if (!fileExists) {
    failedMessages.push('Please upload an iEPMS export file.');
  }

  if (!extensionAllowed) {
    failedMessages.push('Please upload an Excel file with .xlsx or .xls extension.');
  }

  if (!sizeAllowed) {
    failedMessages.push(`Please keep the upload within ${config.limits.maxUploadSizeMb} MB.`);
  }

  if (!passed) {
    return {
      passed,
      originalFileName: originalName,
      fileSize: file ? file.size : 0,
      checklist,
      workerExplanation: buildWorkerExplanation(false, failedMessages)
    };
  }

  const prevalidatedFileId = `preval-${Date.now()}-${crypto.randomUUID()}`;
  const storedFileName = `${prevalidatedFileId}-${safeOriginalFileName}`;
  const tempPath = storageService.resolveTempPath(storedFileName);
  const metadata = await storageService.saveBufferToFile(tempPath, file.buffer);

  const manifest = {
    prevalidatedFileId,
    originalFileName: safeOriginalFileName,
    fileSize: metadata.fileSize,
    tempFilePath: metadata.filePath,
    passed: true,
    createdAt: new Date().toISOString(),
    retentionUntil: metadata.retentionUntil ? metadata.retentionUntil.toISOString() : null
  };

  await storageService.saveBufferToFile(
    getManifestPath(prevalidatedFileId),
    Buffer.from(JSON.stringify(manifest, null, 2)),
    { retentionDays: config.limits.fileRetentionDays }
  );

  return {
    prevalidatedFileId,
    originalFileName: safeOriginalFileName,
    fileSize: metadata.fileSize,
    checklist,
    passed: true,
    workerExplanation: buildWorkerExplanation(true)
  };
};

const getPrevalidatedUpload = async (prevalidatedFileId) => {
  const manifest = await readManifest(prevalidatedFileId);

  if (!manifest.passed) {
    throw createApiError(400, 'PREVALIDATION_FAILED', 'The uploaded file did not pass pre-validation.');
  }

  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), manifest.tempFilePath)
  );

  await fs.promises.access(absolutePath, fs.constants.R_OK);

  return {
    ...manifest,
    absolutePath,
    relativePath: toStorageRelativePath(storageService.getStorageRoot(), absolutePath)
  };
};

const consumePrevalidatedUpload = async (prevalidatedFileId) => {
  const upload = await getPrevalidatedUpload(prevalidatedFileId);
  await deleteManifest(prevalidatedFileId);
  return upload;
};

module.exports = {
  ALLOWED_EXTENSIONS,
  consumePrevalidatedUpload,
  getPrevalidatedUpload,
  validateUpload
};
