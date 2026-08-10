const assert = require('assert');
const { determineFinalStatus } = require('../src/services/zeroOutputPolicyService');
const { fromEngineContract } = require('../src/services/resultReconciliationService');

const mappedContract = fromEngineContract({
  requested_count: 24,
  generated_count: 8,
  review_required_count: 16,
  approved_ignored_count: 0,
  duplicate_blocked_count: 0,
  failed_count: 0,
  unaccounted_count: 0
});
assert.deepStrictEqual(mappedContract, {
  requestedSiteCount: 24,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 16,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
});

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

const falselyClaimedComplete = {
  ...baseSummary,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
};
assert.throws(
  () => determineFinalStatus(falselyClaimedComplete),
  (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE',
  'platform must independently reject reconciliation counts that do not add up to requested sites'
);

const withPlatformUnmatchedSites = {
  ...baseSummary,
  matchedSiteCount: 22,
  unmatchedSiteCount: 2,
  generatedSiteCount: 22,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0,
  warningCount: 2
};
assert.strictEqual(
  determineFinalStatus(withPlatformUnmatchedSites),
  'completed_with_warning',
  'platform-known unmatched sites must count as explicit accounted outcomes instead of false unaccounted work'
);

console.log('Issue 88 result reconciliation regression tests passed.');
