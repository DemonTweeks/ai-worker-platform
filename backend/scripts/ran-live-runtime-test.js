const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform-test';
process.env.LLM_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-integration-jwt-secret';
process.env.ADMIN_DEFAULT_USERNAME = process.env.ADMIN_DEFAULT_USERNAME || 'qa-admin';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-admin-password';

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let mockRunMode = 'complete';

const actualOutputCollector = require('../src/services/outputCollector');
setCachedModule(path.join(repoRoot, 'src/services/outputCollector.js'), {
  ...actualOutputCollector,
  generateReportsAndPackage: async (jobId) => {
    await delay(300);
    return actualOutputCollector.generateReportsAndPackage(jobId);
  }
});

setCachedModule(path.join(repoRoot, 'src/workers/adapters/ranPrAdapter.js'), {
  run: async (jobId, options = {}) => {
    const storageService = require('../src/services/storageService');
    const { JobFile } = require('../src/models');

    await delay(150);
    if (options.onWorkspacePreparing) {
      await options.onWorkspacePreparing('Preparing isolated RAN workspace.');
    }
    await delay(50);
    if (options.onWorkspacePrepared) {
      await options.onWorkspacePrepared('RAN workspace ready.');
    }

    const stages = [
      'src/simple_normalize.py',
      'src/simple_calculation.py',
      'src/simple_pr_generator.py',
      'src/simple_ecc_export.py'
    ];

    for (let index = 0; index < stages.length; index += 1) {
      await delay(40);
      if (options.onStageStarted) {
        await options.onStageStarted({
          stage: stages[index],
          stageLabel: path.basename(stages[index]),
          index,
          total: stages.length
        });
      }

      if (mockRunMode === 'cancel' && index === 0) {
        let cancellationRequested = false;
        const waitStarted = Date.now();

        while (!cancellationRequested && (Date.now() - waitStarted) < 5000) {
          await delay(25);
          cancellationRequested = typeof options.isCancellationRequested === 'function'
            ? options.isCancellationRequested()
            : false;
        }

        if (!cancellationRequested) {
          throw new Error('Cancellation test expected a running cancellation request.');
        }

        break;
      }
    }

    if (options.onOutputsCollecting) {
      await options.onOutputsCollecting('Collecting approved RAN outputs.');
    }

    const outputPath = storageService.resolveJobOutputPath(jobId, 'ECC_PR_Output.xlsx');
    await fs.promises.writeFile(outputPath, 'mock ran ecc output', 'utf8');
    const metadata = await storageService.buildFileMetadata(outputPath);
    await JobFile.create({
      jobId,
      fileType: 'ran_ecc_output',
      fileName: metadata.fileName,
      filePath: metadata.filePath,
      fileSize: metadata.fileSize,
      retentionUntil: metadata.retentionUntil
    });

    if (options.onOutputsCollected) {
      await options.onOutputsCollected('Approved RAN outputs collected.');
    }

    return {
      workerId: 'ran-pr',
      runMode: 'standard-pr',
      selectedProject: null,
      pipelineResult: {
        cancelled: mockRunMode === 'cancel',
        stageResults: mockRunMode === 'cancel'
          ? [{ stage: stages[0], cancelled: true }]
          : stages.map((stage) => ({ stage }))
      },
      outputCollection: {
        outputFileCount: 1
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
const browserTabSessionId = 'QA-RAN-LIVE-TAB';
let idempotencySequence = 0;
const nextIdempotencyKey = () => `ran-live-${++idempotencySequence}`;

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

const createServer = async () => {
  const server = http.createServer(app);
  initWebSocketServer(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}/ws`
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

const waitForJobTerminal = async (baseUrl, jobId, timeoutMs = 15000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, 'job detail should remain available');
    if (['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(result.body.job.status)) {
      return result.body;
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach terminal status.`);
};

const waitForPackagedDetail = async (baseUrl, jobId, timeoutMs = 15000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, 'job detail should remain available');
    if (
      result.body.outputs.some((file) => file.fileType === 'summary' && file.available)
      && result.body.outputs.some((file) => file.fileType === 'zip_package' && file.available)
    ) {
      return result.body;
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for ${jobId} packaged outputs.`);
};

const waitForJobDetail = async (baseUrl, jobId, predicate, timeoutMs = 15000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, 'job detail should remain available');
    if (predicate(result.body)) {
      return result.body;
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for ${jobId} detail predicate.`);
};

const waitForJobEvent = (ws, targetEvent) => new Promise((resolve, reject) => {
  const seenEvents = [];
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${targetEvent}. Saw: ${seenEvents.join(', ')}`)), 15000);

  const listener = (data) => {
    const message = JSON.parse(data.toString());
    if (message.type !== 'JOB_EVENT') {
      return;
    }

    seenEvents.push(message.event);
    if (message.event === targetEvent) {
      clearTimeout(timeout);
      ws.off('message', listener);
      resolve(seenEvents);
    }
  };

  ws.on('message', listener);
});

const waitForJobEventMessage = (ws, targetEvent) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    ws.off('message', listener);
    reject(new Error(`Timed out waiting for ${targetEvent}.`));
  }, 15000);

  const listener = (data) => {
    const message = JSON.parse(data.toString());
    if (message.type !== 'JOB_EVENT' || message.event !== targetEvent) {
      return;
    }

    clearTimeout(timeout);
    ws.off('message', listener);
    resolve(message);
  };

  ws.on('message', listener);
});

const waitForWsOpen = (ws) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), 10000);
  ws.once('open', () => {
    clearTimeout(timeout);
    resolve();
  });
  ws.once('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });
});

const wsExchange = (ws, payload, matcher = () => true) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    ws.off('message', listener);
    reject(new Error('WebSocket response timeout'));
  }, 10000);

  const listener = (data) => {
    const message = JSON.parse(data.toString());
    if (!matcher(message)) {
      return;
    }

    clearTimeout(timeout);
    ws.off('message', listener);
    resolve(message);
  };

  ws.on('message', listener);
  ws.send(JSON.stringify(payload));
});

const terminateWs = (ws) => {
  if (ws && ws.readyState !== WebSocket.CLOSED) {
    ws.terminate();
  }
};

const testRanLiveRuntime = async ({ baseUrl, wsUrl }) => {
  mockRunMode = 'complete';
  const bomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(bomPrevalidation.response.status, 200, 'sample ran BOM should prevalidate');

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample ran EPMS should prevalidate');

  const ws = new WebSocket(wsUrl);

  try {
    await waitForWsOpen(ws);

    const created = await postJson(baseUrl, '/api/jobs', {
      workerId: 'ran-pr',
      browserTabSessionId,
      idempotencyKey: nextIdempotencyKey(),
      bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
      epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
      runMode: 'standard-pr'
    });
    assert.strictEqual(created.response.status, 201, 'ran-pr job should be created');
    const jobId = created.body.job.jobId;
    createdJobIds.add(jobId);

    const subscribed = await wsExchange(ws, { action: 'subscribe', jobId }, (message) => message.type === 'SUBSCRIBED');
    assert.strictEqual(subscribed.type, 'SUBSCRIBED', 'websocket should subscribe to the ran-pr job');

    const completedEventsPromise = waitForJobEvent(ws, 'JOB_COMPLETED');
    const terminalDetail = await waitForJobTerminal(baseUrl, jobId);
    assert.strictEqual(terminalDetail.job.status, 'completed', 'ran-pr job should still reach completed terminal status');
    await waitForPackagedDetail(baseUrl, jobId);

    const seenEvents = await completedEventsPromise;
    assert(seenEvents.includes('ASSET_LOADING_STARTED'), 'websocket stream should include ASSET_LOADING_STARTED');
    assert(seenEvents.includes('OUTPUT_COLLECTION_COMPLETED'), 'websocket stream should include OUTPUT_COLLECTION_COMPLETED');

    const finalDetail = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(finalDetail.response.status, 200, 'final ran-pr detail should load');
    assert(
      finalDetail.body.outputs.some((file) => file.fileType === 'summary' && file.available),
      'completed ran-pr detail should expose Summary.json'
    );

    const zipResponse = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}/download-zip`);
    assert(zipResponse.ok, 'completed ran-pr job should support zip download');
    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    assert(zipBuffer.subarray(0, 2).equals(Buffer.from('PK')), 'zip download should have a ZIP signature');
  } finally {
    terminateWs(ws);
  }
};

const testRanLiveCancellation = async ({ baseUrl, wsUrl }) => {
  mockRunMode = 'cancel';
  const bomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(bomPrevalidation.response.status, 200, 'sample ran BOM should prevalidate for cancellation');

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, 'sample ran EPMS should prevalidate for cancellation');

  const ws = new WebSocket(wsUrl);

  try {
    await waitForWsOpen(ws);

    const created = await postJson(baseUrl, '/api/jobs', {
      workerId: 'ran-pr',
      browserTabSessionId,
      idempotencyKey: nextIdempotencyKey(),
      bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
      epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
      runMode: 'standard-pr'
    });
    assert.strictEqual(created.response.status, 201, 'cancellable ran-pr job should be created');
    const jobId = created.body.job.jobId;
    createdJobIds.add(jobId);

    const subscribed = await wsExchange(ws, { action: 'subscribe', jobId }, (message) => message.type === 'SUBSCRIBED');
    assert.strictEqual(subscribed.type, 'SUBSCRIBED', 'websocket should subscribe to the cancellable ran-pr job');

    await waitForJobDetail(baseUrl, jobId, (detail) => detail.job.status === 'generating');

    const cancelledEventPromise = waitForJobEventMessage(ws, 'JOB_CANCELLED');
    const cancelResponse = await postJson(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}/cancel`, {});
    assert.strictEqual(cancelResponse.response.status, 200, 'running ran-pr job should accept cancellation');
    assert(
      cancelResponse.body.message.includes('Cancellation requested'),
      'running ran-pr cancellation should acknowledge the request'
    );

    const cancellationRequestedDetail = await waitForJobDetail(
      baseUrl,
      jobId,
      (detail) => Boolean(detail.workerState && detail.workerState.cancellationRequested)
    );
    assert.strictEqual(
      cancellationRequestedDetail.workerState.cancellationRequested,
      true,
      'worker state should reflect a requested cancellation before terminal state'
    );

    const cancelledEvent = await cancelledEventPromise;
    assert.strictEqual(
      cancelledEvent.status,
      'cancelled_with_partial_result',
      'JOB_CANCELLED should only be emitted once the ran-pr job reaches terminal partial-result cancellation'
    );
    assert.strictEqual(cancelledEvent.phase, 'CANCELLED', 'JOB_CANCELLED should surface the terminal cancellation phase');

    const terminalDetail = await waitForJobTerminal(baseUrl, jobId);
    assert.strictEqual(terminalDetail.job.status, 'cancelled_with_partial_result');
    await waitForPackagedDetail(baseUrl, jobId);

    const zipResponse = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}/download-zip`);
    assert(zipResponse.ok, 'cancelled ran-pr partial-result job should support zip download');
    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    assert(zipBuffer.subarray(0, 2).equals(Buffer.from('PK')), 'cancelled ran-pr zip download should have a ZIP signature');
  } finally {
    mockRunMode = 'complete';
    terminateWs(ws);
  }
};

const main = async () => {
  let serverInfo = null;

  try {
    const conn = await checkFirebaseConnection();
    assert(conn.connected, 'Firebase RTDB should be reachable for testing');
    await storageService.ensureBaseStorage();
    serverInfo = await createServer();
    await testRanLiveRuntime(serverInfo);
    await testRanLiveCancellation(serverInfo);
    console.log('--- RAN Live Runtime Tests Passed! ---');
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
