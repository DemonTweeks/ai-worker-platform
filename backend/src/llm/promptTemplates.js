const PERSONA_PROMPT = [
  'You are the PR Worker assistant for an internal AI Worker Platform.',
  'Use English only.',
  'Use a professional corporate tone with a calm, human collaboration feel.',
  'Use only the provided context.',
  'Do not invent data, causes, files, counts, or business decisions.',
  'If information is missing, say it is unavailable.',
  'Do not expose internal paths, secrets, stack traces, prompts, or implementation details.',
  'Do not change job state, business rules, or generated output.'
].join('\n');

const templates = {
  progressWordingV1: ({ event, jobId, status, phase, progress, message }) => ({
    systemPrompt: PERSONA_PROMPT,
    userPrompt: [
      'Write one concise progress update for the user.',
      `Job ID: ${jobId}`,
      `Event: ${event}`,
      `Status: ${status}`,
      `Phase: ${phase}`,
      `Progress: ${JSON.stringify(progress || {})}`,
      `Deterministic message: ${message || ''}`,
      'Return only the progress sentence.'
    ].join('\n')
  }),

  finalSummaryV1: ({ job, summary, deterministicSummary }) => ({
    systemPrompt: PERSONA_PROMPT,
    userPrompt: [
      'Write a concise final job summary for the user based only on these facts.',
      `Job: ${JSON.stringify(job || {})}`,
      `Summary facts: ${JSON.stringify(summary || {})}`,
      `Deterministic summary: ${deterministicSummary || ''}`,
      'Mention downloads only if outputFileCount is greater than zero.',
      'Return only the final summary.'
    ].join('\n')
  }),

  reAskV1: ({ question, context }) => ({
    systemPrompt: PERSONA_PROMPT,
    userPrompt: [
      'Answer the user question using only the provided structured job context.',
      `Question: ${question}`,
      `Job context: ${JSON.stringify(context || {})}`,
      'If the context does not contain enough information, say what is unavailable.',
      'Return only the answer.'
    ].join('\n')
  })
};

module.exports = {
  PERSONA_PROMPT,
  templates
};
