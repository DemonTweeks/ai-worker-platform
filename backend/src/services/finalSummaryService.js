const { Job } = require('../models');
const { buildFinalSummaryWording } = require('../llm/finalSummaryWordingService');
const { WORKER_IDS } = require('../workers/workerTypes');

const buildFinalSummary = ({ job, summary }) => {
  if (job.status === 'failed') {
    return `Task failed. ${job.error && job.error.message ? job.error.message : 'Please review the job error details before retrying.'}`;
  }

  if (job.status === 'cancelled' || job.status === 'cancelled_with_partial_result') {
    return 'Task cancelled. Any completed partial output files have been preserved where available.';
  }

  if (job.workerId === WORKER_IDS.PR_AUDITOR) {
    const auditSummary = summary.auditSummary;
    const hasAuditReport = (summary.outputFileCount || 0) > 0;

    if (!hasAuditReport) {
      return [
        'No audit report was generated.',
        '',
        'Audit summary counts are unavailable.'
      ].join('\n');
    }

    if (auditSummary) {
      return [
        'Audit report generated.',
        '',
        `Normal: ${auditSummary.normalCount}`,
        `Invalid PO: ${auditSummary.invalidPoCount}`,
        `Wrong PO: ${auditSummary.wrongPoCount}`,
        `Duplicate PO: ${auditSummary.duplicatePoCount}`,
        `Review Required: ${auditSummary.reviewRequiredCount}`,
        `Warnings: ${auditSummary.warnings.length}`,
        '',
        'Download Audit Report from the job detail page.'
      ].join('\n');
    }

    return [
      'Audit report generated.',
      '',
      'Detailed findings are available in the workbook.',
      '',
      'Download Audit Report from the job detail page.'
    ].join('\n');
  }

  const noEccExplanation = (summary.matchedSiteCount || 0) > 0 && (summary.outputFileCount || 0) === 0
    ? [
      '',
      (summary.reviewRequiredCount || 0) > 0 || (summary.warningCount || 0) > 0
        ? `No ECC files were generated because matched sites produced ${summary.reviewRequiredCount || 0} review-required item(s) and ${summary.warningCount || 0} warning item(s).`
        : 'No ECC files were generated, and no review-required or warning records explained the zero-output result.'
    ].join('\n')
    : '';

  return [
    job.status === 'completed_with_warning' ? 'Task completed with warnings.' : 'Task completed.',
    '',
    `Requested sites: ${summary.requestedSiteCount}`,
    `Matched sites: ${summary.matchedSiteCount}`,
    `Unmatched sites: ${summary.unmatchedSiteCount}`,
    `Generated output files: ${summary.outputFileCount}`,
    `Review Required items: ${summary.reviewRequiredCount}`,
    `Warnings: ${summary.warningCount}`,
    noEccExplanation,
    '',
    'You can download the available output files from the job detail page.'
  ].filter((line) => line !== null && line !== undefined).join('\n');
};

const saveFinalSummary = async ({ jobId, summary, statusOverride }) => {
  const job = await Job.findOne({ jobId });
  const summaryJob = statusOverride ? { ...job, status: statusOverride } : job;
  const deterministicSummary = buildFinalSummary({
    job: summaryJob,
    summary
  });
  const wording = await buildFinalSummaryWording({ job: summaryJob, summary, deterministicSummary });
  const finalWorkerSummary = wording.aiSummary;
  job.finalWorkerSummary = finalWorkerSummary;
  await job.save();
  return finalWorkerSummary;
};

module.exports = {
  buildFinalSummary,
  saveFinalSummary
};
