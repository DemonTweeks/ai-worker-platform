const assert = require('assert');
const { determineFinalStatus } = require('../src/services/zeroOutputPolicyService');

const mixedDispositionWithoutCollectedOutput = {
  requestedSiteCount: 24,
  matchedSiteCount: 24,
  unmatchedSiteCount: 0,
  outputFileCount: 0,
  reviewRequiredCount: 16,
  warningCount: 0,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 16,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
};

assert.throws(
  () => determineFinalStatus(mixedDispositionWithoutCollectedOutput),
  (error) => error
    && error.code === 'ZERO_OUTPUT_WITHOUT_EXPLANATION'
    && error.details
    && error.details.generatedSiteCount === 8
    && error.details.outputFileCount === 0,
  'a positive generated-site count must not complete when no ECC output was collected'
);

const allReviewNoGeneratedOutput = {
  ...mixedDispositionWithoutCollectedOutput,
  generatedSiteCount: 0,
  reviewRequiredSiteCount: 24,
  reviewRequiredCount: 24
};

assert.strictEqual(
  determineFinalStatus(allReviewNoGeneratedOutput),
  'completed_with_warning',
  'zero output remains valid when reconciliation confirms no site was generated and every site has an explicit review disposition'
);

const allReviewWithContradictoryCollectedOutput = {
  ...allReviewNoGeneratedOutput,
  outputFileCount: 1
};

assert.throws(
  () => determineFinalStatus(allReviewWithContradictoryCollectedOutput),
  (error) => error
    && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
    && error.details
    && error.details.generatedSiteCount === 0
    && error.details.outputFileCount === 1,
  'collected ECC output must fail closed when reconciliation reports zero generated sites'
);

console.log('Issue 88 zero-output reconciliation regression tests passed.');
