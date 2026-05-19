const { Job, ReviewRequiredItem, WarningItem } = require('../models');

const buildAndSaveSummary = async ({ jobId, filteringResult, outputCollection }) => {
  const [reviewRequiredCount, warningCount] = await Promise.all([
    ReviewRequiredItem.countDocuments({ jobId }),
    WarningItem.countDocuments({ jobId })
  ]);

  const update = {
    requestedSiteCount: filteringResult.requestedSiteCount,
    matchedSiteCount: filteringResult.matchedSiteCount,
    unmatchedSiteCount: filteringResult.unmatchedSiteCount,
    outputFileCount: outputCollection.outputFileCount,
    reviewRequiredCount,
    warningCount
  };

  await Job.updateOne({ jobId }, { $set: update });

  return update;
};

module.exports = {
  buildAndSaveSummary
};
