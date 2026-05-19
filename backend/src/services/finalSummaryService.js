const { Job } = require('../models');
const { buildFinalSummaryWording } = require('../llm/finalSummaryWordingService');

const buildFinalSummary = ({ job, summary }) => {
  if (job.status === 'failed') {
    return `Task failed. ${job.error && job.error.message ? job.error.message : 'Please review the job error details before retrying.'}`;
  }

  if (job.status === 'cancelled' || job.status === 'cancelled_with_partial_result') {
    return 'Task cancelled. Any completed partial output files have been preserved where available.';
  }

  return [
    'Task completed.',
    '',
    `Requested sites: ${summary.requestedSiteCount}`,
    `Matched sites: ${summary.matchedSiteCount}`,
    `Unmatched sites: ${summary.unmatchedSiteCount}`,
    `Generated output files: ${summary.outputFileCount}`,
    `Review Required items: ${summary.reviewRequiredCount}`,
    `Warnings: ${summary.warningCount}`,
    '',
    'You can download the available output files from the job detail page.'
  ].join('\n');
};

const saveFinalSummary = async ({ jobId, summary }) => {
  const job = await Job.findOne({ jobId });
  const deterministicSummary = buildFinalSummary({ job, summary });
  const wording = await buildFinalSummaryWording({ job, summary, deterministicSummary });
  const finalWorkerSummary = wording.aiSummary;
  job.finalWorkerSummary = finalWorkerSummary;
  await job.save();
  return finalWorkerSummary;
};

module.exports = {
  buildFinalSummary,
  saveFinalSummary
};
