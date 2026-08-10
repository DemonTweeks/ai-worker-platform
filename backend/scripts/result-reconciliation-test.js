const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { determineFinalStatus } = require('../src/services/zeroOutputPolicyService');
const {
  discoverWorkerReconciliation,
  fromEngineContract
} = require('../src/services/resultReconciliationService');
const { serializeJobSummary } = require('../src/services/jobService');
const storageService = require('../src/services/storageService');

const validEngineContract = {
  requested_count: 24,
  generated_count: 8,
  review_required_count: 16,
  approved_ignored_count: 0,
  duplicate_blocked_count: 0,
  failed_count: 0,
  unaccounted_count: 0
};

const mappedContract = fromEngineContract(validEngineContract);
assert.deepStrictEqual(mappedContract, {
  requestedSiteCount: 24,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 16,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
});

for (const [label, contract] of [
  ['negative', { ...validEngineContract, failed_count: -1 }],
  ['fractional', { ...validEngineContract, generated_count: 8.5 }],
  ['nonnumeric', { ...validEngineContract, generated_count: '8' }],
  ['missing', (() => { const value = { ...validEngineContract }; delete value.failed_count; return value; })()]
]) {
  assert.throws(
    () => fromEngineContract(contract),
    (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE',
    `${label} reconciliation count must fail closed`
  );
}

const baseSummary = {
  requestedSiteCount: 24,
  matchedSiteCount: 24,
  unmatchedSiteCount: 0,
  outputFileCount: 1,
  reviewRequiredCount: 0,
  warningCount: 0
};

assert.strictEqual(
  determineFinalStatus(baseSummary),
  'completed',
  'legacy jobs without reconciliation metadata should retain existing completion behavior'
);

const fullyReconciled = {
  ...baseSummary,
  generatedSiteCount: 24,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  unaccountedSiteCount: 0
};
assert.strictEqual(determineFinalStatus(fullyReconciled), 'completed');

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
assert.strictEqual(determineFinalStatus(partialWithReview), 'completed_with_warning');

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
  (error) => error
    && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
    && error.message === '8 of 24 requested sites generated. 16 sites have no confirmed result.'
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
  (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
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
assert.strictEqual(determineFinalStatus(withPlatformUnmatchedSites), 'completed_with_warning');

const apiJob = serializeJobSummary({
  jobId: 'PR-ISSUE88-API',
  workerId: 'mw-pr',
  workerType: 'pr-worker',
  status: 'failed',
  error: {
    code: 'RESULT_RECONCILIATION_INCOMPLETE',
    message: 'raw internal message',
    details: {
      stderr: 'SECRET_TOKEN=should-not-leak C:\\secret\\worker.log',
      arbitraryRawDetail: 'do-not-expose'
    }
  },
  requestedSiteCount: 24,
  matchedSiteCount: 24,
  unmatchedSiteCount: 0,
  outputFileCount: 1,
  reviewRequiredCount: 0,
  warningCount: 0,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  accountedSiteCount: 8,
  unaccountedSiteCount: 16,
  reconciliationConsistent: false
});

assert.strictEqual(apiJob.resultStatus, 'incomplete_result');
assert.strictEqual(apiJob.error.code, 'RESULT_RECONCILIATION_INCOMPLETE');
assert.strictEqual(apiJob.error.category, 'RESULT_INCOMPLETE');
assert.strictEqual(apiJob.error.title, 'Incomplete Result');
assert.strictEqual(apiJob.error.message, '8 of 24 requested sites generated. 16 sites have no confirmed result.');
assert.strictEqual(apiJob.generatedSiteCount, 8);
assert.strictEqual(apiJob.accountedSiteCount, 8);
assert.strictEqual(apiJob.unaccountedSiteCount, 16);
assert.deepStrictEqual(apiJob.error.details, {
  requestedSiteCount: 24,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 0,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  sitesWithoutConfirmedResultCount: 16
});
assert.ok(!JSON.stringify(apiJob).includes('SECRET_TOKEN'));
assert.ok(!JSON.stringify(apiJob).includes('arbitraryRawDetail'));
assert.ok(!JSON.stringify(apiJob).includes('worker.log'));

const ordinaryFailure = serializeJobSummary({
  jobId: 'PR-ISSUE88-FAIL',
  workerId: 'mw-pr',
  workerType: 'pr-worker',
  status: 'failed',
  error: { code: 'WORKER_TIMEOUT', details: { scope: 'TI' } }
});
assert.strictEqual(ordinaryFailure.resultStatus, null);
assert.strictEqual(ordinaryFailure.error.code, 'WORKER_TIMEOUT');
assert.notStrictEqual(ordinaryFailure.error.title, 'Incomplete Result');

const runDiscoveryTests = async () => {
  const storageRoot = storageService.getStorageRoot();
  const testRoot = path.join(storageRoot, 'temp', 'issue-88-reconciliation-test');
  const validPath = path.join(testRoot, 'valid-summary.json');
  const invalidPath = path.join(testRoot, 'invalid-summary.json');
  const oversizedContractPath = path.join(testRoot, 'oversized-contract.json');
  const oversizedUnrelatedPath = path.join(testRoot, 'oversized-unrelated.json');

  await fs.promises.mkdir(testRoot, { recursive: true });
  try {
    await fs.promises.writeFile(validPath, JSON.stringify({ result_reconciliation: validEngineContract }), 'utf8');
    const discovered = await discoverWorkerReconciliation({
      outputFiles: [{ fileName: 'valid-summary.json', filePath: path.relative(storageRoot, validPath) }]
    });
    assert.deepStrictEqual(discovered, mappedContract);

    await fs.promises.writeFile(invalidPath, JSON.stringify({ result_reconciliation: {} }), 'utf8');
    await assert.rejects(
      () => discoverWorkerReconciliation({
        outputFiles: [{ fileName: 'invalid-summary.json', filePath: path.relative(storageRoot, invalidPath) }]
      }),
      (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
    );

    const padding = 'x'.repeat(1024 * 1024 + 4096);
    await fs.promises.writeFile(
      oversizedContractPath,
      JSON.stringify({ padding, result_reconciliation: validEngineContract }),
      'utf8'
    );
    await assert.rejects(
      () => discoverWorkerReconciliation({
        outputFiles: [{ fileName: 'oversized-contract.json', filePath: path.relative(storageRoot, oversizedContractPath) }]
      }),
      (error) => error
        && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
        && error.details
        && error.details.reason === 'OVERSIZED_CONTRACT_ARTIFACT',
      'oversized JSON that contains a reconciliation marker must fail closed'
    );

    await fs.promises.writeFile(oversizedUnrelatedPath, JSON.stringify({ padding }), 'utf8');
    const unrelated = await discoverWorkerReconciliation({
      outputFiles: [{ fileName: 'oversized-unrelated.json', filePath: path.relative(storageRoot, oversizedUnrelatedPath) }]
    });
    assert.strictEqual(unrelated, null, 'oversized unrelated JSON should remain a normal artifact');
  } finally {
    await fs.promises.rm(testRoot, { recursive: true, force: true });
  }
};

runDiscoveryTests()
  .then(() => console.log('Issue 88 result reconciliation regression tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
