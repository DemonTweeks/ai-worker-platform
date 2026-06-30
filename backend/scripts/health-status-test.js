const assert = require('assert');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const envModulePath = path.join(projectRoot, 'src', 'config', 'env.js');
const healthServicePath = path.join(projectRoot, 'src', 'services', 'healthService.js');
const llmClientPath = path.join(projectRoot, 'src', 'llm', 'llmClient.js');
const llmUtilsPath = path.join(projectRoot, 'src', 'llm', 'llmUtils.js');

const firebaseModulePath = path.join(projectRoot, 'src', 'db', 'firebase.js');
const queueModulePath = path.join(projectRoot, 'src', 'queue', 'jobQueue.js');
const storageServicePath = path.join(projectRoot, 'src', 'services', 'storageService.js');
const cleanupServicePath = path.join(projectRoot, 'src', 'services', 'cleanupService.js');
const websocketServerPath = path.join(projectRoot, 'src', 'websocket', 'server.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;
const TEST_AGNES_KEY = '__TEST_AGNES_HEALTH_KEY__';
const TEST_QWEN_KEY = '__TEST_QWEN_HEALTH_KEY__';

const resetModules = () => {
  [
    envModulePath,
    healthServicePath,
    llmClientPath,
    llmUtilsPath,
    path.join(projectRoot, 'src', 'llm', 'providers', 'agnesProvider.js'),
    path.join(projectRoot, 'src', 'llm', 'providers', 'qwenProvider.js'),
    firebaseModulePath,
    queueModulePath,
    storageServicePath,
    cleanupServicePath,
    websocketServerPath
  ].forEach((modulePath) => {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (_error) {
      // Ignore uncached modules.
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

const setMockModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  };
};

const stubHealthDependencies = () => {
  setMockModule(firebaseModulePath, {
    getFirebaseStatus: () => ({
      lastConnectedAt: '2026-06-30T00:00:00.000Z',
      lastDisconnectedAt: null,
      lastError: null
    }),
    checkFirebaseConnection: async () => ({
      connected: true,
      latencyMs: 12
    })
  });

  setMockModule(queueModulePath, {
    getQueueState: () => ({
      maxConcurrentJobs: 2,
      activeCount: 0,
      queuedCount: 0,
      activeJobIds: [],
      queuedJobIds: []
    })
  });

  setMockModule(storageServicePath, {
    getStorageStatus: () => ({
      exists: true,
      folders: {
        jobs: { exists: true },
        assets: { exists: true },
        outputs: { exists: true },
        temp: { exists: true }
      },
      lastError: null
    }),
    getStorageRoot: () => path.join(projectRoot, 'storage')
  });

  setMockModule(cleanupServicePath, {
    getCleanupStatus: () => ({
      status: 'available',
      retentionDays: 180,
      dryRunSupported: true,
      automaticScheduleEnabled: false,
      lastCleanupRun: null
    })
  });

  setMockModule(websocketServerPath, {
    getWebSocketStatus: () => ({
      status: 'ok',
      connectedClients: 0,
      subscribedJobs: 0,
      heartbeatIntervalMs: 5000
    })
  });
};

const createJsonResponse = ({ ok = true, status = 200, jsonBody }) => ({
  ok,
  status,
  async json() {
    return jsonBody;
  }
});

const loadHealthService = () => require(healthServicePath);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  try {
    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-health-model',
      LLM_TIMEOUT_MS: '30000',
      LLM_MAX_RETRIES: '1'
    });
    stubHealthDependencies();

    let slowAttempts = 0;
    global.fetch = async (_url, options) => {
      slowAttempts += 1;
      await new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const abortError = new Error('Timed out');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    };

    const startedAtMs = Date.now();
    const slowHealth = await loadHealthService().buildHealthResponse();
    const elapsedMs = Date.now() - startedAtMs;
    assert.strictEqual(slowHealth.services.llm.status, 'degraded');
    assert.ok(elapsedMs < 10000, `slow health probes should complete before the frontend 10s timeout budget, got ${elapsedMs}ms`);
    assert.strictEqual(slowAttempts, 1, 'health probes should not amplify retries when the provider is slow or unavailable');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-health-model',
      LLM_TIMEOUT_MS: '30000',
      LLM_MAX_RETRIES: '0'
    });
    stubHealthDependencies();

    let probeRequestBody = null;
    global.fetch = async (_url, options) => {
      probeRequestBody = JSON.parse(options.body);
      await delay(6000);
      return createJsonResponse({
        jsonBody: {
          model: 'agnes-health-model',
          choices: [
            {
              message: {
                content: 'OK'
              }
            }
          ]
        }
      });
    };

    const { buildHealthResponse } = loadHealthService();
    const agnesHealth = await buildHealthResponse();
    assert.strictEqual(agnesHealth.services.llm.status, 'ok', 'Agnes health should stay healthy when the configured provider responds successfully');
    assert.strictEqual(agnesHealth.services.llm.provider, 'agnes');
    assert.strictEqual(agnesHealth.services.llm.configured, true);
    assert.strictEqual(agnesHealth.services.llm.reachable, true);
    assert.ok(probeRequestBody, 'LLM health should issue a provider probe when configured');
    assert.ok(probeRequestBody.max_tokens <= 8, 'LLM health should use a lightweight provider-neutral probe');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'qwen',
      LLM_BASE_URL: 'https://qwen.example.test/v1',
      LLM_API_KEY: TEST_QWEN_KEY,
      LLM_MODEL: 'qwen-health-model',
      LLM_TIMEOUT_MS: '30000',
      LLM_MAX_RETRIES: '0'
    });
    stubHealthDependencies();
    global.fetch = async () => createJsonResponse({
      jsonBody: {
        model: 'qwen-health-model',
        choices: [
          {
            message: {
              content: 'OK'
            }
          }
        ]
      }
    });

    const qwenHealth = await loadHealthService().buildHealthResponse();
    assert.strictEqual(qwenHealth.services.llm.status, 'ok');
    assert.strictEqual(qwenHealth.services.llm.provider, 'qwen');

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: '',
      LLM_API_KEY: '',
      LLM_MODEL: ''
    });
    stubHealthDependencies();
    const incompleteHealth = await loadHealthService().buildHealthResponse();
    assert.strictEqual(incompleteHealth.services.llm.status, 'not_configured');
    assert.strictEqual(incompleteHealth.services.llm.reachable, false);

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'mystery-provider',
      LLM_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'mystery-model',
      LLM_TIMEOUT_MS: '30000',
      LLM_MAX_RETRIES: '0'
    });
    stubHealthDependencies();
    const unknownHealth = await loadHealthService().buildHealthResponse();
    assert.strictEqual(unknownHealth.services.llm.status, 'degraded');
    assert.strictEqual(unknownHealth.services.llm.reachable, false);

    withEnv({
      LLM_ENABLED: 'true',
      LLM_PROVIDER: 'agnes',
      LLM_BASE_URL: 'https://agnes.example.test/v1',
      LLM_API_KEY: TEST_AGNES_KEY,
      LLM_MODEL: 'agnes-health-model',
      LLM_TIMEOUT_MS: '30000',
      LLM_MAX_RETRIES: '0'
    });
    stubHealthDependencies();
    global.fetch = async () => {
      const error = new Error(`Health probe failed with Bearer ${TEST_AGNES_KEY}`);
      error.name = 'NetworkError';
      throw error;
    };

    const redactedHealth = await loadHealthService().buildHealthResponse();
    assert.strictEqual(redactedHealth.services.llm.status, 'degraded');
    assert.ok(redactedHealth.services.llm.lastError, 'LLM health should return a safe error string');
    assert.ok(!redactedHealth.services.llm.lastError.includes(TEST_AGNES_KEY));

    console.log(JSON.stringify({
      ok: true,
      checks: [
        'agnes_health_success',
        'qwen_health_regression',
        'incomplete_health_configuration',
        'unknown_provider_degraded',
        'health_redaction'
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
