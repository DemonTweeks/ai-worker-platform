const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform-test';
process.env.LLM_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-integration-jwt-secret';
process.env.ADMIN_DEFAULT_USERNAME = process.env.ADMIN_DEFAULT_USERNAME || 'qa-admin';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-admin-password';

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

setCachedModule(path.join(repoRoot, 'src/workers/adapters/ranPrAdapter.js'), {
  run: async (_jobId, options = {}) => {
    if (options.onWorkspacePreparing) {
      await options.onWorkspacePreparing('Preparing isolated RAN workspace.');
    }
    if (options.onWorkspacePrepared) {
      await options.onWorkspacePrepared('RAN workspace ready.');
    }
    if (options.onOutputsCollecting) {
      await options.onOutputsCollecting('Collecting approved RAN outputs.');
    }
    if (options.onOutputsCollected) {
      await options.onOutputsCollected('Approved RAN outputs collected.');
    }

    return {
      workerId: 'ran-pr',
      runMode: 'standard-pr',
      selectedProject: null,
      pipelineResult: {
        cancelled: false,
        stageResults: [{ stage: 'src/simple_ecc_export.py' }]
      },
      outputCollection: {
        outputFileCount: 0,
        validOutputFileCount: 0,
        invalidOutputFileCount: 2,
        invalidOutputs: [
          {
            trackedFileType: 'ran_ecc_output',
            reasonCode: 'RAN_INVALID_ECC_OUTPUT'
          },
          {
            trackedFileType: 'ran_ecc_output_with_general_items',
            reasonCode: 'RAN_INVALID_ECC_OUTPUT'
          }
        ],
        failure: {
          code: 'RAN_INVALID_ECC_OUTPUT',
          message: 'RAN PR worker produced no valid ECC output files.',
          details: {
            invalidOutputCount: 2
          }
        }
      }
    };
  }
});

const app = require('../src/app');
const { checkFirebaseConnection } = require('../src/db/firebase');
const { Job, JobFile, WarningItem, ReviewRequiredItem } = require('../src/models');
const storageService = require('../src/services/storageService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');

const ranSkillRoot = path.join(repoRoot, '..', 'skills', 'create-pr-cd-ran');
const sampleBomPath = path.join(ranSkillRoot, 'input', 'BOM.xlsx');
const sampleEpmsPath = path.join(ranSkillRoot, 'input', 'EPMS.xlsx');
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

const waitForTerminalDetail = async (baseUrl, jobId, timeoutMs = 30000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, 'job detail should remain available');

    if (['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(result.body.job.status)) {
      return result.body;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach terminal status.`);
};

const waitForSummaryDetail = async (baseUrl, jobId, timeoutMs = 30000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, 'job detail should remain available');

    if (result.body.outputs.some((file) => file.fileType === 'summary' && file.available)) {
      return result.body;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${jobId} summary output.`);
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
    await storageService.deleteFolderSafe(storageService.getRanWorkspacePath(jobId)).catch(() => {});
  }
};

const main = async () => {
  let serverInfo = null;

  try {
    const connection = await checkFirebaseConnection();
    assert(connection.connected, 'Firebase RTDB should be reachable for placeholder runtime verification');
    await storageService.ensureBaseStorage();
    serverInfo = await createServer();

    const bomPrevalidation = await uploadFile(serverInfo.baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
      uploadKind: 'ran-bom'
    });
    assert.strictEqual(bomPrevalidation.response.status, 200, 'sample ran BOM should prevalidate');

    const epmsPrevalidation = await uploadFile(serverInfo.baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
      uploadKind: 'ran-epms'
    });
    assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample ran EPMS should prevalidate');

    const created = await postJson(serverInfo.baseUrl, '/api/jobs', {
      workerId: 'ran-pr',
      bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
      epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
      runMode: 'standard-pr'
    });
    assert.strictEqual(created.response.status, 201, 'placeholder runtime job should still be creatable with valid inputs');

    const jobId = created.body.job.jobId;
    createdJobIds.add(jobId);

    const terminalDetail = await waitForTerminalDetail(serverInfo.baseUrl, jobId);
    assert.strictEqual(terminalDetail.job.status, 'failed', 'placeholder-only ECC outputs must fail the RAN job');
    assert.strictEqual(terminalDetail.job.failureDiagnosis.category, 'RAN_INVALID_ECC_OUTPUT');
    assert.strictEqual(terminalDetail.job.outputFileCount, 0, 'placeholder-only ECC outputs must not count toward outputFileCount');
    const detail = await waitForSummaryDetail(serverInfo.baseUrl, jobId);
    assert.strictEqual(
      detail.outputs.some((file) => file.fileType === 'zip_package'),
      false,
      'placeholder-only ECC outputs must not create a successful ZIP record'
    );

    const summaryFile = detail.outputs.find((file) => file.fileType === 'summary');
    assert(summaryFile && summaryFile.available, 'failed placeholder-output jobs should still expose Summary.json');

    const zipDownload = await request(serverInfo.baseUrl, `/api/jobs/${encodeURIComponent(jobId)}/download-zip`);
    assert.strictEqual(zipDownload.response.status, 501, 'placeholder-only ECC outputs must not expose ZIP download');
    assert.strictEqual(zipDownload.body.error.code, 'ZIP_NOT_READY');

    console.log('--- RAN Placeholder Runtime Tests Passed! ---');
  } finally {
    if (serverInfo) {
      await closeServer(serverInfo.server).catch(() => {});
    }
    await cleanupArtifacts().catch(() => {});
  }
};

main().then(() => process.exit(0)).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
