const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { listApprovedSkills } = require('../skills/skillPackageService');

const SHA1_PATTERN = /^[a-f0-9]{40}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const TEXT_RUNTIME_EXTENSIONS = new Set([
  '.csv',
  '.geojson',
  '.js',
  '.json',
  '.md',
  '.py',
  '.txt',
  '.yaml',
  '.yml'
]);

const createIntegrityError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const resolveGitDirectory = (engineRoot) => {
  const dotGitPath = path.join(engineRoot, '.git');
  if (!fs.existsSync(dotGitPath)) {
    return null;
  }

  const stats = fs.statSync(dotGitPath);
  if (stats.isDirectory()) {
    return dotGitPath;
  }

  const pointer = fs.readFileSync(dotGitPath, 'utf8').trim();
  const match = pointer.match(/^gitdir:\s*(.+)$/i);
  return match ? path.resolve(engineRoot, match[1].trim()) : null;
};

const readPackedRef = (gitDirectory, refName) => {
  const packedRefsPath = path.join(gitDirectory, 'packed-refs');
  if (!fs.existsSync(packedRefsPath)) {
    return null;
  }

  const match = fs.readFileSync(packedRefsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('^') && line.endsWith(` ${refName}`));

  return match ? match.split(/\s+/, 1)[0] : null;
};

const resolveGitHead = (engineRoot) => {
  try {
    const gitDirectory = resolveGitDirectory(engineRoot);
    if (!gitDirectory || !fs.existsSync(gitDirectory)) {
      return null;
    }

    const headValue = fs.readFileSync(path.join(gitDirectory, 'HEAD'), 'utf8').trim();
    if (SHA1_PATTERN.test(headValue)) {
      return headValue.toLowerCase();
    }

    const refMatch = headValue.match(/^ref:\s*(.+)$/i);
    if (!refMatch) {
      return null;
    }

    const refName = refMatch[1].trim();
    const looseRefPath = path.join(gitDirectory, ...refName.split('/'));
    const commit = fs.existsSync(looseRefPath)
      ? fs.readFileSync(looseRefPath, 'utf8').trim()
      : readPackedRef(gitDirectory, refName);

    return commit && SHA1_PATTERN.test(commit) ? commit.toLowerCase() : null;
  } catch (error) {
    return null;
  }
};

const resolveRuntimeFile = (engineRoot, relativePath) => {
  const normalizedRoot = path.resolve(engineRoot);
  const absolutePath = path.resolve(normalizedRoot, relativePath);
  const relative = path.relative(normalizedRoot, absolutePath);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw createIntegrityError(
      'ENGINE_RUNTIME_FILE_INVALID',
      `Engine runtime file path is invalid: ${relativePath}.`,
      { relativePath }
    );
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw createIntegrityError(
      'ENGINE_RUNTIME_FILE_MISSING',
      `Engine runtime file is missing: ${relativePath}.`,
      { relativePath }
    );
  }

  return absolutePath;
};

const computeRuntimeFingerprint = (engineRoot, runtimeFiles) => {
  const hash = crypto.createHash('sha256');
  const files = Array.from(new Set(runtimeFiles || [])).sort();

  if (files.length === 0) {
    throw createIntegrityError(
      'ENGINE_PIN_UNAPPROVED',
      'Engine runtime fingerprint cannot be verified without approved runtime files.'
    );
  }

  for (const relativePath of files) {
    const normalizedRelativePath = String(relativePath).replace(/\\/g, '/');
    const absolutePath = resolveRuntimeFile(engineRoot, normalizedRelativePath);
    const rawContent = fs.readFileSync(absolutePath);
    const content = TEXT_RUNTIME_EXTENSIONS.has(path.extname(normalizedRelativePath).toLowerCase())
      ? Buffer.from(rawContent.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
      : rawContent;
    hash.update(normalizedRelativePath);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }

  return hash.digest('hex');
};

const assertManifestEngineIntegrity = ({ engineRoot, manifest }) => {
  if (
    !manifest
    || manifest.compatibilityStatus !== 'verified'
    || !SHA1_PATTERN.test(String(manifest.engineCommit || ''))
    || !SHA256_PATTERN.test(String(manifest.runtimeFingerprint || ''))
  ) {
    throw createIntegrityError(
      'ENGINE_PIN_UNAPPROVED',
      `${manifest && manifest.displayName ? manifest.displayName : 'Engine'} does not have an approved integrity pin.`
    );
  }

  if (!fs.existsSync(engineRoot) || !fs.statSync(engineRoot).isDirectory()) {
    throw createIntegrityError(
      'ENGINE_ROOT_MISSING',
      `${manifest.displayName} engine root was not found.`,
      { engineRoot }
    );
  }

  const actualFingerprint = computeRuntimeFingerprint(engineRoot, manifest.runtimeFiles);
  if (actualFingerprint !== manifest.runtimeFingerprint.toLowerCase()) {
    throw createIntegrityError(
      'ENGINE_FINGERPRINT_MISMATCH',
      `${manifest.displayName} runtime files do not match the approved fingerprint.`,
      {
        expectedFingerprint: manifest.runtimeFingerprint,
        actualFingerprint
      }
    );
  }

  const actualCommit = resolveGitHead(engineRoot);
  if (actualCommit && actualCommit !== manifest.engineCommit.toLowerCase()) {
    throw createIntegrityError(
      'ENGINE_COMMIT_MISMATCH',
      `${manifest.displayName} checkout does not match the approved commit.`,
      {
        expectedCommit: manifest.engineCommit,
        actualCommit
      }
    );
  }

  return {
    workerId: manifest.workerId,
    engineCommit: manifest.engineCommit,
    runtimeFingerprint: actualFingerprint,
    gitCommitVerified: Boolean(actualCommit)
  };
};

const assertPlatformEngineIntegrity = () => listApprovedSkills().map((skill) => ({
  workerId: skill.manifest.skillId,
  engineCommit: null,
  runtimeFingerprint: skill.packageSha256,
  gitCommitVerified: false,
  packageVersion: skill.manifest.version,
  runtimeFileCount: skill.runtimeFiles.length
}));

module.exports = {
  assertManifestEngineIntegrity,
  assertPlatformEngineIntegrity,
  computeRuntimeFingerprint,
  resolveGitHead
};
