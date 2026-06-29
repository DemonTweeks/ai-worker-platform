const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

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

const repoRoot = path.resolve(__dirname, '../..');
const ranSkillRoot = path.join(repoRoot, 'skills', 'create-pr-cd-ran');
const sampleBomPath = path.join(ranSkillRoot, 'input', 'BOM.xlsx');
const sampleEpmsPath = path.join(ranSkillRoot, 'input', 'EPMS.xlsx');
const selectedProject = 'CD consolidation 2023 (Swap/ Modernize)';
const terminalStatuses = new Set(['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result']);
const createdJobIds = new Set();

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
};

const uploadFile = async (baseUrl, route, filePath, extraFields = {}) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }

  const buffer = await fs.promises.readFile(filePath);
  formData.append('file', new Blob([buffer]), path.basename(filePath));
  return request(baseUrl, route, { method: 'POST', body: formData });
};

const postJson = (baseUrl, route, body) => request(baseUrl, route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const waitForJobTerminal = async (baseUrl, jobId, timeoutMs = 300000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, `job detail should remain available for ${jobId}`);

    if (terminalStatuses.has(result.body.job.status)) {
      return result.body;
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach a terminal state.`);
};

const runReloadScenario = async (baseUrl) => {
  const bomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(bomPrevalidation.response.status, 200, 'sample RAN BOM should prevalidate');

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample RAN EPMS should prevalidate');

  const created = await postJson(baseUrl, '/api/jobs', {
    workerId: 'ran-pr',
    bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
    epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
    runMode: 'general-item',
    selectedProject
  });
  assert.strictEqual(created.response.status, 201, 'general-item RAN job should be created');

  const jobId = created.body.job.jobId;
  createdJobIds.add(jobId);
  const terminalDetail = await waitForJobTerminal(baseUrl, jobId);
  assert.strictEqual(terminalDetail.job.status, 'completed', 'RAN job should complete before restart');

  return {
    jobId,
    createdAt: terminalDetail.job.createdAt
  };
};

const verifyReloadedHistoryAndDetail = async (baseUrl, { jobId }) => {
  const list = await request(baseUrl, `/api/jobs?workerId=ran-pr&limit=20&page=1`);
  assert.strictEqual(list.response.status, 200, 'history list should load after restart');

  const historyItem = list.body.items.find((item) => item.jobId === jobId);
  assert(historyItem, 'reloaded history should include the completed RAN job');
  assert.strictEqual(historyItem.workerId, 'ran-pr');
  assert.strictEqual(historyItem.workerDisplayName, 'RAN PR Worker');
  assert.strictEqual(historyItem.runMode, 'general-item');
  assert.strictEqual(historyItem.selectedProject, selectedProject);
  assert.strictEqual(historyItem.status, 'completed');
  assert.strictEqual(historyItem.engineVersion, 'v1.0.0');
  assert.strictEqual(historyItem.engineCommit, '239910e2816153339a94881597bbb95355059741');

  const detail = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
  assert.strictEqual(detail.response.status, 200, 'job detail should load after restart');
  assert.strictEqual(detail.body.job.workerId, 'ran-pr');
  assert.strictEqual(detail.body.job.workerDisplayName, 'RAN PR Worker');
  assert.strictEqual(detail.body.job.runMode, 'general-item');
  assert.strictEqual(detail.body.job.selectedProject, selectedProject);
  assert.strictEqual(detail.body.job.status, 'completed');
  assert.strictEqual(detail.body.job.engineVersion, 'v1.0.0');
  assert.strictEqual(detail.body.job.engineCommit, '239910e2816153339a94881597bbb95355059741');
  assert(
    detail.body.outputs.some((file) => file.fileType === 'ran_ecc_output_with_general_items' && file.available),
    'reloaded job detail should expose the general-item ECC workbook as available'
  );
  assert(
    detail.body.outputs.some((file) => file.fileType === 'summary' && file.available),
    'reloaded job detail should expose Summary.json as available'
  );
  assert(
    detail.body.outputs.some((file) => file.fileType === 'zip_package' && file.available),
    'reloaded job detail should expose the ZIP package as available'
  );

  const summaryFile = await JobFile.findOne({ jobId, fileType: 'summary' }).lean();
  assert(summaryFile, 'summary file record should persist for completed RAN jobs');
  const summaryPath = path.join(storageService.getStorageRoot(), summaryFile.filePath);
  const summaryJson = JSON.parse(await fs.promises.readFile(summaryPath, 'utf8'));
  assert.strictEqual(
    summaryJson.status,
    detail.body.job.status,
    'Summary.json should reflect the final persisted terminal status'
  );

  const zipResponse = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}/download-zip`);
  assert(zipResponse.ok, 'reloaded ZIP download should succeed');
  const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
  assert(zipBuffer.subarray(0, 2).equals(Buffer.from('PK')), 'reloaded ZIP download should preserve the ZIP signature');
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
};

const main = async () => {
  let firstServer = null;
  let secondServer = null;

  try {
    const connection = await checkFirebaseConnection();
    assert(connection.connected, 'Firebase RTDB should be reachable for persistence verification');
    await storageService.ensureBaseStorage();

    firstServer = await createServer();
    const scenario = await runReloadScenario(firstServer.baseUrl);
    await closeServer(firstServer.server);
    firstServer = null;

    secondServer = await createServer();
    await verifyReloadedHistoryAndDetail(secondServer.baseUrl, scenario);

    console.log(JSON.stringify({
      ok: true,
      jobId: scenario.jobId,
      selectedProject,
      verified: [
        'history-list-after-restart',
        'job-detail-after-restart',
        'zip-download-after-restart'
      ]
    }, null, 2));
  } finally {
    if (firstServer) {
      await closeServer(firstServer.server).catch(() => {});
    }
    if (secondServer) {
      await closeServer(secondServer.server).catch(() => {});
    }
    await cleanupArtifacts().catch(() => {});
  }
};

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
