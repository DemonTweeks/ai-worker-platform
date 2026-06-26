const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const xlsx = require('xlsx');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform-test';
process.env.LLM_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-integration-jwt-secret';
process.env.ADMIN_DEFAULT_USERNAME = process.env.ADMIN_DEFAULT_USERNAME || 'qa-admin';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-admin-password';

const app = require('../src/app');
const { checkFirebaseConnection } = require('../src/db/firebase');
const { Job, JobFile, WarningItem, ReviewRequiredItem } = require('../src/models');
const { consumePrevalidatedUpload } = require('../src/services/prevalidationService');
const storageService = require('../src/services/storageService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');

const repoRoot = path.resolve(__dirname, '../..');
const ranSkillRoot = path.join(repoRoot, 'skills', 'create-pr-cd-ran');
const sampleBomPath = path.join(ranSkillRoot, 'input', 'BOM.xlsx');
const sampleEpmsPath = path.join(ranSkillRoot, 'input', 'EPMS.xlsx');

const createdJobIds = new Set();
const prevalidatedUploadIds = new Set();

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
};

const postJson = (baseUrl, route, body) => request(baseUrl, route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const uploadBuffer = async (baseUrl, route, buffer, fileName, extraFields = {}) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }
  formData.append('file', new Blob([buffer]), fileName);
  return request(baseUrl, route, { method: 'POST', body: formData });
};

const uploadFile = async (baseUrl, route, filePath, extraFields = {}) => {
  const buffer = await fs.promises.readFile(filePath);
  return uploadBuffer(baseUrl, route, buffer, path.basename(filePath), extraFields);
};

const createWorkbookBuffer = (rows) => {
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const createServer = async () => {
  const server = http.createServer(app);
  initWebSocketServer(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
};

const closeServer = async (server) => {
  await closeWebSocketServer().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
};

const cleanupArtifacts = async () => {
  for (const prevalidatedFileId of prevalidatedUploadIds) {
    try {
      const upload = await consumePrevalidatedUpload(prevalidatedFileId);
      await storageService.deleteFileSafe(upload.absolutePath).catch(() => {});
    } catch (error) {
      // Ignore already-consumed or already-cleaned uploads.
    }
  }
  prevalidatedUploadIds.clear();

  for (const jobId of createdJobIds) {
    await Promise.all([
      Job.deleteMany({ jobId }),
      JobFile.deleteMany({ jobId }),
      WarningItem.deleteMany({ jobId }),
      ReviewRequiredItem.deleteMany({ jobId })
    ]).catch(() => {});
    await storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {});
    await storageService.deleteFolderSafe(storageService.getRanWorkspacePath(jobId)).catch(() => {});
  }
  createdJobIds.clear();
};

const waitForTerminalDetail = async (baseUrl, jobId, timeoutMs = 30000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, 'job detail should remain available while waiting for failure');

    if (['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(result.body.job.status)) {
      return result.body;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${jobId} to reach terminal status.`);
};

const prevalidateRanInputs = async (baseUrl) => {
  const bomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(bomPrevalidation.response.status, 200, 'sample ran BOM should prevalidate');
  prevalidatedUploadIds.add(bomPrevalidation.body.prevalidatedFileId);

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample ran EPMS should prevalidate');
  prevalidatedUploadIds.add(epmsPrevalidation.body.prevalidatedFileId);

  return {
    bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
    epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId
  };
};

const testInvalidCreateInputs = async (baseUrl) => {
  const invalidProjectInputs = await prevalidateRanInputs(baseUrl);

  const invalidProjectCreate = await postJson(baseUrl, '/api/jobs', {
    workerId: 'ran-pr',
    ...invalidProjectInputs,
    runMode: 'general-item',
    selectedProject: 'Not A Workbook Project'
  });

  assert.strictEqual(invalidProjectCreate.response.status, 400, 'invalid General Item project should be rejected');
  assert.strictEqual(invalidProjectCreate.body.error.code, 'VALIDATION_ERROR');
  assert.strictEqual(
    invalidProjectCreate.body.error.message,
    'Selected RAN General Item project is invalid.'
  );

  const invalidRunModeInputs = await prevalidateRanInputs(baseUrl);

  const invalidRunModeCreate = await postJson(baseUrl, '/api/jobs', {
    workerId: 'ran-pr',
    ...invalidRunModeInputs,
    runMode: 'bom-comparison'
  });

  assert.strictEqual(invalidRunModeCreate.response.status, 400, 'unsupported RAN run mode should be rejected');
  assert.strictEqual(invalidRunModeCreate.body.error.code, 'VALIDATION_ERROR');
  assert.strictEqual(
    invalidRunModeCreate.body.error.message,
    'RAN run mode must be standard-pr or general-item.'
  );
};

const testLiveSafeFailure = async (baseUrl) => {
  const malformedBomPrevalidation = await uploadBuffer(
    baseUrl,
    '/api/jobs/prevalidate',
    createWorkbookBuffer([
      ['not', 'a', 'real', 'bom'],
      ['1', '2', '3', '4']
    ]),
    'bad-bom.xlsx',
    { uploadKind: 'ran-bom' }
  );
  assert.strictEqual(malformedBomPrevalidation.response.status, 200, 'readable malformed BOM should still pass prevalidation');

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample ran EPMS should prevalidate for the live failure test');

  const created = await postJson(baseUrl, '/api/jobs', {
    workerId: 'ran-pr',
    bomPrevalidatedFileId: malformedBomPrevalidation.body.prevalidatedFileId,
    epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
    runMode: 'standard-pr'
  });

  assert.strictEqual(created.response.status, 201, 'malformed-but-readable BOM should still reach live worker execution');
  const jobId = created.body.job.jobId;
  createdJobIds.add(jobId);

  const detail = await waitForTerminalDetail(baseUrl, jobId);
  assert.strictEqual(detail.job.status, 'failed', 'live malformed BOM should fail during worker execution');
  assert.strictEqual(detail.job.failureSummary, 'RAN PR worker process failed (simple_normalize.py).');
  assert.strictEqual(detail.job.error, undefined, 'safe failure detail should not expose raw job.error');
  assert.strictEqual(detail.job.stdout, undefined, 'safe failure detail should not expose stdout');
  assert.strictEqual(detail.job.stderr, undefined, 'safe failure detail should not expose stderr');

  const diagnosis = detail.job.failureDiagnosis;
  assert.strictEqual(diagnosis.category, 'WORKER_PROCESS_FAILED');
  assert.strictEqual(diagnosis.stage, 'simple_normalize.py');
  assert.strictEqual(diagnosis.exitCode, 1);
  assert.strictEqual(diagnosis.summary.includes('src/simple_normalize.py'), false);
  assert.strictEqual(diagnosis.summary.includes('simple_normalize.py'), true);
  assert.strictEqual(diagnosis.technicalDetails.includes('[redacted]'), true, 'technical details should show path redaction evidence');
  assert.strictEqual(diagnosis.technicalDetails.includes(repoRoot), false, 'technical details must not leak the repo root');
  assert.strictEqual(diagnosis.technicalDetails.includes(repoRoot.replace(/\\/g, '/')), false, 'technical details must not leak POSIX-style repo paths');
  assert.strictEqual(diagnosis.technicalDetails.includes('storage\\ran-workspaces'), false, 'technical details must not leak workspace storage paths');
  assert.strictEqual(diagnosis.technicalDetails.includes('storage/jobs'), false, 'technical details must not leak job storage paths');

  const history = await request(baseUrl, `/api/jobs?workerId=ran-pr&limit=20&page=1&search=${encodeURIComponent(jobId)}`);
  assert.strictEqual(history.response.status, 200, 'ran history should remain available after failure');
  const historyItem = history.body.items.find((item) => item.jobId === jobId);
  assert(historyItem, 'failed ran job should appear in shared history');
  assert.strictEqual(historyItem.failureSummary, 'RAN PR worker process failed (simple_normalize.py).');
};

const main = async () => {
  let serverInfo = null;

  try {
    const conn = await checkFirebaseConnection();
    assert(conn.connected, 'Firebase RTDB should be reachable for testing');
    await storageService.ensureBaseStorage();
    serverInfo = await createServer();

    await testInvalidCreateInputs(serverInfo.baseUrl);
    await testLiveSafeFailure(serverInfo.baseUrl);

    console.log('--- RAN Invalid Input And Safe Error Tests Passed! ---');
  } finally {
    if (serverInfo) {
      await closeServer(serverInfo.server).catch(() => {});
    }
    await cleanupArtifacts().catch(() => {});
  }
};

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
