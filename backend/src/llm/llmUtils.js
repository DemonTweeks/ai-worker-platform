const config = require('../config/env');
const { LLM_ERROR_CODES } = require('./llmTypes');

const redactSensitive = (value) => {
  if (!value) {
    return value;
  }

  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(config.llm.apiKey || '__NO_API_KEY__', '[REDACTED]');
};

const isLlmConfigured = () => Boolean(
  config.llm.enabled
  && config.llm.baseUrl
  && config.llm.apiKey
  && config.llm.model
);

const getLlmStatus = () => ({
  enabled: config.llm.enabled,
  provider: config.llm.provider,
  model: config.llm.model || '',
  configured: isLlmConfigured(),
  progressWordingEnabled: config.llm.progressWordingEnabled,
  finalSummaryEnabled: config.llm.finalSummaryEnabled,
  reAskEnabled: config.llm.reAskEnabled
});

const buildLlmError = (code, message, details = {}) => ({
  ok: false,
  code,
  message,
  details
});

const getDisabledResult = () => buildLlmError(
  LLM_ERROR_CODES.DISABLED,
  'LLM is disabled by configuration.'
);

const getNotConfiguredResult = () => buildLlmError(
  LLM_ERROR_CODES.NOT_CONFIGURED,
  'LLM is enabled but provider configuration is incomplete.'
);

const stripUnsafeText = (text = '') => String(text)
  .replace(/[A-Za-z]:\\[^\s"']+/g, '[internal path]')
  .replace(/\/(?:[^/\s"']+\/){2,}[^\s"']+/g, '[internal path]')
  .trim();

module.exports = {
  buildLlmError,
  getDisabledResult,
  getLlmStatus,
  getNotConfiguredResult,
  isLlmConfigured,
  redactSensitive,
  stripUnsafeText
};
