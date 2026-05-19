const config = require('../config/env');
const qwenProvider = require('./providers/qwenProvider');
const { LLM_ERROR_CODES } = require('./llmTypes');
const {
  buildLlmError,
  getDisabledResult,
  getNotConfiguredResult,
  isLlmConfigured
} = require('./llmUtils');

const providers = {
  qwen: qwenProvider
};

const generateText = async ({
  task,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 500,
  timeoutMs
}) => {
  if (!config.llm.enabled) {
    return getDisabledResult();
  }

  if (!isLlmConfigured()) {
    return getNotConfiguredResult();
  }

  const provider = providers[config.llm.provider];

  if (!provider) {
    return buildLlmError(
      LLM_ERROR_CODES.NOT_CONFIGURED,
      `Unsupported LLM provider: ${config.llm.provider}.`
    );
  }

  const attempts = Math.max(0, config.llm.maxRetries) + 1;
  let lastResult = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await provider.generateText({
      task,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
      timeoutMs
    });

    if (lastResult.ok) {
      return lastResult;
    }
  }

  return lastResult;
};

module.exports = {
  generateText
};
