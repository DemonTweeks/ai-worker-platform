const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const config = require('../config/env');
const {
  assertPathInsideRoot,
  sanitizeFileName,
  sanitizeSegment,
  toStorageRelativePath
} = require('../utils/pathUtils');

const BASE_FOLDERS = ['jobs', 'assets', 'outputs', 'temp'];
const JOB_FOLDERS = ['input', 'filtered', 'output', 'reports', 'temp'];
const ASSET_TYPES = ['pr_model', 'ecc_template'];

const storageRoot = path.resolve(config.storageRoot);

const getStorageRoot = () => storageRoot;

const ensureDirectory = async (directoryPath) => {
  const safePath = assertPathInsideRoot(storageRoot, directoryPath);
  await fs.promises.mkdir(safePath, { recursive: true });
  return safePath;
};

const ensureBaseStorage = async () => {
  await fs.promises.mkdir(storageRoot, { recursive: true });
  await Promise.all(BASE_FOLDERS.map((folder) => ensureDirectory(path.join(storageRoot, folder))));
  return getStorageStatus();
};

const getStorageStatus = () => {
  const folders = {};
  let writable = false;
  let lastError = null;

  try {
    const rootExists = fs.existsSync(storageRoot);

    for (const folder of BASE_FOLDERS) {
      const folderPath = path.join(storageRoot, folder);
      folders[folder] = {
        exists: fs.existsSync(folderPath),
        path: toStorageRelativePath(storageRoot, folderPath)
      };
    }

    if (rootExists) {
      fs.accessSync(storageRoot, fs.constants.W_OK);
      writable = true;
    }

    return {
      status: rootExists && writable && Object.values(folders).every((folder) => folder.exists) ? 'ok' : 'degraded',
      root: storageRoot,
      exists: rootExists,
      writable,
      folders,
      lastError
    };
  } catch (error) {
    lastError = error.message;
    return {
      status: 'error',
      root: storageRoot,
      exists: fs.existsSync(storageRoot),
      writable,
      folders,
      lastError
    };
  }
};

const getJobRootPath = (jobId) => {
  const safeJobId = sanitizeSegment(jobId, 'job id');
  return assertPathInsideRoot(storageRoot, path.join(storageRoot, 'jobs', safeJobId));
};

const createJobFolders = async (jobId) => {
  const jobRoot = getJobRootPath(jobId);
  await ensureDirectory(jobRoot);
  await Promise.all(JOB_FOLDERS.map((folder) => ensureDirectory(path.join(jobRoot, folder))));

  return {
    jobId: sanitizeSegment(jobId, 'job id'),
    root: jobRoot,
    relativeRoot: toStorageRelativePath(storageRoot, jobRoot),
    folders: Object.fromEntries(
      JOB_FOLDERS.map((folder) => [folder, path.join(jobRoot, folder)])
    )
  };
};

const resolveJobFolderPath = (jobId, folder) => {
  const safeFolder = sanitizeSegment(folder, 'job folder');

  if (!JOB_FOLDERS.includes(safeFolder)) {
    throw new Error(`Unsupported job storage folder: ${safeFolder}`);
  }

  return assertPathInsideRoot(storageRoot, path.join(getJobRootPath(jobId), safeFolder));
};

const resolveJobFilePath = (jobId, folder, fileName) => {
  const safeFileName = sanitizeFileName(fileName);
  return assertPathInsideRoot(storageRoot, path.join(resolveJobFolderPath(jobId, folder), safeFileName));
};

const resolveJobInputPath = (jobId, fileName) => resolveJobFilePath(jobId, 'input', fileName);
const resolveJobOutputPath = (jobId, fileName) => resolveJobFilePath(jobId, 'output', fileName);
const resolveJobTempPath = (jobId, fileName) => resolveJobFilePath(jobId, 'temp', fileName);

const resolveAssetTypeFolderPath = (assetType) => {
  const safeAssetType = sanitizeSegment(assetType, 'asset type');

  if (!ASSET_TYPES.includes(safeAssetType)) {
    throw new Error(`Unsupported asset type: ${safeAssetType}`);
  }

  return assertPathInsideRoot(storageRoot, path.join(storageRoot, 'assets', safeAssetType));
};

const resolveAssetPath = (assetType, version, originalFileName) => {
  const safeVersion = sanitizeSegment(version, 'asset version');
  const extension = path.extname(sanitizeFileName(originalFileName || `${safeVersion}.xlsx`)) || '.xlsx';
  return assertPathInsideRoot(storageRoot, path.join(resolveAssetTypeFolderPath(assetType), `${safeVersion}${extension}`));
};

const resolveTempPath = (fileName) => {
  const safeFileName = sanitizeFileName(fileName);
  return assertPathInsideRoot(storageRoot, path.join(storageRoot, 'temp', safeFileName));
};

const buildFileMetadata = async (filePath, retentionDays = config.limits.fileRetentionDays) => {
  const safePath = assertPathInsideRoot(storageRoot, filePath);
  const stats = await fs.promises.stat(safePath);
  const retentionUntil = Number.isFinite(retentionDays)
    ? new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
    : null;

  return {
    fileName: path.basename(safePath),
    filePath: toStorageRelativePath(storageRoot, safePath),
    absolutePath: safePath,
    fileSize: stats.size,
    createdAt: stats.birthtime,
    retentionUntil
  };
};

const saveBufferToFile = async (filePath, buffer, options = {}) => {
  const safePath = assertPathInsideRoot(storageRoot, filePath);
  await ensureDirectory(path.dirname(safePath));
  await fs.promises.writeFile(safePath, buffer);
  return buildFileMetadata(safePath, options.retentionDays);
};

const saveStreamToFile = async (filePath, stream, options = {}) => {
  const safePath = assertPathInsideRoot(storageRoot, filePath);
  await ensureDirectory(path.dirname(safePath));
  await pipeline(stream, fs.createWriteStream(safePath));
  return buildFileMetadata(safePath, options.retentionDays);
};

const deleteFileSafe = async (filePath) => {
  const safePath = assertPathInsideRoot(storageRoot, filePath);
  await fs.promises.rm(safePath, { force: true });
};

const deleteFolderSafe = async (folderPath, options = {}) => {
  const safePath = assertPathInsideRoot(storageRoot, folderPath);

  if (safePath === storageRoot && !options.allowStorageRoot) {
    throw new Error('Refusing to delete storage root');
  }

  await fs.promises.rm(safePath, { recursive: true, force: true });
};

const cleanupTempFiles = async (olderThanMs) => {
  const tempRoot = assertPathInsideRoot(storageRoot, path.join(storageRoot, 'temp'));
  const entries = await fs.promises.readdir(tempRoot, { withFileTypes: true });
  const cutoff = Date.now() - olderThanMs;
  const deleted = [];

  for (const entry of entries) {
    if (entry.name === '.gitkeep') {
      continue;
    }

    const entryPath = assertPathInsideRoot(storageRoot, path.join(tempRoot, entry.name));
    const stats = await fs.promises.stat(entryPath);

    if (stats.mtimeMs < cutoff) {
      await fs.promises.rm(entryPath, { recursive: entry.isDirectory(), force: true });
      deleted.push(toStorageRelativePath(storageRoot, entryPath));
    }
  }

  return deleted;
};

module.exports = {
  ASSET_TYPES,
  BASE_FOLDERS,
  JOB_FOLDERS,
  buildFileMetadata,
  cleanupTempFiles,
  createJobFolders,
  deleteFileSafe,
  deleteFolderSafe,
  ensureBaseStorage,
  getJobRootPath,
  getStorageRoot,
  getStorageStatus,
  resolveAssetPath,
  resolveAssetTypeFolderPath,
  resolveJobFilePath,
  resolveJobFolderPath,
  resolveJobInputPath,
  resolveJobOutputPath,
  resolveJobTempPath,
  resolveTempPath,
  saveBufferToFile,
  saveStreamToFile
};
