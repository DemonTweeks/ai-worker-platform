const assert = require('assert');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const envModulePath = path.join(projectRoot, 'src', 'config', 'env.js');
const llmClientPath = path.join(projectRoot, 'src', 'llm', 'llmClient.js');
const llmUtilsPath = path.join(projectRoot, 'src', 'llm', 'llmUtils.js');
const reAskServicePath = path.join(projectRoot, 'src', 'llm', 'reAskService.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;
const TEST_AGNES_KEY = '__TEST_AGNES_API_KEY__';
const TEST_QWEN_KEY = '__TEST_QWEN_API_KEY__';

const resetModules = () => {
  [
    envModulePath,
    llmClientPath,
    llmUtilsPath,
    reAskServicePath,
    path.join(projectRoot, 'src', 'llm', 'providers', 'qwenProvider.js'),
    path.join(projectRoot, 'src', 'llm', 'providers', 'agnesProvider.js'),
    path.join(projectRoot, 'src', 'llm', 'promptTemplates.js'),
    path.join(projectRoot, 'src', 'llm', 'llmFallbackService.js'),
    path.join(projectRoot, 'src', 'llm', 'llmTypes.js')
  ].forEach((modulePath) => {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (_error) {
      // Ignore modules that do not exist yet.
    }
  });
};

const withEnv = (overrides) => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, ORIGINAL_ENV, overrides);
  resetModules();
};

const loadLlmClient = () => require(llmClientPath);
const loadLlmUtils = () => require(llmUtilsPath);
const loadReAskService = () => require(reAskServicePath);

const createJsonResponse = ({ ok = true, status = 200, jsonBody }) => ({
  ok,
  status,
  async json() {
    return jsonBody;
  }
});

const run = async () => {
  try {
    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-model',
      LLM_TIMEOUT_MS: '25',
      LLM_MAX_RETRIES: '0'
    });

    let fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return createJsonResponse({
        jsonBody: {
          model: 'agnes-model-response',
          choices: [
            {
              message: {
                content: '  Agnes says hello.  '
              }
            }
          ],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 7,
            total_tokens: 18
          }
        }
      });
    };

    const llmClient = loadLlmClient();
    const agnesResult = await llmClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });

    assert.strictEqual(agnesResult.ok, true, 'Agnes provider should be selectable through the shared client');
    assert.strictEqual(agnesResult.provider, 'agnes');
    assert.strictEqual(agnesResult.model, 'agnes-model-response');
    assert.strictEqual(agnesResult.text, 'Agnes says hello.');
    assert.deepStrictEqual(agnesResult.usage, {
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18
    });
    assert.strictEqual(fetchCalls[0].url, 'https://agnes.example.test/v1/chat/completions');
    assert.strictEqual(fetchCalls[0].options.headers.Authorization, `Bearer ${TEST_AGNES_KEY}`);

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1/chat/completions',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-model',
      LLM_TIMEOUT_MS: '25',
      LLM_MAX_RETRIES: '0'
    });

    fetchCalls = [];
    global.fetch = async (url) => {
      fetchCalls.push(url);
      return createJsonResponse({
        jsonBody: {
          choices: [
            {
              message: {
                content: 'Direct path'
              }
            }
          ],
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            total_tokens: 2
          }
        }
      });
    };

    const secondClient = loadLlmClient();
    const directUrlResult = await secondClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });
    assert.strictEqual(directUrlResult.ok, true);
    assert.strictEqual(fetchCalls[0], 'https://agnes.example.test/v1/chat/completions');

    withEnv({
      LLM_ENABLED: 'false',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: '',
      LLM_API_KEY: '',
      LLM_MODEL: ''
    });

    const disabledClient = loadLlmClient();
    const disabledResult = await disabledClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });
    assert.strictEqual(disabledResult.ok, false);
    assert.strictEqual(disabledResult.code, 'LLM_DISABLED');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: '',
      LLM_API_KEY: '',
      LLM_MODEL: ''
    });

    const notConfiguredClient = loadLlmClient();
    const notConfiguredResult = await notConfiguredClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });
    assert.strictEqual(notConfiguredResult.ok, false);
    assert.strictEqual(notConfiguredResult.code, 'LLM_NOT_CONFIGURED');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-model',
      LLM_TIMEOUT_MS: '25',
      LLM_MAX_RETRIES: '0'
    });

    const statusCodes = [401, 403, 429, 503];
    for (const status of statusCodes) {
      global.fetch = async () => createJsonResponse({ ok: false, status, jsonBody: {} });
      const client = loadLlmClient();
      const result = await client.generateText({
        task: 'reask',
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt'
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, 'LLM_PROVIDER_ERROR');
      assert.strictEqual(result.details.status, status);
    }

    global.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { choices: [] };
      }
    });
    const malformedClient = loadLlmClient();
    const malformedResult = await malformedClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });
    assert.strictEqual(malformedResult.ok, false);
    assert.strictEqual(malformedResult.code, 'LLM_RESPONSE_INVALID');

    global.fetch = async () => {
      const error = new Error(`request failed with Bearer ${TEST_AGNES_KEY}`);
      error.name = 'NetworkError';
      throw error;
    };
    const networkClient = loadLlmClient();
    const networkResult = await networkClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });
    assert.strictEqual(networkResult.ok, false);
    assert.strictEqual(networkResult.code, 'LLM_PROVIDER_ERROR');
    assert.ok(networkResult.details.reason.includes('[REDACTED]'));
    assert.ok(!networkResult.details.reason.includes(TEST_AGNES_KEY));

    global.fetch = async (_url, options) => {
      options.signal.dispatchEvent(new Event('abort'));
      const abortError = new Error('Timed out');
      abortError.name = 'AbortError';
      throw abortError;
    };
    const timeoutClient = loadLlmClient();
    const timeoutResult = await timeoutClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt',
      timeoutMs: 1
    });
    assert.strictEqual(timeoutResult.ok, false);
    assert.strictEqual(timeoutResult.code, 'LLM_TIMEOUT');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'qwen',
      LLM_BASE_URL: 'https://qwen.example.test/v1',
      LLM_API_KEY: TEST_QWEN_KEY,
      LLM_MODEL: 'qwen-model',
      LLM_TIMEOUT_MS: '25',
      LLM_MAX_RETRIES: '0'
    });
    global.fetch = async (url) => {
      assert.strictEqual(url, 'https://qwen.example.test/v1/chat/completions');
      return createJsonResponse({
        jsonBody: {
          choices: [
            {
              message: {
                content: 'Qwen still works'
              }
            }
          ],
          usage: {
            prompt_tokens: 2,
            completion_tokens: 3,
            total_tokens: 5
          }
        }
      });
    };
    const qwenClient = loadLlmClient();
    const qwenResult = await qwenClient.generateText({
      task: 'reask',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt'
    });
    assert.strictEqual(qwenResult.ok, true);
    assert.strictEqual(qwenResult.provider, 'qwen');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_REASK_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-model',
      LLM_TIMEOUT_MS: '25',
      LLM_MAX_RETRIES: '0'
    });

    const jobContextServicePath = path.join(projectRoot, 'src', 'services', 'jobContextService.js');
    delete require.cache[require.resolve(jobContextServicePath)];
    require.cache[require.resolve(jobContextServicePath)] = {
      id: jobContextServicePath,
      filename: jobContextServicePath,
      loaded: true,
      exports: {
        buildSafeJobContext: async () => ({
          job: { status: 'completed' },
          summary: 'summary',
          warnings: [],
          reviewRequiredItems: [],
          outputs: []
        })
      }
    };

    global.fetch = async () => createJsonResponse({
      jsonBody: {
        choices: [
          {
            message: {
              content: 'Agnes answer'
            }
          }
        ],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5
        }
      }
    });

    const { answerReAsk } = loadReAskService();
    const reAskResult = await answerReAsk('JOB-1', 'Why?');
    assert.strictEqual(reAskResult.answerSource, 'llm');
    assert.strictEqual(reAskResult.llmStatus, 'success');
    assert.strictEqual(reAskResult.answer, 'Agnes answer');

    const { redactSensitive } = loadLlmUtils();
    const redacted = redactSensitive(`Bearer ${TEST_AGNES_KEY} and ${TEST_AGNES_KEY}`);
    assert.ok(redacted.includes('[REDACTED]'));
    assert.ok(!redacted.includes(TEST_AGNES_KEY));

    console.log(JSON.stringify({
      ok: true,
      checks: [
        'agnes_success',
        'base_url_normalization',
        'disabled_configuration',
        'incomplete_configuration',
        'http_error_mapping',
        'malformed_response',
        'network_redaction',
        'timeout_mapping',
        'qwen_regression',
        'agnes_reask_caller_path'
      ]
    }));
  } finally {
    global.fetch = ORIGINAL_FETCH;
    withEnv({});
  }
};

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
