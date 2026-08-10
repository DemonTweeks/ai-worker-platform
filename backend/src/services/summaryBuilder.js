const { Job, ReviewRequiredItem, WarningItem } = require('../models');
const {
  discoverWorkerReconciliation,
  toPersistedReconciliation
} = require('./resultReconciliationService');

const isCancellationStatus = (status) => (
  status === 'cancelling'
  || status === 'cancelled'
  || status === 'cancelled_with_partial_result'
);

const buildAndSaveSummary = async ({
  jobId,
  filteringResult,
  outputCollection,
  workerReconciliation = null,
  discoverReconciliation = true
}) => {
  const [reviewRequiredCount, warningCount, currentJob] = await Promise.all([
    ReviewRequiredItem.countDocuments({ jobId }),
    WarningItem.countDocuments({ jobId }),
    Job.findOne({ jobId }).lean().catch(() => null)
  ]);

  const baseSummary = {
    requestedSiteCount: filteringResult.requestedSiteCount,
    matchedSiteCount: filteringResult.matchedSiteCount,
    matchedSiteCodes: filteringResult.matchedSiteCodes || [],
    unmatchedSiteCount: filteringResult.unmatchedSiteCount,
    outputFileCount: outputCollection.outputFileCount,
    reviewRequiredCount,
    warningCount
  };

  const shouldDiscoverReconciliation = discoverReconciliation
    && !isCancellationStatus(currentJob && currentJob.status);
  const discoveredReconciliation = workerReconciliation || (
    shouldDiscoverReconciliation ? await discoverWorkerReconciliation(outputCollection) : null
  );
  const reconciliationSummary = discoveredReconciliation
    ? {
      ...discoveredReconciliation,
      ...baseSummary
    }
    : baseSummary;

  const update = {
    ...baseSummary,
    ...toPersistedReconciliation(reconciliationSummary)
  };

  await Job.updateOne({ jobId }, { $set: update });

  return update;
};

module.exports = {
  buildAndSaveSummary
};
