const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');

const MAX_RECONCILIATION_JSON_BYTES = 1024 * 1024;
const COUNT_FIELDS = [
  'generatedSiteCount',
  'reviewRequiredSiteCount',
  'approvedIgnoredSiteCount',
  'duplicateBlockedSiteCount',
  'failedSiteCount',
  'unaccountedSiteCount'
];

const normalizeCount = (value) => {
  if (!Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
};

const hasExplicitReconciliation = (summary = {}) => COUNT_FIELDS.some((field) => (
  summary[field] !== undefined && summary[field] !== null
));

const normalizeResultReconciliation = (summary = {}) => {
  if (!hasExplicitReconciliation(summary)) return null;

  const requestedSiteCount = normalizeCount(summary.requestedSiteCount);
  const generatedSiteCount = normalizeCount(summary.generatedSiteCount) || 0;
  const reviewRequiredSiteCount = normalizeCount(summary.reviewRequiredSiteCount) || 0;
  const approvedIgnoredSiteCount = normalizeCount(summary.approvedIgnoredSiteCount) || 0;
  const duplicateBlockedSiteCount = normalizeCount(summary.duplicateBlockedSiteCount) || 0;
  const failedSiteCount = normalizeCount(summary.failedSiteCount) || 0;
  const accountedSiteCount = generatedSiteCount
    + reviewRequiredSiteCount
    + approvedIgnoredSiteCount
    + duplicateBlockedSiteCount
    + failedSiteCount;

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
    generatedSiteCount,
    reviewRequiredSiteCount,
    approvedIgnoredSiteCount,
    duplicateBlockedSiteCount,
    failedSiteCount,
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

const fromEngineContract = (payload = {}) => ({
  requestedSiteCount: payload.requested_count ?? payload.requestedSiteCount,
  generatedSiteCount: payload.generated_count ?? payload.generatedSiteCount,
  reviewRequiredSiteCount: payload.review_required_count ?? payload.reviewRequiredSiteCount,
  approvedIgnoredSiteCount: payload.approved_ignored_count ?? payload.approvedIgnoredSiteCount,
  duplicateBlockedSiteCount: payload.duplicate_blocked_count ?? payload.duplicateBlockedSiteCount,
  failedSiteCount: payload.failed_count ?? payload.failedSiteCount,
  unaccountedSiteCount: payload.unaccounted_count ?? payload.unaccountedSiteCount
});

const discoverWorkerReconciliation = async (outputCollection = {}) => {
  const jsonFiles = (outputCollection.outputFiles || []).filter((file) => (
    String(file.fileName || '').toLowerCase().endsWith('.json') && file.filePath
  ));

  for (const file of jsonFiles) {
    const absolutePath = path.join(storageService.getStorageRoot(), file.filePath);
    try {
      const stat = await fs.promises.stat(absolutePath);
      if (!stat.isFile() || stat.size > MAX_RECONCILIATION_JSON_BYTES) continue;
      const parsed = JSON.parse(await fs.promises.readFile(absolutePath, 'utf8'));
      const contract = parsed.result_reconciliation || parsed.resultReconciliation || parsed.reconciliation;
      if (!contract || typeof contract !== 'object' || Array.isArray(contract)) continue;
      const mapped = fromEngineContract(contract);
      if (normalizeResultReconciliation(mapped)) return mapped;
    } catch (error) {
      // Non-reconciliation JSON output remains a normal worker artifact.
    }
  }

  return null;
};

module.exports = {
  discoverWorkerReconciliation,
  hasExplicitReconciliation,
  normalizeResultReconciliation,
  toPersistedReconciliation
};
