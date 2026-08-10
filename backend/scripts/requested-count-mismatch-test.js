const assert = require('assert');
const { buildAndSaveSummary } = require('../src/services/summaryBuilder');
const { Job, ReviewRequiredItem, WarningItem } = require('../src/models');

const run = async () => {
  const originals = {
    jobFindOne: Job.findOne,
    jobUpdateOne: Job.updateOne,
    reviewCountDocuments: ReviewRequiredItem.countDocuments,
    warningCountDocuments: WarningItem.countDocuments
  };
  const updates = [];

  ReviewRequiredItem.countDocuments = async () => 0;
  WarningItem.countDocuments = async () => 0;
  Job.findOne = () => ({ lean: () => Promise.resolve({ status: 'running' }) });
  Job.updateOne = async (filter, update) => {
    updates.push({ filter, update });
    return { acknowledged: true, modifiedCount: 1 };
  };

  try {
    await assert.rejects(
      () => buildAndSaveSummary({
        jobId: 'PR-ISSUE88-REQUESTED-MISMATCH',
        filteringResult: {
          requestedSiteCount: 24,
          matchedSiteCount: 24,
          matchedSiteCodes: Array.from({ length: 24 }, (_, index) => `SITE-${index + 1}`),
          unmatchedSiteCount: 0
        },
        outputCollection: {
          outputFileCount: 1,
          outputFiles: []
        },
        workerReconciliation: {
          requestedSiteCount: 8,
          generatedSiteCount: 8,
          reviewRequiredSiteCount: 0,
          approvedIgnoredSiteCount: 0,
          duplicateBlockedSiteCount: 0,
          failedSiteCount: 0,
          unaccountedSiteCount: 0
        }
      }),
      (error) => error
        && error.code === 'RESULT_RECONCILIATION_INCOMPLETE'
        && error.details
        && error.details.reason === 'REQUESTED_COUNT_MISMATCH'
        && error.details.platformRequestedSiteCount === 24
        && error.details.workerRequestedSiteCount === 8,
      'worker/platform requested-site mismatch must fail closed before authoritative override'
    );

    assert.strictEqual(updates.length, 1, 'base metrics should remain persisted before mismatch failure');
    assert.strictEqual(updates[0].update.$set.requestedSiteCount, 24);

    console.log('Issue 88 requested-count mismatch regression test passed.');
  } finally {
    Job.findOne = originals.jobFindOne;
    Job.updateOne = originals.jobUpdateOne;
    ReviewRequiredItem.countDocuments = originals.reviewCountDocuments;
    WarningItem.countDocuments = originals.warningCountDocuments;
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
