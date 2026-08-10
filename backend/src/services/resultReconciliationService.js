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

  const explicitUnaccounted = normalizeCount(summary.unaccountedSiteCount);
  const unaccountedSiteCount = explicitUnaccounted !== null
    ? explicitUnaccounted
    : requestedSiteCount !== null
      ? Math.max(requestedSiteCount - accountedSiteCount, 0)
      : null;

  return {
    requestedSiteCount,
    generatedSiteCount,
    reviewRequiredSiteCount,
    approvedIgnoredSiteCount,
    duplicateBlockedSiteCount,
    failedSiteCount,
    accountedSiteCount,
    unaccountedSiteCount
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
    unaccountedSiteCount: reconciliation.unaccountedSiteCount
  };
};

module.exports = {
  hasExplicitReconciliation,
  normalizeResultReconciliation,
  toPersistedReconciliation
};
