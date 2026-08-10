const fs = require('fs');
const path = require('path');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const MAX_RECONCILIATION_JSON_BYTES = 1024 * 1024;
const RECONCILIATION_MARKERS = ['"result_reconciliation"', '"resultReconciliation"'];
const COUNT_FIELDS = [
  'generatedSiteCount',
  'reviewRequiredSiteCount',
  'approvedIgnoredSiteCount',
  'duplicateBlockedSiteCount',
  'failedSiteCount',
  'unaccountedSiteCount'
];
const CANONICAL_CONTRACT_FIELDS = ['requestedSiteCount', ...COUNT_FIELDS];

const ENGINE_CONTRACT_FIELDS = [
  ['requested_count', 'requestedSiteCount'],
  ['generated_count', 'generatedSiteCount'],
  ['review_required_count', 'reviewRequiredSiteCount'],
  ['approved_ignored_count', 'approvedIgnoredSiteCount'],
  ['duplicate_blocked_count', 'duplicateBlockedSiteCount'],
  ['failed_count', 'failedSiteCount'],
  ['unaccounted_count', 'unaccountedSiteCount']
];

const invalidContractError = (reason, field) => Object.assign(
  new Error('Worker result reconciliation contract is invalid.'),
  {
    code: 'RESULT_RECONCILIATION_INCOMPLETE',
    details: {
      reason,
      ...(field ? { field } : {})
    }
  }
);

const normalizeCount = (value) => (
  Number.isInteger(value) && value >= 0 ? value : null
);

const hasExplicitReconciliation = (summary = {}) => COUNT_FIELDS.some((field) => (
  summary[field] !== undefined && summary[field] !== null
));

const normalizeResultReconciliation = (summary = {}) => {
  if (!hasExplicitReconciliation(summary)) return null;

  const requestedSiteCount = normalizeCount(summary.requestedSiteCount);
  const unmatchedSiteCount = normalizeCount(summary.unmatchedSiteCount) || 0;
  const generatedSiteCount = normalizeCount(summary.generatedSiteCount) || 0;
  const reviewRequiredSiteCount = normalizeCount(summary.reviewRequiredSiteCount) || 0;
  const approvedIgnoredSiteCount = normalizeCount(summary.approvedIgnoredSiteCount) || 0;
  const duplicateBlockedSiteCount = normalizeCount(summary.duplicateBlockedSiteCount) || 0;
  const failedSiteCount = normalizeCount(summary.failedSiteCount) || 0;
  const workerAccountedSiteCount = generatedSiteCount
    + reviewRequiredSiteCount
    + approvedIgnoredSiteCount
    + duplicateBlockedSiteCount
    + failedSiteCount;
  const accountedSiteCount = workerAccountedSiteCount + unmatchedSiteCount;

  const explicitUnaccountedSiteCount = normalizeCount(summary.unaccountedSiteCount);
  const derivedUnaccountedSiteCount = requestedSiteCount !== null
    ? Math.max(requestedSiteCount - accountedSiteCount, 0)
    : null;
  const unaccountedSiteCount = requestedSiteCount !== null
    ? Math.max(derivedUnaccountedSiteCount, explicitUnaccountedSiteCount || 0)
    : explicitUnaccountedSiteCount;
  const reconciliationConsistent = requestedSiteCount === null
    ? null
    : accountedSiteCount <= requestedSiteCount
      && (explicitUnaccountedSiteCount === null || accountedSiteCount + explicitUnaccountedSiteCount === requestedSiteCount);

  return {
    requestedSiteCount,
    unmatchedSiteCount,
    generatedSiteCount,
    reviewRequiredSiteCount,
    approvedIgnoredSiteCount,
    duplicateBlockedSiteCount,
    failedSiteCount,
    workerAccountedSiteCount,
    accountedSiteCount,
    unaccountedSiteCount,
    reconciliationConsistent
  };
};

const toPersistedReconciliation = (summary = {}) => {
  const reconciliation = normalizeResultReconciliation(summary);
  if (!reconciliation) return {};
  return {
    generatedSiteCount: reconciliation.generatedSiteCount,
    reviewRequiredSiteCount: reconciliation.reviewRequiredSiteCount,
    approvedIgnoredSiteCount: reconciliation.approvedIgnoredSiteCount,
    duplicateBlockedSiteCount: reconciliation.duplicateBlockedSiteCount,
    failedSiteCount: reconciliation.failedSiteCount,
    accountedSiteCount: reconciliation.accountedSiteCount,
    unaccountedSiteCount: reconciliation.unaccountedSiteCount,
    reconciliationConsistent: reconciliation.reconciliationConsistent
  };
};

const validateCanonicalReconciliation = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalidContractError('INVALID_CONTRACT_OBJECT');
  }

  const validated = {};
  for (const field of CANONICAL_CONTRACT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      throw invalidContractError('MISSING_REQUIRED_COUNT', field);
    }
    const value = payload[field];
    if (!Number.isInteger(value) || value < 0) {
      throw invalidContractError('INVALID_COUNT', field);
    }
    validated[field] = value;
  }
  return validated;
};

const readContractCount = (payload, snakeName, camelName) => {
  const hasSnake = Object.prototype.hasOwnProperty.call(payload, snakeName);
  const hasCamel = Object.prototype.hasOwnProperty.call(payload, camelName);
  if (!hasSnake && !hasCamel) {
    throw invalidContractError('MISSING_REQUIRED_COUNT', snakeName);
  }

  const value = hasSnake ? payload[snakeName] : payload[camelName];
  if (!Number.isInteger(value) || value < 0) {
    throw invalidContractError('INVALID_COUNT', snakeName);
  }
  return value;
};

const fromEngineContract = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalidContractError('INVALID_CONTRACT_OBJECT');
  }

  const values = ENGINE_CONTRACT_FIELDS.map(([snakeName, camelName]) => (
    readContractCount(payload, snakeName, camelName)
  ));

  return validateCanonicalReconciliation({
    requestedSiteCount: values[0],
    generatedSiteCount: values[1],
    reviewRequiredSiteCount: values[2],
    approvedIgnoredSiteCount: values[3],
    duplicateBlockedSiteCount: values[4],
    failedSiteCount: values[5],
    unaccountedSiteCount: values[6]
  });
};

const containsMarkerText = (text = '') => RECONCILIATION_MARKERS.some((marker) => text.includes(marker));

const containsReconciliationMarker = (absolutePath) => new Promise((resolve, reject) => {
  const maxMarkerLength = Math.max(...RECONCILIATION_MARKERS.map((marker) => marker.length));
  let carry = '';
  const stream = fs.createReadStream(absolutePath, { encoding: 'utf8' });

  stream.on('data', (chunk) => {
    const searchable = carry + chunk;
    if (containsMarkerText(searchable)) {
      stream.destroy();
      resolve(true);
      return;
    }
    carry = searchable.slice(-(maxMarkerLength - 1));
  });
  stream.on('end', () => resolve(false));
  stream.on('close', () => {});
  stream.on('error', reject);
});

const discoverWorkerReconciliation = async (outputCollection = {}) => {
  const storageService = require('./storageService');
  const storageRoot = storageService.getStorageRoot();
  const jsonFiles = (outputCollection.outputFiles || []).filter((file) => (
    String(file.fileName || '').toLowerCase().endsWith('.json') && file.filePath
  ));

  for (const file of jsonFiles) {
    const absolutePath = assertPathInsideRoot(storageRoot, path.join(storageRoot, file.filePath));
    try {
      const stat = await fs.promises.stat(absolutePath);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_RECONCILIATION_JSON_BYTES) {
        if (await containsReconciliationMarker(absolutePath)) {
          throw invalidContractError('OVERSIZED_CONTRACT_ARTIFACT');
        }
        continue;
      }

      const rawJson = await fs.promises.readFile(absolutePath, 'utf8');
      let parsed;
      try {
        parsed = JSON.parse(rawJson);
      } catch (parseError) {
        if (containsMarkerText(rawJson)) {
          throw invalidContractError('MALFORMED_CONTRACT_ARTIFACT');
        }
        continue;
      }

      const hasSnakeContract = Object.prototype.hasOwnProperty.call(parsed, 'result_reconciliation');
      const hasCamelContract = Object.prototype.hasOwnProperty.call(parsed, 'resultReconciliation');
      if (!hasSnakeContract && !hasCamelContract) continue;

      const contract = hasSnakeContract ? parsed.result_reconciliation : parsed.resultReconciliation;
      const mapped = fromEngineContract(contract);
      if (!normalizeResultReconciliation(mapped)) {
        throw invalidContractError('MISSING_RECONCILIATION_COUNTS');
      }
      return mapped;
    } catch (error) {
      if (error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE') {
        throw error;
      }
      // Unrelated unreadable/non-contract JSON output remains a normal worker artifact.
    }
  }

  return null;
};

module.exports = {
  discoverWorkerReconciliation,
  fromEngineContract,
  hasExplicitReconciliation,
  normalizeResultReconciliation,
  toPersistedReconciliation,
  validateCanonicalReconciliation
};