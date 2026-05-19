const config = require('../config/env');
const { createApiError } = require('../utils/apiError');
const { buildSafeJobContext } = require('../services/jobContextService');
const llmClient = require('./llmClient');
const { templates } = require('./promptTemplates');
const { LLM_TASKS } = require('./llmTypes');
const { stripUnsafeText } = require('./llmUtils');
const { buildReAskFallback } = require('./llmFallbackService');

const answerReAsk = async (jobId, question) => {
  const normalizedQuestion = String(question || '').trim();

  if (!normalizedQuestion) {
    throw createApiError(400, 'VALIDATION_ERROR', 'question is required.');
  }

  if (normalizedQuestion.length > 2000) {
    throw createApiError(400, 'VALIDATION_ERROR', 'question is too long.');
  }

  const context = await buildSafeJobContext(jobId);

  if (!context) {
    throw createApiError(404, 'JOB_NOT_FOUND', 'Job was not found.');
  }

  const fallback = buildReAskFallback({ question: normalizedQuestion, context });

  if (!config.llm.enabled || !config.llm.reAskEnabled) {
    return {
      jobId,
      question: normalizedQuestion,
      answer: fallback,
      answerSource: 'fallback',
      llmStatus: config.llm.enabled ? 'disabled_for_task' : 'disabled',
      contextUsed: {
        jobState: true,
        summary: true,
        warnings: true,
        reviewRequired: true,
        outputs: true
      }
    };
  }

  const prompts = templates.reAskV1({ question: normalizedQuestion, context });
  const result = await llmClient.generateText({
    task: LLM_TASKS.REASK,
    ...prompts,
    temperature: 0.2,
    maxTokens: 700
  });

  if (!result.ok) {
    return {
      jobId,
      question: normalizedQuestion,
      answer: buildReAskFallback({ question: normalizedQuestion, context, reason: 'failed' }),
      answerSource: 'fallback',
      llmStatus: 'failed',
      llmErrorCode: result.code,
      contextUsed: {
        jobState: true,
        summary: true,
        warnings: true,
        reviewRequired: true,
        outputs: true
      }
    };
  }

  return {
    jobId,
    question: normalizedQuestion,
    answer: stripUnsafeText(result.text),
    answerSource: 'llm',
    llmStatus: 'success',
    contextUsed: {
      jobState: true,
      summary: true,
      warnings: true,
      reviewRequired: true,
      outputs: true
    }
  };
};

module.exports = {
  answerReAsk
};
