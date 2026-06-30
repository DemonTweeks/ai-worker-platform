const config = require('../../config/env');
const { LLM_ERROR_CODES } = require('../llmTypes');
const { buildLlmError, redactSensitive } = require('../llmUtils');

const resolveChatCompletionsUrl = () => {
  const baseUrl = String(config.llm.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) {
    return '';
  }

  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl;
  }

  return `${baseUrl}/chat/completions`;
};

const normalizeUsage = (usage) => {
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens
  };
};

const generateText = async ({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 500,
  timeoutMs = config.llm.timeoutMs
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveChatCompletionsUrl(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      return buildLlmError(
        LLM_ERROR_CODES.PROVIDER_ERROR,
        'LLM provider request failed.',
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    if (!text || typeof text !== 'string') {
      return buildLlmError(LLM_ERROR_CODES.RESPONSE_INVALID, 'LLM provider response was invalid.');
    }

    return {
      ok: true,
      text: text.trim(),
      provider: 'agnes',
      model: data.model || config.llm.model,
      usage: normalizeUsage(data.usage)
    };
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    return buildLlmError(
      isTimeout ? LLM_ERROR_CODES.TIMEOUT : LLM_ERROR_CODES.PROVIDER_ERROR,
      isTimeout ? 'LLM provider request timed out.' : 'LLM provider request failed.',
      { reason: redactSensitive(error.message) }
    );
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  generateText,
  resolveChatCompletionsUrl
};
