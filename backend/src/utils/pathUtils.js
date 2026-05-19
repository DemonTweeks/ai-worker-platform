const path = require('path');

const unsafeSegmentPattern = /[<>:"/\\|?*\x00-\x1F]/g;

const normalizeForStorage = (value) => String(value || '').trim();

const hasPathTraversal = (value) => {
  const normalized = normalizeForStorage(value);
  return (
    normalized === '' ||
    normalized === '.' ||
    normalized === '..' ||
    path.isAbsolute(normalized) ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized.split(/[\\/]+/).includes('..')
  );
};

const sanitizeSegment = (value, label = 'path segment') => {
  const normalized = normalizeForStorage(value);

  if (hasPathTraversal(normalized)) {
    throw new Error(`Unsafe ${label}`);
  }

  const sanitized = normalized.replace(unsafeSegmentPattern, '_');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error(`Unsafe ${label}`);
  }

  return sanitized;
};

const sanitizeFileName = (fileName) => {
  const normalized = normalizeForStorage(fileName);

  if (hasPathTraversal(normalized)) {
    throw new Error('Unsafe file name');
  }

  const sanitized = normalized.replace(unsafeSegmentPattern, '_');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error('Unsafe file name');
  }

  return sanitized;
};

const assertPathInsideRoot = (rootPath, targetPath) => {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  if (relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
    return resolvedTarget;
  }

  throw new Error('Resolved path is outside storage root');
};

const toStorageRelativePath = (rootPath, targetPath) => {
  const safeTarget = assertPathInsideRoot(rootPath, targetPath);
  return path.relative(path.resolve(rootPath), safeTarget).split(path.sep).join('/');
};

module.exports = {
  assertPathInsideRoot,
  sanitizeFileName,
  sanitizeSegment,
  toStorageRelativePath
};
