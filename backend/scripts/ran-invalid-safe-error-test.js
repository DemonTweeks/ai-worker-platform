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
require('./helpers/ensure-ran-python').resolvePythonExecutable();

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

const testWrongReadableBomRejectedPrevalidation = async (baseUrl) => {
  const wrongBomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(
    wrongBomPrevalidation.response.status,
    400,
    'EPMS-shaped workbook uploaded in the ran-bom slot must be rejected before job creation'
  );
  assert.strictEqual(wrongBomPrevalidation.body.passed, false, 'wrong ran-bom workbook should fail structured prevalidation');
  assert.strictEqual(
    typeof wrongBomPrevalidation.body.prevalidatedFileId,
    'undefined',
    'failed ran-bom prevalidation must not issue a prevalidated file id'
  );
  assert(
    Array.isArray(wrongBomPrevalidation.body.checklist)
      && wrongBomPrevalidation.body.checklist.some((item) => item.key === 'ran_bom_structure' && item.passed === false),
    'wrong ran-bom workbook should surface a specific failed semantic checklist item'
  );
  assert.strictEqual(
    wrongBomPrevalidation.body.workerExplanation.includes('RAN BOM'),
    true,
    'wrong ran-bom workbook should return a safe worker explanation'
  );
};

const main = async () => {
  let serverInfo = null;

  try {
    const conn = await checkFirebaseConnection();
    assert(conn.connected, 'Firebase RTDB should be reachable for testing');
    await storageService.ensureBaseStorage();
    serverInfo = await createServer();

    await testInvalidCreateInputs(serverInfo.baseUrl);
    await testWrongReadableBomRejectedPrevalidation(serverInfo.baseUrl);

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
