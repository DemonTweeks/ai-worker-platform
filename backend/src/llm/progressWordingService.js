const config = require('../config/env');
const llmClient = require('./llmClient');
const { templates } = require('./promptTemplates');
const { LLM_TASKS } = require('./llmTypes');
const { stripUnsafeText } = require('./llmUtils');
const { buildProgressFallback } = require('./llmFallbackService');

const buildProgressWording = async (eventPayload) => {
  const fallback = buildProgressFallback(eventPayload);

  if (!config.llm.enabled || !config.llm.progressWordingEnabled) {
    return {
      aiMessage: fallback,
      messageSource: 'fallback',
      llmStatus: config.llm.enabled ? 'disabled_for_task' : 'disabled'
    };
  }

  const prompts = templates.progressWordingV1(eventPayload);
  const result = await llmClient.generateText({
    task: LLM_TASKS.PROGRESS_WORDING,
    ...prompts,
    temperature: 0.2,
    maxTokens: 120,
    timeoutMs: Math.min(config.llm.timeoutMs, 3000)
  });

  if (!result.ok) {
    return {
      aiMessage: fallback,
      messageSource: 'fallback',
      llmStatus: 'failed',
      llmErrorCode: result.code
    };
  }

  return {
    aiMessage: stripUnsafeText(result.text),
    messageSource: 'llm',
    llmStatus: 'success'
  };
};

module.exports = {
  buildProgressWording
};
