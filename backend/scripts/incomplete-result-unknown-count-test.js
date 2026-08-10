const assert = require('assert');
const { serializeJobSummary } = require('../src/services/jobService');
const { sanitizeWorkerErrorForLlm } = require('../src/services/jobContextService');

const rawJob = {
  jobId: 'PR-ISSUE88-UNKNOWN-COUNT',
  workerId: 'mw-pr',
  workerType: 'pr-worker',
  status: 'failed',
  error: {
    code: 'RESULT_RECONCILIATION_INCOMPLETE',
    details: { reason: 'MALFORMED_CONTRACT_ARTIFACT' }
  },
  requestedSiteCount: 24,
  matchedSiteCount: 24,
  unmatchedSiteCount: 0,
  outputFileCount: 1,
  reviewRequiredCount: 0,
  warningCount: 0,
  generatedSiteCount: null,
  reviewRequiredSiteCount: null,
  approvedIgnoredSiteCount: null,
  duplicateBlockedSiteCount: null,
  failedSiteCount: null,
  accountedSiteCount: null,
  unaccountedSiteCount: null,
  reconciliationConsistent: null
};

const apiJob = serializeJobSummary(rawJob);
assert.strictEqual(apiJob.resultStatus, 'incomplete_result');
assert.strictEqual(apiJob.unaccountedSiteCount, null);
assert.strictEqual(apiJob.error.details.sitesWithoutConfirmedResultCount, null);
assert.strictEqual(
  apiJob.error.message,
  'Result reconciliation could not be completed. The number of sites without confirmed result could not be determined.'
);
assert.ok(!apiJob.error.message.includes('0 sites have no confirmed result'));

const llmError = sanitizeWorkerErrorForLlm(rawJob);
assert.strictEqual(llmError.details.sitesWithoutConfirmedResultCount, null);
assert.strictEqual(
  llmError.message,
  'Result reconciliation could not be completed. The number of sites without confirmed result could not be determined.'
);

console.log('Issue 88 unknown reconciliation count regression test passed.');