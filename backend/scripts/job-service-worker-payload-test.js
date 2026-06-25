const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const storageService = require('../src/services/storageService');
const jobQueue = require('../src/queue/jobQueue');
const { Job, JobFile, ReviewRequiredItem, WarningItem } = require('../src/models');

const runTests = async () => {
  console.log('--- Running Job Service Worker Payload Tests ---');

  const originalCreateJobFolders = storageService.createJobFolders;
  const originalResolveJobInputPath = storageService.resolveJobInputPath;
  const originalDeleteFileSafe = storageService.deleteFileSafe;
  const originalBuildFileMetadata = storageService.buildFileMetadata;
  const originalResolveJobTempPath = storageService.resolveJobTempPath;
  const originalSaveBufferToFile = storageService.saveBufferToFile;
  const originalEnqueueJob = jobQueue.enqueueJob;
  const originalJobCreate = Job.create;
  const originalJobFind = Job.find;
  const originalJobFindOne = Job.findOne;
  const originalJobCountDocuments = Job.countDocuments;
  const originalJobFileCreate = JobFile.create;
  const originalJobFileFind = JobFile.find;
  const originalReviewRequiredFind = ReviewRequiredItem.find;
  const originalWarningFind = WarningItem.find;

  const tempRoot = path.join(process.cwd(), 'backend', 'tmp-job-service-worker-tests');
  const uploadPath = path.join(tempRoot, 'source.xlsx');
  const copiedInputPath = path.join(tempRoot, 'PR-QA-0001-input.xlsx');
  const requestPath = path.join(tempRoot, 'job-request.json');
  const copiedBuffers = [];
  const createdJobs = [];
  const createdFiles = [];

  try {
    await fs.promises.mkdir(tempRoot, { recursive: true });
    await fs.promises.writeFile(uploadPath, 'upload');

    setCachedModule(path.join(repoRoot, 'src/services/prevalidationService.js'), {
      consumePrevalidatedUpload: async () => ({
        originalFileName: 'worker-input.xlsx',
        absolutePath: uploadPath
      })
    });
    delete require.cache[require.resolve('../src/services/jobService')];
    const jobService = require('../src/services/jobService');

    storageService.createJobFolders = async () => ({
      jobId: 'PR-QA-0001',
      root: tempRoot
    });
    storageService.resolveJobInputPath = () => copiedInputPath;
    storageService.deleteFileSafe = async () => {};
    storageService.buildFileMetadata = async () => ({
      filePath: 'jobs/PR-QA-0001/input/worker-input.xlsx',
      fileSize: 5
    });
    storageService.resolveJobTempPath = () => requestPath;
    storageService.saveBufferToFile = async (_targetPath, buffer) => {
      copiedBuffers.push(buffer.toString('utf8'));
      await fs.promises.writeFile(requestPath, buffer);
      return {};
    };
    jobQueue.enqueueJob = async () => ({
      queuedJobIds: ['PR-QA-0001'],
      activeJobIds: [],
      activeCount: 0,
      queuedCount: 1,
      maxConcurrentJobs: 2
    });
    Job.create = async (payload) => {
      createdJobs.push(payload);
      return {
        ...payload,
        createdAt: '2026-06-26T00:00:00.000Z',
        finalWorkerSummary: payload.finalWorkerSummary || ''
      };
    };
    JobFile.create = async (payload) => {
      createdFiles.push(payload);
      return {
        _id: 'job-file-1',
        ...payload
      };
    };

    const createResult = await jobService.createJob({
      prevalidatedFileId: 'prevalidated-1',
      workerId: 'mw-pr',
      prScope: 'TSS',
      generationScope: 'site_code',
      siteCodes: ['abc001', 'ABC001']
    });

    assert.strictEqual(createResult.job.workerId, 'mw-pr');
    assert.strictEqual(createResult.job.workerDisplayName, 'MW PR Worker');
    assert.strictEqual(createResult.job.engineVersion, 'platform-current');
    assert.strictEqual(createResult.job.engineCommit, 'platform-current');
    assert.strictEqual(createdJobs[0].workerId, 'mw-pr');
    assert.strictEqual(createdJobs[0].engineVersion, 'platform-current');
    assert.strictEqual(createdJobs[0].engineCommit, 'platform-current');
    assert(copiedBuffers[0].includes('"workerId": "mw-pr"'));
    assert.strictEqual(createdFiles[0].fileType, 'uploaded_export');

    await assert.rejects(
      () => jobService.createJob({
        prevalidatedFileId: 'prevalidated-2',
        workerId: 'unknown-worker',
        prScope: 'TSS',
        generationScope: 'all_sites',
        siteCodes: []
      }),
      (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR',
      'unknown worker ids should be rejected'
    );

    await assert.rejects(
      () => jobService.createJob({
        prevalidatedFileId: 'prevalidated-3',
        workerId: 'ran-pr',
        prScope: 'TSS',
        generationScope: 'all_sites',
        siteCodes: []
      }),
      (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR',
      'ran create flow should not be enabled on the legacy route yet'
    );

    const mockJobs = [
      {
        jobId: 'RAN-JOB-001',
        workerId: 'ran-pr',
        workerType: 'pr-worker',
        status: 'completed',
        createdAt: '2026-06-26T00:00:00.000Z',
        generationScope: 'all_sites',
        prScope: 'TSS',
        runMode: 'general-item',
        selectedProject: 'Project Thanos',
        engineVersion: 'v1.0.0',
        engineCommit: '239910e2816153339a94881597bbb95355059741',
        requestedSiteCount: 0,
        matchedSiteCount: 0,
        unmatchedSiteCount: 0,
        outputFileCount: 2,
        reviewRequiredCount: 0,
        warningCount: 0,
        finalWorkerSummary: ''
      },
      {
        jobId: 'MW-JOB-001',
        workerId: 'mw-pr',
        workerType: 'pr-worker',
        status: 'queued',
        createdAt: '2026-06-26T00:00:00.000Z',
        generationScope: 'site_code',
        prScope: 'TI',
        requestedSiteCount: 1,
        matchedSiteCount: 0,
        unmatchedSiteCount: 0,
        outputFileCount: 0,
        reviewRequiredCount: 0,
        warningCount: 0,
        finalWorkerSummary: ''
      }
    ];

    Job.find = (filter) => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => mockJobs.filter((job) => !filter.workerId || job.workerId === filter.workerId)
          })
        })
      })
    });
    Job.countDocuments = async (filter) => mockJobs.filter((job) => !filter.workerId || job.workerId === filter.workerId).length;

    const listResult = await jobService.listJobs({ workerId: 'ran-pr' });
    assert.strictEqual(listResult.items.length, 1);
    assert.strictEqual(listResult.items[0].workerId, 'ran-pr');
    assert.strictEqual(listResult.items[0].workerDisplayName, 'RAN PR Worker');
    assert.strictEqual(listResult.items[0].runMode, 'general-item');
    assert.strictEqual(listResult.items[0].selectedProject, 'Project Thanos');

    const detailJob = {
      ...mockJobs[0],
      startedAt: '2026-06-26T00:10:00.000Z',
      cancelledAt: null,
      assetVersions: {},
      fileRetentionUntil: null
    };

    Job.findOne = async () => detailJob;
    JobFile.find = () => ({
      sort: () => ({
        lean: async () => []
      })
    });
    ReviewRequiredItem.find = () => ({
      sort: () => ({
        lean: async () => []
      })
    });
    WarningItem.find = () => ({
      sort: () => ({
        lean: async () => []
      })
    });

    const detailResult = await jobService.getJobDetail('RAN-JOB-001');
    assert.strictEqual(detailResult.job.workerId, 'ran-pr');
    assert.strictEqual(detailResult.job.workerDisplayName, 'RAN PR Worker');
    assert.strictEqual(detailResult.job.engineVersion, 'v1.0.0');
    assert.strictEqual(detailResult.job.engineCommit, '239910e2816153339a94881597bbb95355059741');
    assert.strictEqual(detailResult.job.runMode, 'general-item');
    assert.strictEqual(detailResult.job.selectedProject, 'Project Thanos');

    console.log('--- Job Service Worker Payload Tests Passed! ---');
  } finally {
    storageService.createJobFolders = originalCreateJobFolders;
    storageService.resolveJobInputPath = originalResolveJobInputPath;
    storageService.deleteFileSafe = originalDeleteFileSafe;
    storageService.buildFileMetadata = originalBuildFileMetadata;
    storageService.resolveJobTempPath = originalResolveJobTempPath;
    storageService.saveBufferToFile = originalSaveBufferToFile;
    jobQueue.enqueueJob = originalEnqueueJob;
    Job.create = originalJobCreate;
    Job.find = originalJobFind;
    Job.findOne = originalJobFindOne;
    Job.countDocuments = originalJobCountDocuments;
    JobFile.create = originalJobFileCreate;
    JobFile.find = originalJobFileFind;
    ReviewRequiredItem.find = originalReviewRequiredFind;
    WarningItem.find = originalWarningFind;
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
