const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildAndSaveSummary } = require('../src/services/summaryBuilder');
const { Job, ReviewRequiredItem, WarningItem } = require('../src/models');
const storageService = require('../src/services/storageService');

const run = async () => {
  const storageRoot = storageService.getStorageRoot();
  const testRoot = path.join(storageRoot, 'temp', 'issue-88-summary-persistence-test');
  const malformedContractPath = path.join(testRoot, 'malformed-contract.json');
  const originals = {
    jobFindOne: Job.findOne,
    jobUpdateOne: Job.updateOne,
    reviewCountDocuments: ReviewRequiredItem.countDocuments,
    warningCountDocuments: WarningItem.countDocuments
  };
  const updates = [];

  await fs.promises.mkdir(testRoot, { recursive: true });
  await fs.promises.writeFile(
    malformedContractPath,
    '{"result_reconciliation":{"requested_count":24,',
    'utf8'
  );

  ReviewRequiredItem.countDocuments = async () => 0;
  WarningItem.countDocuments = async () => 0;
  Job.findOne = () => ({
    lean: () => Promise.resolve({ status: 'running' })
  });
  Job.updateOne = async (filter, update) => {
    updates.push({ filter, update });
    return { acknowledged: true, modifiedCount: 1 };
  };

  const filteringResult = {
    requestedSiteCount: 24,
    matchedSiteCount: 24,
    matchedSiteCodes: Array.from({ length: 24 }, (_, index) => `SITE-${index + 1}`),
    unmatchedSiteCount: 0
  };
  const outputCollection = {
    outputFileCount: 1,
    outputFiles: [{
      fileName: 'malformed-contract.json',
      filePath: path.relative(storageRoot, malformedContractPath)
    }]
  };

  try {
    await assert.rejects(
      () => buildAndSaveSummary({
        jobId: 'PR-ISSUE88-PERSIST-BEFORE-DISCOVERY',
        filteringResult,
        outputCollection
      }),
      (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
    );

    assert.strictEqual(
      updates.length,
      1,
      'base collection metrics must be persisted before strict reconciliation discovery can fail'
    );
    assert.strictEqual(updates[0].update.$set.outputFileCount, 1);
    assert.strictEqual(updates[0].update.$set.requestedSiteCount, 24);
    assert.strictEqual(updates[0].update.$set.matchedSiteCount, 24);
    assert.strictEqual(updates[0].update.$set.unmatchedSiteCount, 0);

    updates.length = 0;
    await assert.rejects(
      () => buildAndSaveSummary({
        jobId: 'PR-ISSUE88-DIRECT-INVALID-RECONCILIATION',
        filteringResult,
        outputCollection: { outputFileCount: 1, outputFiles: [] },
        workerReconciliation: {
          requestedSiteCount: 24,
          generatedSiteCount: 24,
          reviewRequiredSiteCount: 0,
          approvedIgnoredSiteCount: 0,
          duplicateBlockedSiteCount: 0,
          failedSiteCount: -1,
          unaccountedSiteCount: 0
        }
      }),
      (error) => error && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
    );
    assert.strictEqual(
      updates.length,
      1,
      'base metrics must remain persisted even when direct reconciliation validation fails'
    );
    assert.strictEqual(updates[0].update.$set.outputFileCount, 1);

    console.log('Issue 88 summary persistence ordering regression test passed.');
  } finally {
    Job.findOne = originals.jobFindOne;
    Job.updateOne = originals.jobUpdateOne;
    ReviewRequiredItem.countDocuments = originals.reviewCountDocuments;
    WarningItem.countDocuments = originals.warningCountDocuments;
    await fs.promises.rm(testRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});