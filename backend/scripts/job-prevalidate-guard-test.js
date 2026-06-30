const assert = require('assert');
const http = require('http');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

let validateCallCount = 0;

setCachedModule(path.join(repoRoot, 'src/services/prevalidationService.js'), {
  validateUpload: async () => {
    validateCallCount += 1;
    return {
      passed: true,
      checklist: [],
      workerExplanation: 'Validated for testing.'
    };
  }
});

const app = require('../src/app');
const { Job } = require('../src/models');

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const body = await response.json();
  return { response, body };
};

const createServer = async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
};

const closeServer = async (server) => {
  await new Promise((resolve) => server.close(resolve));
};

const postPrevalidate = (baseUrl, fields) => {
  const formData = new FormData();
  formData.append('file', new Blob(['test workbook']), 'input.xlsx');
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return request(baseUrl, '/api/jobs/prevalidate', {
    method: 'POST',
    body: formData
  });
};

const runTests = async () => {
  console.log('--- Running Prevalidate Active-Job Guard Tests ---');
  let serverInfo = null;

  try {
    serverInfo = await createServer();

    await Job.create({
      jobId: 'PR-ACTIVE-001',
      workerId: 'mw-pr',
      browserTabSessionId: 'mw-pr-tab-1234',
      idempotencyKey: 'mw-idem-1',
      status: 'queued'
    });

    const first = await postPrevalidate(serverInfo.baseUrl, {
      workerId: 'mw-pr',
      browserTabSessionId: 'mw-pr-tab-1234'
    });
    assert.strictEqual(first.response.status, 200, 'prevalidation should not be blocked by an active job in the same browser tab');
    assert.strictEqual(validateCallCount, 1, 'prevalidation should still execute for same-tab requests');

    const second = await postPrevalidate(serverInfo.baseUrl, {
      workerId: 'mw-pr',
      browserTabSessionId: 'mw-pr-tab-9999'
    });
    assert.strictEqual(second.response.status, 200, 'independent browser tabs should also be allowed');
    assert.strictEqual(validateCallCount, 2, 'prevalidation should continue for all tabs regardless of active jobs');

    console.log('--- Prevalidate Active-Job Guard Tests Passed! ---');
  } finally {
    if (serverInfo) {
      await closeServer(serverInfo.server).catch(() => {});
    }
  }
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
