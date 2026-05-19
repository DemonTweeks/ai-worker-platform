const { stripUnsafeText } = require('./llmUtils');

const buildProgressFallback = ({ event, status, phase, message, progress }) => {
  const cleanMessage = stripUnsafeText(message);
  if (cleanMessage) {
    return cleanMessage;
  }

  const rowText = progress && Number.isFinite(progress.totalRows) && progress.totalRows > 0
    ? ` ${progress.processedRows || 0}/${progress.totalRows} rows are reflected in the current progress.`
    : '';

  return `PR Worker update: ${event || phase || status || 'job progress updated'}.${rowText}`;
};

const buildFinalSummaryFallback = ({ job = {}, summary = {}, deterministicSummary = '' }) => {
  if (deterministicSummary) {
    return stripUnsafeText(deterministicSummary);
  }

  if (job.status === 'failed') {
    return `Task failed. ${job.error && job.error.message ? stripUnsafeText(job.error.message) : 'Please review the job error details before retrying.'}`;
  }

  if (job.status === 'cancelled' || job.status === 'cancelled_with_partial_result') {
    return 'Task cancelled. Any completed partial output files have been preserved where available.';
  }

  return [
    'Task completed.',
    `Requested sites: ${summary.requestedSiteCount || 0}`,
    `Matched sites: ${summary.matchedSiteCount || 0}`,
    `Unmatched sites: ${summary.unmatchedSiteCount || 0}`,
    `Generated output files: ${summary.outputFileCount || 0}`,
    `Review Required items: ${summary.reviewRequiredCount || 0}`,
    `Warnings: ${summary.warningCount || 0}`
  ].join('\n');
};

const buildReAskFallback = ({ question, context = {}, reason = 'disabled' }) => {
  const job = context.job || {};
  const summary = context.summary || {};
  const warningCount = Array.isArray(context.warnings) ? context.warnings.length : 0;
  const reviewCount = Array.isArray(context.reviewRequiredItems) ? context.reviewRequiredItems.length : 0;
  const fileCount = Array.isArray(context.outputs) ? context.outputs.length : 0;
  const reasonText = reason === 'failed'
    ? 'The AI wording service is unavailable, so I can only summarize the structured job data.'
    : 'The AI wording service is disabled, so I can only summarize the structured job data.';

  return [
    reasonText,
    `Question received: ${stripUnsafeText(question)}`,
    `Job ${job.jobId || 'unknown'} is currently ${job.status || 'unknown'}.`,
    `Summary: ${summary.matchedSiteCount || 0} matched sites, ${summary.unmatchedSiteCount || 0} unmatched sites, ${summary.outputFileCount || 0} output files, ${warningCount} warnings, and ${reviewCount} review-required items.`,
    `Tracked output files available in context: ${fileCount}.`,
    'A detailed natural-language answer requires the configured MaaS/Qwen LLM service.'
  ].join('\n');
};

module.exports = {
  buildFinalSummaryFallback,
  buildProgressFallback,
  buildReAskFallback
};
