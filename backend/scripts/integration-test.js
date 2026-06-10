const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const xlsx = require('xlsx');
const WebSocket = require('ws');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform-test';
process.env.LLM_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-integration-jwt-secret';
process.env.ADMIN_DEFAULT_USERNAME = process.env.ADMIN_DEFAULT_USERNAME || 'qa-admin';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-admin-password';

const app = require('../src/app');
const { checkFirebaseConnection } = require('../src/db/firebase');
const { Job, JobFile, AdminUser, AdminAuditLog, WarningItem, ReviewRequiredItem } = require('../src/models');
const storageService = require('../src/services/storageService');
const { parseIepmsWorkbook } = require('../src/services/iepmsParser');
const { collectOutputs, generateReportsAndPackage } = require('../src/services/outputCollector');
const { ingestTiResultFiles } = require('../src/services/tiResultIngestionService');
const { buildAndSaveSummary } = require('../src/services/summaryBuilder');
const { determineFinalStatus } = require('../src/services/zeroOutputPolicyService');
const { getCleanupPlan, runCleanup } = require('../src/services/cleanupService');
const workerStateService = require('../src/services/workerStateService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');
const { JOB_EVENTS, publishJobEvent } = require('../src/websocket/eventPublisher');
const { answerReAsk } = require('../src/llm/reAskService');

const QA_PREFIX = 'QA15';
const OBSOLETE_QUEUE_SUMMARY = 'Job created and queued. PR Worker execution will run after the worker queue layer is implemented.';
const terminalStatuses = new Set(['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result']);
const cleanupJobIds = new Set();

const repoRoot = path.resolve(__dirname, '../..');
const skillRoot = path.join(repoRoot, 'skills', 'create-pr-cd');
const sampleInputPath = path.join(skillRoot, 'Info', 'input', 'site_pr_po_view.xlsx');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
};

const postJson = (baseUrl, route, body, headers = {}) => request(baseUrl, route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

const uploadFile = async (baseUrl, route, filePath, fieldName = 'file', extraFields = {}) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }
  const buffer = await fs.promises.readFile(filePath);
  formData.append(fieldName, new Blob([buffer]), path.basename(filePath));
  return request(baseUrl, route, { method: 'POST', body: formData });
};

const createWorkbookBuffer = (rows) => {
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, sheet, 'data');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const uploadBuffer = async (baseUrl, route, buffer, fileName) => {
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), fileName);
  return request(baseUrl, route, { method: 'POST', body: formData });
};

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

const cleanDatabase = async () => {
  const qaJobFilter = { $or: [
    { jobId: new RegExp(`^${QA_PREFIX}`) },
    { jobId: new RegExp(`^PR-${QA_PREFIX}`) }
  ] };

  await Promise.all([
    Job.deleteMany(qaJobFilter),
    JobFile.deleteMany(qaJobFilter),
    WarningItem.deleteMany(qaJobFilter),
    ReviewRequiredItem.deleteMany(qaJobFilter),
    AdminUser.deleteMany({ username: /^qa-/ }),
    AdminAuditLog.deleteMany({ admin: /^qa-/ })
  ]);
};

const cleanStorage = async () => {
  for (const jobId of cleanupJobIds) {
    await storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {});
  }
};

const getSampleSiteCode = () => {
  const parsed = parseIepmsWorkbook(sampleInputPath);
  const first = parsed.structuredRows.find((row) => row.siteCode);
  assert(first, 'sample input should contain a site code');
  return first.siteCode;
};

const waitForJobTerminal = async (baseUrl, jobId, timeoutMs = 180000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { response, body } = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert(response.ok, `job detail should load for ${jobId}`);
    if (terminalStatuses.has(body.job.status)) {
      return body;
    }
    await delay(1500);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach terminal state.`);
};

const runJobFlow = async ({ baseUrl, prScope, siteCodes, allowExplainedZeroOutput = false }) => {
  const prevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleInputPath);
  assert(prevalidation.response.ok, `${prScope} prevalidation should pass`);
  assert(prevalidation.body.prevalidatedFileId, 'prevalidation should return file id');

  const created = await postJson(baseUrl, '/api/jobs', {
    prevalidatedFileId: prevalidation.body.prevalidatedFileId,
    prScope,
    generationScope: 'site_code',
    siteCodes
  });
  assert.strictEqual(created.response.status, 201, `${prScope} job should be created`);
  const jobId = created.body.job.jobId;
  cleanupJobIds.add(jobId);
  assert.strictEqual(created.body.job.status, 'queued', `${prScope} job should be created with queued status`);
  assert(!created.body.job.finalWorkerSummary, `${prScope} queued job should not include a final worker summary`);
  assert.notStrictEqual(created.body.job.finalWorkerSummary, OBSOLETE_QUEUE_SUMMARY, `${prScope} queued job should not include obsolete queue text`);
  assert.strictEqual(created.body.message, 'Job record and input file were prepared and queued for PR Worker execution.');
  assert(
    created.body.queue
      && (
        (created.body.queue.queuedJobIds || []).includes(jobId)
        || (created.body.queue.activeJobIds || []).includes(jobId)
      ),
    `${prScope} job should be present in queued or active queue state`
  );

  const detail = await waitForJobTerminal(baseUrl, jobId);
  assert(
    ['completed', 'completed_with_warning'].includes(detail.job.status),
    `${prScope} job should complete, got ${detail.job.status}: ${JSON.stringify(detail.job.error || {})}`
  );
  assert.strictEqual(detail.job.prScope, prScope);
  assert(detail.job.finalWorkerSummary, `${prScope} completed job should include final worker summary`);
  assert.notStrictEqual(detail.job.finalWorkerSummary, OBSOLETE_QUEUE_SUMMARY, `${prScope} final summary should be the real terminal summary`);
  assert.strictEqual(detail.finalWorkerSummary, detail.job.finalWorkerSummary, `${prScope} detail summary should mirror job final summary`);
  assert(detail.outputs.some((file) => file.fileType === 'zip_package' && file.available), 'ZIP package should be tracked and available');
  assert(detail.outputs.some((file) => file.fileType === 'summary'), 'Summary.json should be tracked');

  const zipResponse = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}/download-zip`);
  assert(zipResponse.ok, `${prScope} ZIP download should return success`);
  const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
  const zipText = zipBuffer.toString('latin1');
  assert(zipBuffer.subarray(0, 2).equals(Buffer.from('PK')), 'ZIP should have a ZIP file signature');
  if (detail.job.outputFileCount > 0 || !allowExplainedZeroOutput) {
    assert(zipText.includes('ECC_Output/'), 'ZIP should contain ECC_Output/');
  } else {
    assert(
      (detail.job.warningCount || 0) > 0 || (detail.job.reviewRequiredCount || 0) > 0,
      'zero-output ZIP should be explained by warning or review-required records'
    );
  }
  assert(zipText.includes('Summary.json'), 'ZIP should contain Summary.json');
  if (detail.outputs.some((file) => file.fileType === 'warning_report')) {
    assert(zipText.includes('Error_Warning_Report.xlsx'), 'ZIP should contain warning report when generated');
  }
  if (detail.outputs.some((file) => file.fileType === 'review_required_report')) {
    assert(zipText.includes('Review_Required_Report.xlsx'), 'ZIP should contain review-required report when generated');
  }

  return detail;
};

const testApiAndWorker = async (baseUrl) => {
  const health = await request(baseUrl, '/health');
  assert(health.response.ok || health.response.status === 503, 'health endpoint should respond');
  assert(health.body.services && (health.body.services.firebase || health.body.services.mongodb), 'health should include structured services');

  const list = await request(baseUrl, '/api/jobs');
  assert(list.response.ok, 'job list should load');

  const invalidWorkbook = createWorkbookBuffer([['No Site Column'], ['x']]);
  const invalidPrevalidation = await uploadBuffer(baseUrl, '/api/jobs/prevalidate', invalidWorkbook, 'invalid.xlsx');
  assert.strictEqual(invalidPrevalidation.response.status, 400, 'invalid workbook should be rejected');

  const invalidScope = await postJson(baseUrl, '/api/jobs', {
    prevalidatedFileId: 'not-needed',
    prScope: 'BAD',
    generationScope: 'all_sites',
    siteCodes: []
  });
  assert.strictEqual(invalidScope.response.status, 400, 'invalid prScope should be rejected');

  const siteCode = getSampleSiteCode();
  const tssDetail = await runJobFlow({ baseUrl, prScope: 'TSS', siteCodes: [siteCode.toLowerCase(), siteCode, 'QA15_UNMATCHED'] });
  assert(tssDetail.warnings.length >= 1, 'duplicate/unmatched site codes should create warnings');

  let tiResult = 'not_run';
  try {
    const tiDetail = await runJobFlow({ baseUrl, prScope: 'TI', siteCodes: [siteCode], allowExplainedZeroOutput: true });
    tiResult = tiDetail.job.status;
  } catch (error) {
    tiResult = `blocked:${error.message}`;
  }

  const ask = await postJson(baseUrl, `/api/jobs/${encodeURIComponent(tssDetail.job.jobId)}/ask`, {
    question: 'What is the job status?'
  });
  assert(ask.response.ok, 'Re-Ask fallback should respond');
  assert.strictEqual(ask.body.answerSource, 'fallback');

  return {
    tssJobId: tssDetail.job.jobId,
    tssStatus: tssDetail.job.status,
    tiResult
  };
};

const writeOutputFile = async (jobId, fileName, content) => {
  const filePath = storageService.resolveJobOutputPath(jobId, fileName);
  await fs.promises.writeFile(filePath, content, 'utf8');
  return filePath;
};

const createTiResultScenario = async ({ suffix, files, matchedSiteCount = 1 }) => {
  const jobId = `${QA_PREFIX}-TI-${suffix}-${Date.now()}`;
  cleanupJobIds.add(jobId);
  await storageService.createJobFolders(jobId);
  await Job.create({
    jobId,
    workerType: 'pr-worker',
    status: 'exporting',
    generationScope: 'site_code',
    prScope: 'TI'
  });

  for (const file of files) {
    await writeOutputFile(jobId, file.name, file.content);
  }

  const outputCollection = await collectOutputs(jobId);
  const ingestion = await ingestTiResultFiles(jobId);
  const summary = await buildAndSaveSummary({
    jobId,
    filteringResult: {
      requestedSiteCount: matchedSiteCount,
      matchedSiteCount,
      unmatchedSiteCount: 0
    },
    outputCollection
  });

  const finalStatus = determineFinalStatus(summary);
  await Job.updateOne({ jobId }, { $set: { status: finalStatus, completedAt: new Date() } });
  const reports = await generateReportsAndPackage(jobId);
  const filesAfter = await JobFile.find({ jobId }).sort({ createdAt: 1 }).lean();
  const zip = filesAfter.find((file) => file.fileType === 'zip_package');
  assert(zip, `${suffix} ZIP should be generated`);
  const zipPath = path.join(storageService.getStorageRoot(), zip.filePath);
  const zipBuffer = await fs.promises.readFile(zipPath);
  const zipText = zipBuffer.toString('latin1');

  return { jobId, outputCollection, ingestion, summary, finalStatus, reports, filesAfter, zipText };
};

const testTiResultHandling = async () => {
  const ecc = await createTiResultScenario({
    suffix: 'ECC',
    files: [
      { name: 'TI_ECC_Output.xlsx', content: 'placeholder ecc workbook' }
    ]
  });
  assert.strictEqual(ecc.summary.outputFileCount, 1, 'TI ECC scenario should count ECC output');
  assert.strictEqual(ecc.finalStatus, 'completed', 'TI ECC scenario should complete');
  assert(ecc.zipText.includes('ECC_Output/TI_ECC_Output.xlsx'), 'TI ECC ZIP should contain ECC output');

  const reviewOnly = await createTiResultScenario({
    suffix: 'REVIEW',
    files: [
      {
        name: 'REVIEW_REQUIRED_TI_20260610.csv',
        content: 'Site_ID,Region,SubCon_TI,Tx_SOW,Review_Reason,Source_Scope\nTI001,North,Vendor A,MW Re-engineering,MW Re-engineering follow-up required,TI\n'
      }
    ]
  });
  assert.strictEqual(reviewOnly.summary.outputFileCount, 0, 'review-only TI should have zero ECC output');
  assert.strictEqual(reviewOnly.summary.reviewRequiredCount, 1, 'review-only TI should persist review item');
  assert.strictEqual(reviewOnly.finalStatus, 'completed_with_warning', 'review-only TI should complete with warning');
  assert(reviewOnly.zipText.includes('Create_PR_CD_Source/REVIEW_REQUIRED_TI_20260610.csv'), 'review-only ZIP should preserve source review CSV');
  assert(reviewOnly.zipText.includes('Review_Required_Report.xlsx'), 'review-only ZIP should include platform review report');
  assert(reviewOnly.zipText.includes('Summary.json'), 'review-only ZIP should include Summary.json');

  const duplicates = await createTiResultScenario({
    suffix: 'DUP',
    files: [
      {
        name: 'DUPLICATES_SKIPPED_TI_20260610.csv',
        content: 'Site_ID,Region,SubCon_TI,Tx_SOW,Existing_PR,Reason\nTI002,South,Vendor B,TI Install,PR123,Duplicate - PR already exists\n'
      }
    ]
  });
  assert.strictEqual(duplicates.summary.outputFileCount, 0, 'duplicate TI should have zero ECC output');
  assert.strictEqual(duplicates.summary.warningCount, 1, 'duplicate TI should persist warning item');
  assert.strictEqual(duplicates.finalStatus, 'completed_with_warning', 'duplicate TI should complete with warning');
  assert(duplicates.zipText.includes('Create_PR_CD_Source/DUPLICATES_SKIPPED_TI_20260610.csv'), 'duplicate ZIP should preserve source duplicate CSV');
  assert(duplicates.zipText.includes('Error_Warning_Report.xlsx'), 'duplicate ZIP should include platform warning report');

  const unexplainedJobId = `${QA_PREFIX}-TI-ZERO-${Date.now()}`;
  cleanupJobIds.add(unexplainedJobId);
  await storageService.createJobFolders(unexplainedJobId);
  await Job.create({
    jobId: unexplainedJobId,
    workerType: 'pr-worker',
    status: 'exporting',
    generationScope: 'site_code',
    prScope: 'TI'
  });
  const unexplainedCollection = await collectOutputs(unexplainedJobId);
  const unexplainedSummary = await buildAndSaveSummary({
    jobId: unexplainedJobId,
    filteringResult: {
      requestedSiteCount: 1,
      matchedSiteCount: 1,
      unmatchedSiteCount: 0
    },
    outputCollection: unexplainedCollection
  });
  assert.throws(
    () => determineFinalStatus(unexplainedSummary),
    (error) => error.code === 'ZERO_OUTPUT_WITHOUT_EXPLANATION',
    'zero TI output without review/warning explanation should fail with ZERO_OUTPUT_WITHOUT_EXPLANATION'
  );

  return {
    ecc: { jobId: ecc.jobId, status: ecc.finalStatus, files: ecc.filesAfter.map((file) => file.fileName) },
    reviewOnly: { jobId: reviewOnly.jobId, status: reviewOnly.finalStatus, files: reviewOnly.filesAfter.map((file) => file.fileName) },
    duplicates: { jobId: duplicates.jobId, status: duplicates.finalStatus, files: duplicates.filesAfter.map((file) => file.fileName) },
    unexplained: { jobId: unexplainedJobId, errorCode: 'ZERO_OUTPUT_WITHOUT_EXPLANATION' }
  };
};

const testAdminApi = async (baseUrl) => {
  const protectedAssets = await request(baseUrl, '/api/admin/assets');
  assert.strictEqual(protectedAssets.response.status, 401, 'admin assets should require auth');

  const badLogin = await postJson(baseUrl, '/api/admin/login', { username: 'qa-admin', password: 'wrong' });
  assert.strictEqual(badLogin.response.status, 401, 'invalid login should be rejected');

  const login = await postJson(baseUrl, '/api/admin/login', {
    username: process.env.ADMIN_DEFAULT_USERNAME,
    password: process.env.ADMIN_DEFAULT_PASSWORD
  });
  assert(login.response.ok, 'valid admin login should succeed');
  assert(login.body.token, 'admin login should return token');
  const auth = { Authorization: `Bearer ${login.body.token}` };

  const formData = new FormData();
  const buffer = await fs.promises.readFile(sampleInputPath);
  formData.append('file', new Blob([buffer]), 'qa-pr-model.xlsx');
  const uploadAuthed = await request(baseUrl, '/api/admin/assets/upload', {
    method: 'POST',
    headers: auth,
    body: formData
  });
  assert.strictEqual(uploadAuthed.response.status, 409, 'asset upload should be disabled for business files');

  const audit = await request(baseUrl, '/api/admin/audit-logs', { headers: auth });
  assert(audit.response.ok, 'audit log list should load');

  return { assetManagementDisabled: true };
};

const wsExchange = (ws, payload) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('WebSocket response timeout')), 10000);
  ws.once('message', (data) => {
    clearTimeout(timeout);
    resolve(JSON.parse(data.toString()));
  });
  ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
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

const terminateWs = (ws) => {
  if (ws && ws.readyState !== WebSocket.CLOSED) {
    ws.terminate();
  }
};

const testWebSocket = async (wsUrl) => {
  const jobId = `PR-${QA_PREFIX}-WS`;
  await Job.create({ jobId, workerType: 'pr-worker', status: 'generating', generationScope: 'site_code', prScope: 'TSS' });
  cleanupJobIds.add(jobId);
  workerStateService.createState(jobId, 'GENERATION_STARTED');

  let ws = null;
  let ws2 = null;

  try {
    ws = new WebSocket(wsUrl);
    await waitForWsOpen(ws);

    const malformed = await wsExchange(ws, '{');
    assert.strictEqual(malformed.type, 'ERROR');

    const invalid = await wsExchange(ws, { action: 'subscribe', jobId: 'PR-NOTFOUND' });
    assert.strictEqual(invalid.type, 'ERROR');

    const subscribed = await wsExchange(ws, { action: 'subscribe', jobId });
    assert.strictEqual(subscribed.type, 'SUBSCRIBED');

    const eventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('JOB_EVENT timeout')), 10000);
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'JOB_EVENT') {
          clearTimeout(timeout);
          resolve(message);
        }
      });
    });
    await publishJobEvent(jobId, JOB_EVENTS.GENERATION_STARTED, {
      phase: 'GENERATION_STARTED',
      status: 'generating',
      message: 'QA WebSocket event.'
    });
    const event = await eventPromise;
    assert.strictEqual(event.type, 'JOB_EVENT');

    terminateWs(ws);
    await delay(200);

    ws2 = new WebSocket(wsUrl);
    await waitForWsOpen(ws2);
    const resubscribed = await wsExchange(ws2, { action: 'subscribe', jobId });
    assert.strictEqual(resubscribed.type, 'SUBSCRIBED');

    return { jobId };
  } finally {
    terminateWs(ws);
    terminateWs(ws2);
  }
};

const testResourceProtection = async () => {
  const oldJobId = `${QA_PREFIX}-CLEANUP-OLD`;
  const activeJobId = `${QA_PREFIX}-CLEANUP-ACTIVE`;
  cleanupJobIds.add(oldJobId);
  cleanupJobIds.add(activeJobId);
  const now = new Date('2026-05-20T00:00:00.000Z');
  const expired = new Date('2026-05-19T00:00:00.000Z');

  await storageService.createJobFolders(oldJobId);
  await storageService.createJobFolders(activeJobId);
  const oldPath = storageService.resolveJobOutputPath(oldJobId, 'old-output.txt');
  const activePath = storageService.resolveJobOutputPath(activeJobId, 'active-output.txt');
  await fs.promises.writeFile(oldPath, 'old');
  await fs.promises.writeFile(activePath, 'active');
  const oldMeta = await storageService.buildFileMetadata(oldPath);
  const activeMeta = await storageService.buildFileMetadata(activePath);

  await Job.create({ jobId: oldJobId, workerType: 'pr-worker', status: 'completed' });
  await Job.create({ jobId: activeJobId, workerType: 'pr-worker', status: 'generating' });
  await JobFile.create({ jobId: oldJobId, fileType: 'ecc_output', fileName: oldMeta.fileName, filePath: oldMeta.filePath, fileSize: oldMeta.fileSize, retentionUntil: expired });
  await JobFile.create({ jobId: activeJobId, fileType: 'ecc_output', fileName: activeMeta.fileName, filePath: activeMeta.filePath, fileSize: activeMeta.fileSize, retentionUntil: expired });

  const dryRun = await getCleanupPlan({ dryRun: true, now });
  assert(dryRun.candidates.some((file) => file.jobId === oldJobId));
  assert(fs.existsSync(oldPath), 'dry-run should not delete files');
  const actual = await runCleanup({ dryRun: false, now });
  assert(actual.deleted.some((file) => file.jobId === oldJobId));
  assert(!fs.existsSync(oldPath), 'actual cleanup should delete expired terminal file');
  assert(fs.existsSync(activePath), 'active job file should remain');

  return { dryRunCandidates: dryRun.candidates.length, deleted: actual.deleted.length };
};

const main = async () => {
  let serverInfo = null;
  const results = {};

  try {
    const conn = await checkFirebaseConnection();
    assert(conn.connected, 'Firebase RTDB should be reachable for testing');
    await storageService.ensureBaseStorage();
    await cleanDatabase();
    serverInfo = await createServer();

    results.apiWorker = await testApiAndWorker(serverInfo.baseUrl);
    results.tiResultHandling = await testTiResultHandling();
    results.admin = await testAdminApi(serverInfo.baseUrl);
    results.websocket = await testWebSocket(serverInfo.wsUrl);
    results.resourceProtection = await testResourceProtection();

    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } finally {
    if (serverInfo) {
      await closeServer(serverInfo.server).catch(() => {});
    }
    await cleanDatabase().catch(() => {});
    await cleanStorage().catch(() => {});
  }
};

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
