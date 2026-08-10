const { Job, ReviewRequiredItem, WarningItem } = require('../models');
const {
  discoverWorkerReconciliation,
  toPersistedReconciliation
} = require('./resultReconciliationService');

const buildAndSaveSummary = async ({ jobId, filteringResult, outputCollection, workerReconciliation = null }) => {
  const [reviewRequiredCount, warningCount] = await Promise.all([
    ReviewRequiredItem.countDocuments({ jobId }),
    WarningItem.countDocuments({ jobId })
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

  const discoveredReconciliation = workerReconciliation || await discoverWorkerReconciliation(outputCollection);
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
