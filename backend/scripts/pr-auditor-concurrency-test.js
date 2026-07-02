const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const xlsx = require('xlsx');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-auditor-concurrency-'));
const app = require('../src/app');
const { Job, JobFile } = require('../src/models');
const storageService = require('../src/services/storageService');
const prAuditorAdapter = require('../src/workers/adapters/prAuditorAdapter');

let idempotencySequence = 0;
const nextIdempotencyKey = () => `pr-auditor-concurrency-${++idempotencySequence}`;
const browserTabSessionId = 'QA-PR-AUDITOR-CONCURRENCY-TAB';
let activeRuns = 0;
let maxConcurrentObserved = 0;
const observedWorkspaceRoots = new Map();

const createWorkbookBuffer = (rows) => {
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, sheet, 'data');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

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

const postJson = (baseUrl, route, body) => request(baseUrl, route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const waitForTerminalDetail = async (baseUrl, jobId, timeoutMs = 30000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    if (result.response.status === 200 && ['completed', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(result.body.job.status)) {
      return result.body;
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach terminal status.`);
};

const prevalidateWorkbook = async (baseUrl, uploadKind, fileName, rows) => {
  const result = await uploadBuffer(baseUrl, '/api/jobs/prevalidate', createWorkbookBuffer(rows), fileName, { uploadKind });
  assert.strictEqual(result.response.status, 200, `${uploadKind} should prevalidate`);
  return result.body.prevalidatedFileId;
};

const createPrAuditorJob = async (baseUrl, sequence) => {
  const finalPoPrevalidatedFileId = await prevalidateWorkbook(baseUrl, 'pr-auditor-final-po', `Final-PO-${sequence}.xlsx`, [['PO'], [String(1000 + sequence)]]);
  const epmsPrevalidatedFileId = await prevalidateWorkbook(baseUrl, 'pr-auditor-epms', `EPMS-${sequence}.xlsx`, [['EPMS'], [String(2000 + sequence)]]);
  const prModelPrevalidatedFileId = await prevalidateWorkbook(baseUrl, 'pr-auditor-pr-model', `PR-Model-${sequence}.xlsx`, [['Model'], [`M-${sequence}`]]);

  const created = await postJson(baseUrl, '/api/jobs', {
    workerId: 'pr-auditor',
    browserTabSessionId,
    idempotencyKey: nextIdempotencyKey(),
    finalPoPrevalidatedFileId,
    epmsPrevalidatedFileId,
    prModelPrevalidatedFileId
  });

  assert.strictEqual(created.response.status, 201, 'PR Auditor job should be created');
  return created.body.job.jobId;
};

const runTests = async () => {
  console.log('--- Running PR Auditor Concurrency Tests ---');
  const originalRun = prAuditorAdapter.run;
  let serverInfo = null;

  try {
    await storageService.ensureBaseStorage();
    await storageService.ensurePrAuditorWorkspaceBase();

    prAuditorAdapter.run = async (jobId, options = {}) => {
      activeRuns += 1;
      maxConcurrentObserved = Math.max(maxConcurrentObserved, activeRuns);

      if (options.onWorkspacePreparing) {
        await options.onWorkspacePreparing('Preparing isolated PR Auditor workspace.');
      }

      const workspaceRoot = path.join(tempRoot, jobId);
      const outputRoot = path.join(workspaceRoot, 'output');
      observedWorkspaceRoots.set(jobId, workspaceRoot);
      await fs.promises.mkdir(outputRoot, { recursive: true });

      if (options.onWorkspacePrepared) {
        await options.onWorkspacePrepared('PR Auditor workspace ready.');
      }

      await delay(400);

      const reportPath = storageService.resolveJobOutputPath(jobId, 'PR_Audit_Result.xlsx');
      await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.promises.writeFile(reportPath, createWorkbookBuffer([['Result'], ['OK']]));
      const reportMetadata = await storageService.buildFileMetadata(reportPath);
      await JobFile.create({
        jobId,
        fileType: 'pr_audit_result_xlsx',
        fileName: reportMetadata.fileName,
        filePath: reportMetadata.filePath,
        fileSize: reportMetadata.fileSize,
        retentionUntil: reportMetadata.retentionUntil
      });

      activeRuns -= 1;

      return {
        workerId: 'pr-auditor',
        workspaceRoot,
        outputRoot,
        pipelineResult: {
          cancelled: false,
          stageResults: [{ stage: 'Generating audit report' }]
        },
        outputCollection: {
          outputFileCount: 1,
          auditSummary: {
            normalCount: 1,
            invalidPoCount: 0,
            wrongPoCount: 0,
            duplicatePoCount: 0,
            reviewRequiredCount: 0,
            warnings: []
          },
          failure: null
        }
      };
    };

    serverInfo = await createServer();
    const [firstJobId, secondJobId] = await Promise.all([
      createPrAuditorJob(serverInfo.baseUrl, 1),
      createPrAuditorJob(serverInfo.baseUrl, 2)
    ]);

    const [firstDetail, secondDetail] = await Promise.all([
      waitForTerminalDetail(serverInfo.baseUrl, firstJobId),
      waitForTerminalDetail(serverInfo.baseUrl, secondJobId)
    ]);

    assert.strictEqual(firstDetail.job.status, 'completed');
    assert.strictEqual(secondDetail.job.status, 'completed');
    assert.strictEqual(maxConcurrentObserved, 2, 'two PR Auditor jobs should run concurrently when capacity allows');
    assert.notStrictEqual(observedWorkspaceRoots.get(firstJobId), observedWorkspaceRoots.get(secondJobId), 'concurrent PR Auditor jobs must use distinct workspace roots');

    const firstReport = await JobFile.findOne({ jobId: firstJobId, fileType: 'pr_audit_result_xlsx' }).lean();
    const secondReport = await JobFile.findOne({ jobId: secondJobId, fileType: 'pr_audit_result_xlsx' }).lean();
    assert(firstReport && secondReport, 'each concurrent PR Auditor job should persist an audit report');
    assert.notStrictEqual(firstReport.filePath, secondReport.filePath, 'concurrent PR Auditor jobs must retain reports under distinct storage paths');

    console.log('--- PR Auditor Concurrency Tests Passed! ---');
  } finally {
    prAuditorAdapter.run = originalRun;
    if (serverInfo) {
      await closeServer(serverInfo.server).catch(() => {});
    }
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    await Promise.all([
      Job.deleteMany({}),
      JobFile.deleteMany({})
    ]).catch(() => {});
  }
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
