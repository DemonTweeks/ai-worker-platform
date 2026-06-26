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
const storageService = require('../src/services/storageService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');
const ranPrAdapter = require('../src/workers/adapters/ranPrAdapter');

const repoRoot = path.resolve(__dirname, '../..');
const ranSkillRoot = path.join(repoRoot, 'skills', 'create-pr-cd-ran');
const sampleBomPath = path.join(ranSkillRoot, 'input', 'BOM.xlsx');
const sampleEpmsPath = path.join(ranSkillRoot, 'input', 'EPMS.xlsx');

const createdJobIds = new Set();

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
};

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
  xlsx.utils.book_append_sheet(workbook, sheet, 'data');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const postJson = (baseUrl, route, body) => request(baseUrl, route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

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
  for (const jobId of createdJobIds) {
    await Promise.all([
      Job.deleteMany({ jobId }),
      JobFile.deleteMany({ jobId }),
      WarningItem.deleteMany({ jobId }),
      ReviewRequiredItem.deleteMany({ jobId })
    ]).catch(() => {});
    await storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {});
  }
  createdJobIds.clear();
};

const testRanRoutes = async (baseUrl) => {
  const projects = await request(baseUrl, '/api/jobs/ran-projects');
  assert.strictEqual(projects.response.status, 200, 'ran project list should load');
  assert(Array.isArray(projects.body.projects), 'ran project list should return a projects array');
  assert(projects.body.projects.includes('Project Thanos'), 'ran project list should expose workbook-backed General Item projects');

  const invalidBom = await uploadBuffer(
    baseUrl,
    '/api/jobs/prevalidate',
    Buffer.from('not an excel workbook', 'utf8'),
    'invalid-ran-bom.xlsx',
    { uploadKind: 'ran-bom' }
  );
  assert.strictEqual(invalidBom.response.status, 400, 'invalid ran-bom workbook should be rejected');
  assert.strictEqual(invalidBom.body.uploadKind, 'ran-bom');

  const bomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(bomPrevalidation.response.status, 200, 'sample ran BOM should prevalidate');
  assert.strictEqual(bomPrevalidation.body.uploadKind, 'ran-bom');
  assert(bomPrevalidation.body.prevalidatedFileId, 'ran BOM prevalidation should return a file id');

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample ran EPMS should prevalidate');
  assert.strictEqual(epmsPrevalidation.body.uploadKind, 'ran-epms');
  assert(epmsPrevalidation.body.prevalidatedFileId, 'ran EPMS prevalidation should return a file id');

  const originalRanRun = ranPrAdapter.run;
  ranPrAdapter.run = async () => ({ mocked: true });

  try {
    const created = await postJson(baseUrl, '/api/jobs', {
      workerId: 'ran-pr',
      bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
      epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
      runMode: 'standard-pr'
    });

    assert.strictEqual(created.response.status, 201, 'ran-pr job should be created');
    assert.strictEqual(created.body.job.workerId, 'ran-pr');
    assert.strictEqual(created.body.job.workerDisplayName, 'RAN PR Worker');
    assert.strictEqual(created.body.job.runMode, 'standard-pr');
    assert.strictEqual(created.body.job.selectedProject, null);
    assert.strictEqual(created.body.job.prScope, null);
    assert.strictEqual(created.body.jobFiles.length, 2, 'ran-pr create should return two tracked input files');
    assert.deepStrictEqual(
      created.body.jobFiles.map((file) => file.fileType).sort(),
      ['ran_bom_upload', 'ran_epms_upload']
    );

    const jobId = created.body.job.jobId;
    createdJobIds.add(jobId);

    const detail = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(detail.response.status, 200, 'ran-pr detail should load');
    assert.strictEqual(detail.body.job.workerId, 'ran-pr');
    assert(
      detail.body.files.some((file) => file.fileType === 'ran_bom_upload'),
      'ran-pr detail should track the BOM input file'
    );
    assert(
      detail.body.files.some((file) => file.fileType === 'ran_epms_upload'),
      'ran-pr detail should track the EPMS input file'
    );
    assert(
      !detail.body.outputs.some((file) => file.fileType === 'ran_bom_upload' || file.fileType === 'ran_epms_upload'),
      'ran-pr input files should not be surfaced as outputs'
    );

    const mwUpload = await uploadBuffer(
      baseUrl,
      '/api/jobs/prevalidate',
      createWorkbookBuffer([['site code'], ['MW-001']]),
      'mw-export.xlsx'
    );
    assert.strictEqual(mwUpload.response.status, 200, 'mw export should still prevalidate on the legacy path');

    const epmsPrevalidationForWrongKind = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
      uploadKind: 'ran-epms'
    });
    assert.strictEqual(epmsPrevalidationForWrongKind.response.status, 200, 'fresh ran EPMS upload should prevalidate');

    const wrongKindCreate = await postJson(baseUrl, '/api/jobs', {
      workerId: 'ran-pr',
      bomPrevalidatedFileId: mwUpload.body.prevalidatedFileId,
      epmsPrevalidatedFileId: epmsPrevalidationForWrongKind.body.prevalidatedFileId,
      runMode: 'standard-pr'
    });
    assert.strictEqual(wrongKindCreate.response.status, 400, 'ran-pr create should reject the wrong upload kind');
  } finally {
    ranPrAdapter.run = originalRanRun;
  }
};

const main = async () => {
  let serverInfo = null;

  try {
    const conn = await checkFirebaseConnection();
    assert(conn.connected, 'Firebase RTDB should be reachable for testing');
    await storageService.ensureBaseStorage();
    serverInfo = await createServer();
    await testRanRoutes(serverInfo.baseUrl);
    console.log('--- RAN Job Route Tests Passed! ---');
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
