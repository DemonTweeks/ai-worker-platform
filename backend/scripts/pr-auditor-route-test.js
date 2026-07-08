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
const { Job, JobFile, ReviewRequiredItem, WarningItem } = require('../src/models');
const { consumePrevalidatedUpload } = require('../src/services/prevalidationService');
const storageService = require('../src/services/storageService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');
const prAuditorAdapter = require('../src/workers/adapters/prAuditorAdapter');

const terminalStatuses = new Set(['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result']);
const createdJobIds = new Set();
const prevalidatedUploadIds = new Set();
let idempotencySequence = 0;
const nextIdempotencyKey = () => `pr-auditor-route-${++idempotencySequence}`;
const browserTabSessionId = 'QA-PR-AUDITOR-ROUTE-TAB';

const createWorkbookBuffer = (rows) => {
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, sheet, 'data');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
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

const waitForJobTerminal = async (baseUrl, jobId, timeoutMs = 30000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, `job detail should remain available for ${jobId}`);

    if (terminalStatuses.has(result.body.job.status)) {
      return result.body;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach a terminal state.`);
};

const cleanupArtifacts = async () => {
  for (const prevalidatedFileId of prevalidatedUploadIds) {
    try {
      const upload = await consumePrevalidatedUpload(prevalidatedFileId);
      await storageService.deleteFileSafe(upload.absolutePath).catch(() => {});
    } catch (error) {
      // already consumed or cleaned up
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
  }
  createdJobIds.clear();
};

const prevalidateWorkbook = async (baseUrl, uploadKind, fileName, rows) => {
  const result = await uploadBuffer(baseUrl, '/api/jobs/prevalidate', createWorkbookBuffer(rows), fileName, { uploadKind });
  assert.strictEqual(result.response.status, 200, `${uploadKind} should prevalidate`);
  prevalidatedUploadIds.add(result.body.prevalidatedFileId);
  return result.body.prevalidatedFileId;
};

const verifyInvalidWorkbookSafeError = async (baseUrl) => {
  const invalid = await uploadBuffer(
    baseUrl,
    '/api/jobs/prevalidate',
    Buffer.from('not a workbook', 'utf8'),
    'invalid-final-po.xlsx',
    { uploadKind: 'pr-auditor-final-po' }
  );

  assert.strictEqual(invalid.response.status, 400, 'invalid Final PO workbook should be rejected');
  assert.strictEqual(invalid.body.passed, false);
  assert.strictEqual(typeof invalid.body.prevalidatedFileId, 'undefined');
  assert(
    Array.isArray(invalid.body.checklist)
      && invalid.body.checklist.some((item) => item.key === 'workbook_readable' && item.passed === false),
    'invalid workbook should surface a safe workbook_readable failure'
  );
};

const verifyMissingUploadRejected = async (baseUrl) => {
  const finalPoPrevalidatedFileId = await prevalidateWorkbook(baseUrl, 'pr-auditor-final-po', 'Final PO.xlsx', [['PO'], ['1001']]);

  const created = await postJson(baseUrl, '/api/jobs', {
    workerId: 'pr-auditor',
    browserTabSessionId,
    idempotencyKey: nextIdempotencyKey(),
    finalPoPrevalidatedFileId
  });

  assert.strictEqual(created.response.status, 400, 'missing generated ECC upload should be rejected');
  assert.strictEqual(created.body.error.code, 'VALIDATION_ERROR');
  assert.strictEqual(created.body.error.message, 'expectedEccPrevalidatedFileId is required for PR Auditor jobs.');
};

const verifyHappyPathAndReload = async (baseUrl) => {
  const finalPoPrevalidatedFileId = await prevalidateWorkbook(baseUrl, 'pr-auditor-final-po', 'Final PO.xlsx', [['PO'], ['1001']]);
  const expectedEccPrevalidatedFileId = await prevalidateWorkbook(baseUrl, 'pr-auditor-expected-ecc', 'ECC_PR_Output.xlsx', [['ECC'], ['2001']]);

  const created = await postJson(baseUrl, '/api/jobs', {
    workerId: 'pr-auditor',
    browserTabSessionId,
    idempotencyKey: nextIdempotencyKey(),
    finalPoPrevalidatedFileId,
    expectedEccPrevalidatedFileId
  });

  assert.strictEqual(created.response.status, 201, 'PR Auditor job should be created');
  assert.strictEqual(created.body.job.workerId, 'pr-auditor');
  assert.strictEqual(created.body.job.workerDisplayName, 'PR Auditor');
  assert.strictEqual(created.body.jobFiles.length, 2, 'PR Auditor create should return two tracked input files');

  const jobId = created.body.job.jobId;
  createdJobIds.add(jobId);

  const terminalDetail = await waitForJobTerminal(baseUrl, jobId);
  assert.strictEqual(terminalDetail.job.status, 'completed');
  assert.deepStrictEqual(terminalDetail.job.auditSummary, {
    normalCount: 4,
    invalidPoCount: 1,
    wrongPoCount: 2,
    duplicatePoCount: 3,
    reviewRequiredCount: 5,
    warnings: ['warning-a', 'warning-b']
  });
  assert(
    terminalDetail.outputs.some((file) => file.fileType === 'pr_audit_result_xlsx' && file.available),
    'completed PR Auditor detail should expose the audit report workbook'
  );
  assert(
    terminalDetail.outputs.some((file) => file.fileType === 'pr_audit_summary_json' && file.available),
    'completed PR Auditor detail should expose the trusted audit summary JSON'
  );

  const history = await request(baseUrl, `/api/jobs?workerId=pr-auditor&browserTabSessionId=${encodeURIComponent(browserTabSessionId)}&limit=20&page=1`);
  assert.strictEqual(history.response.status, 200, 'PR Auditor history list should load');
  const historyItem = history.body.items.find((item) => item.jobId === jobId);
  assert(historyItem, 'history list should include the completed PR Auditor job');
  assert.strictEqual(historyItem.workerDisplayName, 'PR Auditor');
  assert.deepStrictEqual(historyItem.auditSummary, terminalDetail.job.auditSummary);

  const auditReport = terminalDetail.outputs.find((file) => file.fileType === 'pr_audit_result_xlsx');
  const download = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(auditReport.id)}`);
  assert.strictEqual(download.response.status, 200, 'audit report download should succeed');
  const reportBuffer = Buffer.from(download.body);
  assert(reportBuffer.subarray(0, 2).equals(Buffer.from('PK')), 'audit report download should preserve xlsx ZIP signature');

  return { jobId };
};

const main = async () => {
  const originalRun = prAuditorAdapter.run;
  let firstServer = null;
  let secondServer = null;

  try {
    const connection = await checkFirebaseConnection();
    assert(connection.connected, 'Firebase RTDB should be reachable for PR Auditor route verification');
    await storageService.ensureBaseStorage();

    prAuditorAdapter.run = async (jobId, options = {}) => {
      if (options.onWorkspacePreparing) {
        await options.onWorkspacePreparing('Preparing PR Auditor job workspace.');
      }

      const workspaceRoot = storageService.getJobRootPath(jobId);
      const outputRoot = storageService.resolveJobFolderPath(jobId, 'output');
      await fs.promises.mkdir(outputRoot, { recursive: true });

      if (options.onWorkspacePrepared) {
        await options.onWorkspacePrepared('PR Auditor job workspace ready.');
      }

      const stages = [
        'Validating files',
        'Loading generated ECC entitlement',
        'Auditing PO records',
        'Resolving duplicates',
        'Generating audit report'
      ];

      for (let index = 0; index < stages.length; index += 1) {
        if (options.onStageStarted) {
          await options.onStageStarted({
            stageLabel: stages[index],
            index,
            total: stages.length
          });
        }
      }

      if (options.onOutputsCollecting) {
        await options.onOutputsCollecting('Collecting approved PR Auditor outputs.');
      }

      const auditReportBuffer = createWorkbookBuffer([
        ['Result', 'Count'],
        ['Normal', 4],
        ['Invalid PO', 1],
        ['Wrong PO', 2],
        ['Duplicate PO', 3],
        ['Review Required', 5]
      ]);
      const summaryJson = JSON.stringify({
        normalCount: 4,
        invalidPoCount: 1,
        wrongPoCount: 2,
        duplicatePoCount: 3,
        reviewRequiredCount: 5,
        warnings: ['warning-a', 'warning-b']
      }, null, 2);

      const auditReportPath = storageService.resolveJobOutputPath(jobId, 'PR_Audit_Result.xlsx');
      const summaryPath = storageService.resolveJobOutputPath(jobId, 'pr_audit_summary.json');
      await fs.promises.mkdir(path.dirname(auditReportPath), { recursive: true });
      await fs.promises.writeFile(auditReportPath, auditReportBuffer);
      await fs.promises.writeFile(summaryPath, summaryJson, 'utf8');

      const auditReportMetadata = await storageService.buildFileMetadata(auditReportPath);
      const summaryMetadata = await storageService.buildFileMetadata(summaryPath);
      await JobFile.create({
        jobId,
        fileType: 'pr_audit_result_xlsx',
        fileName: auditReportMetadata.fileName,
        filePath: auditReportMetadata.filePath,
        fileSize: auditReportMetadata.fileSize,
        retentionUntil: auditReportMetadata.retentionUntil
      });
      await JobFile.create({
        jobId,
        fileType: 'pr_audit_summary_json',
        fileName: summaryMetadata.fileName,
        filePath: summaryMetadata.filePath,
        fileSize: summaryMetadata.fileSize,
        retentionUntil: summaryMetadata.retentionUntil
      });

      if (options.onOutputsCollected) {
        await options.onOutputsCollected('Approved PR Auditor outputs collected.');
      }

      return {
        workerId: 'pr-auditor',
        workspaceRoot,
        outputRoot,
        pipelineResult: {
          cancelled: false,
          stageResults: stages.map((stage) => ({ stage }))
        },
        outputCollection: {
          outputFileCount: 1,
          auditSummary: {
            normalCount: 4,
            invalidPoCount: 1,
            wrongPoCount: 2,
            duplicatePoCount: 3,
            reviewRequiredCount: 5,
            warnings: ['warning-a', 'warning-b']
          },
          failure: null
        }
      };
    };

    firstServer = await createServer();
    await verifyInvalidWorkbookSafeError(firstServer.baseUrl);
    await verifyMissingUploadRejected(firstServer.baseUrl);
    const scenario = await verifyHappyPathAndReload(firstServer.baseUrl);
    await closeServer(firstServer.server);
    firstServer = null;

    secondServer = await createServer();
    const reloadedHistory = await request(secondServer.baseUrl, `/api/jobs?workerId=pr-auditor&limit=20&page=1`);
    assert.strictEqual(reloadedHistory.response.status, 200, 'PR Auditor history list should load after restart');
    const reloadedItem = reloadedHistory.body.items.find((item) => item.jobId === scenario.jobId);
    assert(reloadedItem, 'reloaded history should include the completed PR Auditor job');
    assert.deepStrictEqual(reloadedItem.auditSummary, {
      normalCount: 4,
      invalidPoCount: 1,
      wrongPoCount: 2,
      duplicatePoCount: 3,
      reviewRequiredCount: 5,
      warnings: ['warning-a', 'warning-b']
    });

    const reloadedDetail = await request(secondServer.baseUrl, `/api/jobs/${encodeURIComponent(scenario.jobId)}`);
    assert.strictEqual(reloadedDetail.response.status, 200, 'PR Auditor detail should load after restart');
    assert.strictEqual(reloadedDetail.body.job.workerDisplayName, 'PR Auditor');
    assert(
      reloadedDetail.body.outputs.some((file) => file.fileType === 'pr_audit_result_xlsx' && file.available),
      'reloaded job detail should expose the audit report workbook as available'
    );

    console.log('--- PR Auditor Route Tests Passed! ---');
  } finally {
    prAuditorAdapter.run = originalRun;
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
  console.error('Test suite failed:', error);
  process.exit(1);
});
