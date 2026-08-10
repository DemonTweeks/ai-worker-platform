const assert = require('assert');
const { determineFinalStatus } = require('../src/services/zeroOutputPolicyService');

const baseSummary = {
  requestedSiteCount: 24,
  matchedSiteCount: 24,
  unmatchedSiteCount: 0,
  outputFileCount: 1,
  reviewRequiredCount: 0,
  warningCount: 0
};

const fullyReconciled = {
  ...baseSummary,
  generatedSiteCount: 24,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
};
assert.strictEqual(
  determineFinalStatus(fullyReconciled),
  'completed',
  'fully reconciled requested sites should retain clean completed status'
);

const partialWithReview = {
  ...baseSummary,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 16,
  reviewRequiredCount: 16,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
};
assert.strictEqual(
  determineFinalStatus(partialWithReview),
  'completed_with_warning',
  'a reconciled partial result with review-required sites must not present clean completed status'
);

const incomplete = {
  ...baseSummary,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 16
};
assert.throws(
  () => determineFinalStatus(incomplete),
  (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE',
  'unaccounted requested sites must block clean completion'
);

console.log('Issue 88 result reconciliation regression tests passed.');
