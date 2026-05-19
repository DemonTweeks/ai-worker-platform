const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { Asset } = require('../models');
const storageService = require('./storageService');
const { writeAuditLog } = require('./auditService');
const { assertPathInsideRoot, sanitizeFileName } = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');

const ASSET_TYPES = ['pr_model', 'contract_info', 'ecc_template'];
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

const assetTypePrefixes = {
  pr_model: 'PR_MODEL',
  contract_info: 'CONTRACT_INFO',
  ecc_template: 'ECC_TEMPLATE'
};

const formatDateForVersion = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const validateAssetType = (assetType) => {
  if (!ASSET_TYPES.includes(assetType)) {
    throw createApiError(400, 'VALIDATION_ERROR', 'assetType must be pr_model, contract_info, or ecc_template.');
  }
};

const validateUploadFile = (file) => {
  if (!file || !file.buffer || file.size <= 0) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Asset file is required.');
  }

  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Asset file must be .xlsx or .xls.');
  }

  if (file.size > config.limits.maxUploadSizeMb * 1024 * 1024) {
    throw createApiError(400, 'UPLOAD_TOO_LARGE', `Asset file exceeds ${config.limits.maxUploadSizeMb} MB.`);
  }

  try {
    sanitizeFileName(file.originalname);
  } catch (error) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Asset file name is unsafe.');
  }
};

const generateAssetVersion = async (assetType) => {
  validateAssetType(assetType);
  const prefix = assetTypePrefixes[assetType];
  const baseVersion = `${prefix}_${formatDateForVersion()}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const version = attempt === 0 ? baseVersion : `${baseVersion}_${String(attempt + 1).padStart(2, '0')}`;
    const exists = await Asset.exists({ version });

    if (!exists) {
      return version;
    }
  }

  throw createApiError(409, 'VERSION_COLLISION', 'Unable to create a unique asset version.');
};

const serializeAsset = async (asset) => {
  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), asset.filePath)
  );
  const fileExists = fs.existsSync(absolutePath);

  return {
    id: asset._id.toString(),
    assetType: asset.assetType,
    version: asset.version,
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    isActive: asset.isActive,
    uploadedBy: asset.uploadedBy,
    uploadedAt: asset.uploadedAt,
    activatedAt: asset.activatedAt,
    fileAvailable: fileExists
  };
};

const uploadAsset = async ({ assetType, file, adminUser, ip }) => {
  validateAssetType(assetType);
  validateUploadFile(file);

  const version = await generateAssetVersion(assetType);
  const filePath = storageService.resolveAssetPath(assetType, version, file.originalname);
  const metadata = await storageService.saveBufferToFile(filePath, file.buffer, { retentionDays: null });

  const asset = await Asset.create({
    assetType,
    version,
    fileName: sanitizeFileName(file.originalname),
    filePath: metadata.filePath,
    fileSize: metadata.fileSize,
    isActive: false,
    uploadedBy: adminUser.username
  });

  await writeAuditLog({
    admin: adminUser.username,
    action: 'ASSET_UPLOAD',
    assetType,
    version,
    status: 'success',
    ip,
    metadata: { fileName: asset.fileName, fileSize: asset.fileSize }
  });

  return serializeAsset(asset);
};

const activateAsset = async ({ assetType, version, adminUser, ip }) => {
  validateAssetType(assetType);

  const asset = await Asset.findOne({ assetType, version });

  if (!asset) {
    throw createApiError(404, 'ASSET_NOT_FOUND', 'Asset version was not found.');
  }

  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), asset.filePath)
  );

  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
  } catch (error) {
    await writeAuditLog({
      admin: adminUser.username,
      action: 'ASSET_ACTIVATE',
      assetType,
      version,
      status: 'failed',
      ip,
      metadata: { reason: 'file_missing' }
    });
    throw createApiError(409, 'ASSET_FILE_MISSING', 'Asset file is missing and cannot be activated.');
  }

  await Asset.updateMany(
    { assetType, isActive: true, version: { $ne: version } },
    { $set: { isActive: false } }
  );
  asset.isActive = true;
  asset.activatedAt = new Date();
  await asset.save();

  await writeAuditLog({
    admin: adminUser.username,
    action: 'ASSET_ACTIVATE',
    assetType,
    version,
    status: 'success',
    ip
  });

  return serializeAsset(asset);
};

const listAssets = async (query = {}) => {
  const filter = {};

  if (query.assetType) {
    validateAssetType(query.assetType);
    filter.assetType = query.assetType;
  }

  if (query.isActive !== undefined) {
    filter.isActive = String(query.isActive).toLowerCase() === 'true';
  }

  const assets = await Asset.find(filter).sort({ assetType: 1, uploadedAt: -1 }).lean();
  const items = await Promise.all(assets.map(serializeAsset));
  const activeByType = {};

  for (const item of items) {
    if (item.isActive) {
      activeByType[item.assetType] = item.version;
    }
  }

  return {
    activeByType,
    items
  };
};

module.exports = {
  ASSET_TYPES,
  activateAsset,
  generateAssetVersion,
  listAssets,
  uploadAsset
};
