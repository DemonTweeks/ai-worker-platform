const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';

const repoRoot = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'job-control-concurrency-'));

const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const consumedUploadCounts = new Map();

setCachedModule(path.join(repoRoot, 'src/services/prevalidationService.js'), {
  UPLOAD_KINDS: {
    MW_EXPORT: 'mw-export',
    RAN_BOM: 'ran-bom',
    RAN_EPMS: 'ran-epms'
  },
  consumePrevalidatedUpload: async (prevalidatedFileId) => {
    await delay(50);
    consumedUploadCounts.set(prevalidatedFileId, (consumedUploadCounts.get(prevalidatedFileId) || 0) + 1);
    const uploadMap = {
      'mw-upload-1': { uploadKind: 'mw-export', originalFileName: 'mw.xlsx' },
      'mw-upload-2': { uploadKind: 'mw-export', originalFileName: 'mw.xlsx' },
      'ran-bom-1': { uploadKind: 'ran-bom', originalFileName: 'bom.xlsx' },
      'ran-epms-1': { uploadKind: 'ran-epms', originalFileName: 'epms.xlsx' },
      'ran-bom-2': { uploadKind: 'ran-bom', originalFileName: 'bom.xlsx' },
      'ran-epms-2': { uploadKind: 'ran-epms', originalFileName: 'epms.xlsx' }
    };
    const upload = uploadMap[prevalidatedFileId];

    if (!upload) {
      throw new Error(`Unexpected prevalidated upload: ${prevalidatedFileId}`);
    }

    const absolutePath = path.join(tempRoot, `${prevalidatedFileId}.xlsx`);
    await fs.promises.writeFile(absolutePath, prevalidatedFileId, 'utf8');

    return {
      ...upload,
      absolutePath
    };
  }
});

const prevalidationStub = require('../src/services/prevalidationService');
prevalidationStub.getPrevalidatedUpload = prevalidationStub.consumePrevalidatedUpload;

setCachedModule(path.join(repoRoot, 'src/workers/ranProjectCatalogService.js'), {
  listRanProjects: () => ['Project Thanos'],
  validateRanRunConfiguration: ({ runMode, selectedProject }) => ({
    runMode: runMode || 'standard-pr',
    selectedProject: runMode === 'general-item' ? selectedProject : null
  })
});

const storageService = require('../src/services/storageService');
const jobQueue = require('../src/queue/jobQueue');
const { Job, JobFile } = require('../src/models');
const app = require('../src/app');

const originalCreateJobFolders = storageService.createJobFolders;
const originalResolveJobInputPath = storageService.resolveJobInputPath;
const originalResolveJobTempPath = storageService.resolveJobTempPath;
const originalDeleteFileSafe = storageService.deleteFileSafe;
const originalBuildFileMetadata = storageService.buildFileMetadata;
const originalSaveBufferToFile = storageService.saveBufferToFile;
const originalEnqueueJob = jobQueue.enqueueJob;

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const body = await response.json();
  return { response, body };
};

const postJson = (baseUrl, route, body, headers = {}) => request(baseUrl, route, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...headers
  },
  body: JSON.stringify(body)
});

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

const listScopedJobs = async (workerId, idempotencyKey) => (
  Job.find({ workerId, idempotencyKey }).lean()
);

const runConcurrentCreate = async ({ baseUrl, workerId, payload }) => {
  const [first, second] = await Promise.all([
    postJson(baseUrl, '/api/jobs', payload),
    postJson(baseUrl, '/api/jobs', payload)
  ]);

  return [first, second];
};

const runTests = async () => {
  console.log('--- Running Job Control Concurrency & Audit Route Tests ---');
  let serverInfo = null;

  try {
    storageService.createJobFolders = async (jobId) => {
      await fs.promises.mkdir(path.join(tempRoot, jobId), { recursive: true });
      return { jobId };
    };
    storageService.resolveJobInputPath = (jobId, fileName) => {
      const target = path.join(tempRoot, jobId, fileName);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      return target;
    };
    storageService.resolveJobTempPath = (jobId, fileName) => {
      const target = path.join(tempRoot, jobId, fileName);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      return target;
    };
    storageService.deleteFileSafe = async () => {};
    storageService.buildFileMetadata = async (absolutePath) => ({
      filePath: path.relative(storageService.getStorageRoot(), absolutePath).replace(/\\/g, '/'),
      fileName: path.basename(absolutePath),
      fileSize: 16,
      retentionUntil: new Date(Date.now() + 86400000).toISOString()
    });
    storageService.saveBufferToFile = async (targetPath, buffer) => {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, buffer);
    };
    jobQueue.enqueueJob = async (jobId) => {
      await delay(100);
      return {
        queuedJobIds: [jobId],
        activeJobIds: [],
        activeCount: 0,
        queuedCount: 1,
        maxConcurrentJobs: 2
      };
    };

    serverInfo = await createServer();

    const mwIdempotencyKey = 'mw-idempotency-race';
    const mwPayload = {
      workerId: 'mw-pr',
      browserTabSessionId: 'mw-pr-tab-race',
      idempotencyKey: mwIdempotencyKey,
      prevalidatedFileId: 'mw-upload-1',
      generationScope: 'site_code',
      prScope: 'TSS',
      siteCodes: ['ABC123']
    };
    const mwResults = await runConcurrentCreate({
      baseUrl: serverInfo.baseUrl,
      workerId: 'mw-pr',
      payload: mwPayload
    });
    const mwStatuses = mwResults.map((result) => result.response.status).sort();
    assert.deepStrictEqual(mwStatuses, [200, 201], 'MW duplicate concurrent creates should create once and replay once');
    assert.strictEqual(mwResults[0].body.job.jobId, mwResults[1].body.job.jobId, 'MW duplicate concurrent creates should return the same job id');
    const mwJobs = await listScopedJobs('mw-pr', mwIdempotencyKey);
    assert.strictEqual(mwJobs.length, 1, 'MW duplicate concurrent create should persist exactly one job');
    assert.strictEqual(consumedUploadCounts.get('mw-upload-1'), 1, 'MW duplicate concurrent create should consume the upload only once');

    const ranIdempotencyKey = 'ran-idempotency-race';
    const ranPayload = {
      workerId: 'ran-pr',
      browserTabSessionId: 'ran-pr-tab-race',
      idempotencyKey: ranIdempotencyKey,
      bomPrevalidatedFileId: 'ran-bom-1',
      epmsPrevalidatedFileId: 'ran-epms-1',
      runMode: 'general-item',
      selectedProject: 'Project Thanos'
    };
    const ranResults = await runConcurrentCreate({
      baseUrl: serverInfo.baseUrl,
      workerId: 'ran-pr',
      payload: ranPayload
    });
    const ranStatuses = ranResults.map((result) => result.response.status).sort();
    assert.deepStrictEqual(ranStatuses, [200, 201], 'RAN duplicate concurrent creates should create once and replay once');
    assert.strictEqual(ranResults[0].body.job.jobId, ranResults[1].body.job.jobId, 'RAN duplicate concurrent creates should return the same job id');
    const ranJobs = await listScopedJobs('ran-pr', ranIdempotencyKey);
    assert.strictEqual(ranJobs.length, 1, 'RAN duplicate concurrent create should persist exactly one job');
    assert.strictEqual(consumedUploadCounts.get('ran-bom-1'), 1, 'RAN duplicate concurrent create should consume the BOM only once');
    assert.strictEqual(consumedUploadCounts.get('ran-epms-1'), 1, 'RAN duplicate concurrent create should consume the EPMS only once');

    const queuedJob = await Job.create({
      jobId: 'PR-CANCEL-SPOOF',
      workerId: 'mw-pr',
      workerType: 'pr-worker',
      status: 'queued'
    });
    const cancelResult = await postJson(serverInfo.baseUrl, `/api/jobs/${queuedJob.jobId}/cancel`, {
      reasonCode: 'wrong_inputs'
    }, {
      'x-user-name': 'spoofed-user',
      'x-forwarded-user': 'spoofed-forwarded-user'
    });
    assert.strictEqual(cancelResult.response.status, 200, 'queued job should still be cancellable');
    const cancelledDetail = await request(serverInfo.baseUrl, `/api/jobs/${queuedJob.jobId}`);
    assert.strictEqual(cancelledDetail.body.job.cancellation.requestedBy, null, 'spoofed client headers must not become the persisted cancellation actor');

    console.log('--- Job Control Concurrency & Audit Route Tests Passed! ---');
  } finally {
    storageService.createJobFolders = originalCreateJobFolders;
    storageService.resolveJobInputPath = originalResolveJobInputPath;
    storageService.resolveJobTempPath = originalResolveJobTempPath;
    storageService.deleteFileSafe = originalDeleteFileSafe;
    storageService.buildFileMetadata = originalBuildFileMetadata;
    storageService.saveBufferToFile = originalSaveBufferToFile;
    jobQueue.enqueueJob = originalEnqueueJob;
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
