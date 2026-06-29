const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');
const config = require('../config/env');
const storageService = require('./storageService');
const { inspectIepmsWorkbookBuffer } = require('./iepmsParser');
const { validateRanBomWorkbookBuffer } = require('../workers/ranBomValidationService');
const {
  assertPathInsideRoot,
  sanitizeFileName,
  sanitizeSegment,
  toStorageRelativePath
} = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const MANIFEST_SUFFIX = '.prevalidation.json';
const UPLOAD_KINDS = {
  MW_EXPORT: 'mw-export',
  RAN_BOM: 'ran-bom',
  RAN_EPMS: 'ran-epms'
};

const UPLOAD_KIND_CONFIG = {
  [UPLOAD_KINDS.MW_EXPORT]: {
    missingFileMessage: 'Please upload an iEPMS export file.',
    successExplanation: 'The uploaded iEPMS export passed the initial technical checks. You can continue to job creation; business-rule validation will run in the worker layer later.',
    inspectWorkbook: true
  },
  [UPLOAD_KINDS.RAN_BOM]: {
    missingFileMessage: 'Please upload a RAN BOM workbook.',
    successExplanation: 'The uploaded RAN BOM workbook passed the initial technical checks. Worker-level validation will continue after the job is created.',
    inspectWorkbook: false,
    verifyWorkbookReadable: true
  },
  [UPLOAD_KINDS.RAN_EPMS]: {
    missingFileMessage: 'Please upload a RAN EPMS workbook.',
    successExplanation: 'The uploaded RAN EPMS workbook passed the initial technical checks. Worker-level validation will continue after the job is created.',
    inspectWorkbook: true,
    verifyWorkbookReadable: false
  }
};

const buildChecklistItem = (key, label, passed, message) => ({
  key,
  label,
  passed,
  message
});

const getUploadConfig = (uploadKind) => {
  const normalizedUploadKind = String(uploadKind || UPLOAD_KINDS.MW_EXPORT).trim();
  const uploadConfig = UPLOAD_KIND_CONFIG[normalizedUploadKind];

  if (!uploadConfig) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      `uploadKind must be one of ${Object.values(UPLOAD_KINDS).join(', ')}.`
    );
  }

  return {
    uploadKind: normalizedUploadKind,
    ...uploadConfig
  };
};

const buildWorkerExplanation = (passed, uploadConfig, failedMessages = []) => {
  if (passed) {
    return uploadConfig.successExplanation;
  }

  return `I cannot start the task yet. ${failedMessages.join(' ')}`;
};

const hasZipSignature = (buffer) => (
  buffer.length >= 4
  && buffer[0] === 0x50
  && buffer[1] === 0x4B
  && [0x03, 0x05, 0x07].includes(buffer[2])
  && [0x04, 0x06, 0x08].includes(buffer[3])
);

const hasOleSignature = (buffer) => (
  buffer.length >= 8
  && buffer[0] === 0xD0
  && buffer[1] === 0xCF
  && buffer[2] === 0x11
  && buffer[3] === 0xE0
  && buffer[4] === 0xA1
  && buffer[5] === 0xB1
  && buffer[6] === 0x1A
  && buffer[7] === 0xE1
);

const assertWorkbookReadable = (buffer, extension) => {
  if (extension === '.xlsx' && !hasZipSignature(buffer)) {
    throw new Error('Workbook must be a valid .xlsx file.');
  }

  if (extension === '.xls' && !hasOleSignature(buffer)) {
    throw new Error('Workbook must be a valid .xls file.');
  }

  const workbook = xlsx.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellNF: false,
    cellStyles: false
  });

  if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    const error = new Error('Workbook must contain at least one worksheet.');
    error.code = 'WORKBOOK_EMPTY';
    throw error;
  }

  return workbook;
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

const validateUpload = async (file, options = {}) => {
  const uploadConfig = getUploadConfig(options.uploadKind);
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
    failedMessages.push(uploadConfig.missingFileMessage);
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
      uploadKind: uploadConfig.uploadKind,
      originalFileName: originalName,
      fileSize: file ? file.size : 0,
      checklist,
      workerExplanation: buildWorkerExplanation(false, uploadConfig, failedMessages)
    };
  }

  if (uploadConfig.verifyWorkbookReadable) {
    try {
      assertWorkbookReadable(file.buffer, extension);
      checklist.push(buildChecklistItem(
        'workbook_readable',
        'Workbook can be opened',
        true,
        'Workbook contents can be read successfully.'
      ));
    } catch (error) {
      checklist.push(buildChecklistItem(
        'workbook_readable',
        'Workbook can be opened',
        false,
        error.message || 'Workbook contents could not be read.'
      ));
      failedMessages.push(error.message || 'Workbook contents could not be read.');

      return {
        passed: false,
        uploadKind: uploadConfig.uploadKind,
        originalFileName: originalName,
        fileSize: file ? file.size : 0,
        checklist,
        workerExplanation: buildWorkerExplanation(false, uploadConfig, failedMessages)
      };
    }
  }

  if (uploadConfig.uploadKind === UPLOAD_KINDS.RAN_BOM) {
    const bomValidation = await validateRanBomWorkbookBuffer(file.buffer);
    checklist.push(buildChecklistItem(
      'ran_bom_structure',
      'Workbook matches the required RAN BOM structure',
      bomValidation.valid,
      bomValidation.valid
        ? 'Workbook matches the required RAN BOM structure.'
        : 'Workbook does not match the required RAN BOM structure.'
    ));

    if (!bomValidation.valid) {
      failedMessages.push('Please upload the required RAN BOM workbook structure.');

      return {
        passed: false,
        uploadKind: uploadConfig.uploadKind,
        originalFileName: originalName,
        fileSize: file ? file.size : 0,
        checklist,
        workerExplanation: buildWorkerExplanation(false, uploadConfig, failedMessages)
      };
    }
  }

  let workbookMetadata = null;

  if (uploadConfig.inspectWorkbook) {
    try {
      workbookMetadata = inspectIepmsWorkbookBuffer(file.buffer);
      checklist.push(buildChecklistItem(
        'row_count',
        'Row count is within limit',
        true,
        `Workbook has ${workbookMetadata.rowCount} data rows, within the configured limit of ${config.limits.maxRowCount}.`
      ));
    } catch (error) {
      checklist.push(buildChecklistItem(
        'row_count',
        'Row count is within limit',
        false,
        error.message || 'Workbook row count could not be validated.'
      ));
      failedMessages.push(error.message || 'Workbook row count could not be validated.');

      return {
        passed: false,
        uploadKind: uploadConfig.uploadKind,
        originalFileName: originalName,
        fileSize: file ? file.size : 0,
        checklist,
        workerExplanation: buildWorkerExplanation(false, uploadConfig, failedMessages)
      };
    }
  }

  const prevalidatedFileId = `preval-${Date.now()}-${crypto.randomUUID()}`;
  const storedFileName = `${prevalidatedFileId}-${safeOriginalFileName}`;
  const tempPath = storageService.resolveTempPath(storedFileName);
  const metadata = await storageService.saveBufferToFile(tempPath, file.buffer);

  const manifest = {
    prevalidatedFileId,
    uploadKind: uploadConfig.uploadKind,
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
    uploadKind: uploadConfig.uploadKind,
    originalFileName: safeOriginalFileName,
    fileSize: metadata.fileSize,
    workbook: workbookMetadata,
    checklist,
    passed: true,
    workerExplanation: buildWorkerExplanation(true, uploadConfig)
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
  UPLOAD_KINDS,
  consumePrevalidatedUpload,
  getPrevalidatedUpload,
  getUploadConfig,
  validateUpload
};
