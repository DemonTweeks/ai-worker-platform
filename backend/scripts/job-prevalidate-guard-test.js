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
      submissionScopeId: 'mw-pr-session-1234',
      status: 'queued'
    });

    const blocked = await postPrevalidate(serverInfo.baseUrl, {
      workerId: 'mw-pr',
      submissionScopeId: 'mw-pr-session-1234'
    });
    assert.strictEqual(blocked.response.status, 409, 'matching session scope should be blocked while active');
    assert.strictEqual(blocked.body.error.code, 'ACTIVE_JOB_EXISTS');
    assert.strictEqual(validateCallCount, 0, 'prevalidation should not run when the active-job guard blocks the request');

    const allowed = await postPrevalidate(serverInfo.baseUrl, {
      workerId: 'mw-pr',
      submissionScopeId: 'mw-pr-session-9999'
    });
    assert.strictEqual(allowed.response.status, 200, 'independent session scopes should still be allowed');
    assert.strictEqual(validateCallCount, 1, 'prevalidation should continue for independent scopes');

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
