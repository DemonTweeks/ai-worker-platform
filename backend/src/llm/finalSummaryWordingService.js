const config = require('../config/env');
const llmClient = require('./llmClient');
const { templates } = require('./promptTemplates');
const { LLM_TASKS } = require('./llmTypes');
const { stripUnsafeText } = require('./llmUtils');
const { buildFinalSummaryFallback } = require('./llmFallbackService');

const buildFinalSummaryWording = async ({ job, summary, deterministicSummary }) => {
  const fallback = buildFinalSummaryFallback({ job, summary, deterministicSummary });

  if (!config.llm.enabled || !config.llm.finalSummaryEnabled) {
    return {
      aiSummary: fallback,
      deterministicSummary,
      summarySource: 'fallback',
      llmStatus: config.llm.enabled ? 'disabled_for_task' : 'disabled'
    };
  }

  const prompts = templates.finalSummaryV1({ job, summary, deterministicSummary });
  const result = await llmClient.generateText({
    task: LLM_TASKS.FINAL_SUMMARY,
    ...prompts,
    temperature: 0.2,
    maxTokens: 350
  });

  if (!result.ok) {
    return {
      aiSummary: fallback,
      deterministicSummary,
      summarySource: 'fallback',
      llmStatus: 'failed',
      llmErrorCode: result.code
    };
  }

  return {
    aiSummary: stripUnsafeText(result.text),
    deterministicSummary,
    summarySource: 'llm',
    llmStatus: 'success'
  };
};

module.exports = {
  buildFinalSummaryWording
};
