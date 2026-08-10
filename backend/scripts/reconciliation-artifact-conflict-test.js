const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  discoverWorkerReconciliation,
  fromEngineContract
} = require('../src/services/resultReconciliationService');
const storageService = require('../src/services/storageService');

const contract = {
  requested_count: 24,
  generated_count: 8,
  review_required_count: 16,
  approved_ignored_count: 0,
  duplicate_blocked_count: 0,
  failed_count: 0,
  unaccounted_count: 0
};

assert.throws(
  () => fromEngineContract({ ...contract, generatedSiteCount: 24 }),
  (error) => error
    && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
    && error.details
    && error.details.reason === 'CONFLICTING_COUNT_ALIASES',
  'conflicting snake/camel aliases for one count must fail closed'
);

const run = async () => {
  const storageRoot = storageService.getStorageRoot();
  const testRoot = path.join(storageRoot, 'temp', 'issue-88-multiple-contract-test');
  const firstPath = path.join(testRoot, 'first.json');
  const identicalPath = path.join(testRoot, 'identical.json');
  const conflictingPath = path.join(testRoot, 'conflicting.json');
  await fs.promises.mkdir(testRoot, { recursive: true });

  try {
    await fs.promises.writeFile(firstPath, JSON.stringify({ result_reconciliation: contract }), 'utf8');
    await fs.promises.writeFile(identicalPath, JSON.stringify({ resultReconciliation: contract }), 'utf8');
    await fs.promises.writeFile(
      conflictingPath,
      JSON.stringify({
        result_reconciliation: {
          ...contract,
          generated_count: 24,
          review_required_count: 0
        }
      }),
      'utf8'
    );

    const identical = await discoverWorkerReconciliation({
      outputFiles: [
        { fileName: 'first.json', filePath: path.relative(storageRoot, firstPath) },
        { fileName: 'identical.json', filePath: path.relative(storageRoot, identicalPath) }
      ]
    });
    assert.deepStrictEqual(identical, {
      requestedSiteCount: 24,
      generatedSiteCount: 8,
      reviewRequiredSiteCount: 16,
      approvedIgnoredSiteCount: 0,
      duplicateBlockedSiteCount: 0,
      failedSiteCount: 0,
      unaccountedSiteCount: 0
    });

    await assert.rejects(
      () => discoverWorkerReconciliation({
        outputFiles: [
          { fileName: 'first.json', filePath: path.relative(storageRoot, firstPath) },
          { fileName: 'conflicting.json', filePath: path.relative(storageRoot, conflictingPath) }
        ]
      }),
      (error) => error
        && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
        && error.details
        && error.details.reason === 'CONFLICTING_RECONCILIATION_ARTIFACTS',
      'all reconciliation-bearing artifacts must be validated and conflicting contracts must fail closed'
    );
  } finally {
    await fs.promises.rm(testRoot, { recursive: true, force: true });
  }
};

run()
  .then(() => console.log('Issue 88 reconciliation artifact conflict regression tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
