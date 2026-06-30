const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { matchFilter } = require('../src/models/compatibility');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const storageService = require('../src/services/storageService');
const jobQueue = require('../src/queue/jobQueue');
const workerStateService = require('../src/services/workerStateService');
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
      UPLOAD_KINDS: {
        MW_EXPORT: 'mw-export',
        RAN_BOM: 'ran-bom',
        RAN_EPMS: 'ran-epms'
      },
      consumePrevalidatedUpload: async (prevalidatedFileId) => {
        if (prevalidatedFileId === 'ran-bom-1') {
          return {
            uploadKind: 'ran-bom',
            originalFileName: 'ran-bom.xlsx',
            absolutePath: uploadPath
          };
        }

        if (prevalidatedFileId === 'ran-epms-1') {
          return {
            uploadKind: 'ran-epms',
            originalFileName: 'ran-epms.xlsx',
            absolutePath: uploadPath
          };
        }

        return {
          uploadKind: 'mw-export',
          originalFileName: 'worker-input.xlsx',
          absolutePath: uploadPath
        };
      }
    });
    setCachedModule(path.join(repoRoot, 'src/workers/ranProjectCatalogService.js'), {
      validateRanRunConfiguration: ({ runMode, selectedProject }) => {
        if (runMode !== 'general-item' && runMode !== 'standard-pr') {
          const error = new Error('RAN run mode must be standard-pr or general-item.');
          error.code = 'INVALID_RAN_RUN_MODE';
          throw error;
        }

        return {
          runMode,
          selectedProject: runMode === 'general-item' ? selectedProject : null
        };
      }
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
      const createdJob = {
        ...payload,
        createdAt: '2026-06-26T00:00:00.000Z',
        finalWorkerSummary: payload.finalWorkerSummary || ''
      };
      createdJobs.push(createdJob);
      return createdJob;
    };
    Job.find = (filter = {}) => ({
      sort: () => ({
        limit: () => ({
          lean: async () => createdJobs.filter((job) => matchFilter(job, filter))
        }),
        skip: () => ({
          limit: () => ({
            lean: async () => createdJobs.filter((job) => matchFilter(job, filter))
          })
        })
      })
    });
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
      browserTabSessionId: 'mw-pr-tab-1234',
      idempotencyKey: 'mw-idem-1234',
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
    assert.strictEqual(createdJobs[0].browserTabSessionId, 'mw-pr-tab-1234');
    assert.strictEqual(createdJobs[0].idempotencyKey, 'mw-idem-1234');
    assert(copiedBuffers[0].includes('"workerId": "mw-pr"'));
    assert.strictEqual(createdFiles[0].fileType, 'uploaded_export');
    assert.strictEqual(createdJobs[0].browserTabSessionId, 'mw-pr-tab-1234');

    const duplicateMwResult = await jobService.createJob({
        prevalidatedFileId: 'prevalidated-duplicate',
        workerId: 'mw-pr',
        browserTabSessionId: 'mw-pr-tab-1234',
        idempotencyKey: 'mw-idem-1234',
        prScope: 'TSS',
        generationScope: 'site_code',
        siteCodes: ['ABC001']
      });
    assert.strictEqual(duplicateMwResult.job.jobId, createResult.job.jobId, 'duplicate MW submissions should replay the existing job');
    assert.strictEqual(createdJobs.length, 1, 'duplicate MW submissions should not create a second job');

    createdJobs.length = 0;
    createdFiles.length = 0;
    copiedBuffers.length = 0;

    const ranCreateResult = await jobService.createJob({
      workerId: 'ran-pr',
      browserTabSessionId: 'ran-pr-tab-1234',
      idempotencyKey: 'ran-idem-1234',
      bomPrevalidatedFileId: 'ran-bom-1',
      epmsPrevalidatedFileId: 'ran-epms-1',
      runMode: 'general-item',
      selectedProject: 'Project Thanos'
    });

    assert.strictEqual(ranCreateResult.job.workerId, 'ran-pr');
    assert.strictEqual(ranCreateResult.job.workerDisplayName, 'RAN PR Worker');
    assert.strictEqual(ranCreateResult.job.engineVersion, 'v1.0.0');
    assert.strictEqual(ranCreateResult.job.engineCommit, '239910e2816153339a94881597bbb95355059741');
    assert.strictEqual(ranCreateResult.job.runMode, 'general-item');
    assert.strictEqual(ranCreateResult.job.selectedProject, 'Project Thanos');
    assert.strictEqual(ranCreateResult.job.prScope, null);
    assert.strictEqual(createdJobs[0].workerId, 'ran-pr');
    assert.strictEqual(createdJobs[0].runMode, 'general-item');
    assert.strictEqual(createdJobs[0].selectedProject, 'Project Thanos');
    assert.strictEqual(createdFiles.length, 2);
    assert.deepStrictEqual(
      createdFiles.map((file) => file.fileType).sort(),
      ['ran_bom_upload', 'ran_epms_upload']
    );
    assert(copiedBuffers[0].includes('"workerId": "ran-pr"'));
    assert(copiedBuffers[0].includes('"runMode": "general-item"'));
    assert(copiedBuffers[0].includes('"selectedProject": "Project Thanos"'));
    assert.strictEqual(createdJobs[0].browserTabSessionId, 'ran-pr-tab-1234');
    assert.strictEqual(createdJobs[0].idempotencyKey, 'ran-idem-1234');

    const duplicateRanResult = await jobService.createJob({
        workerId: 'ran-pr',
        browserTabSessionId: 'ran-pr-tab-1234',
        idempotencyKey: 'ran-idem-1234',
        bomPrevalidatedFileId: 'ran-bom-1',
        epmsPrevalidatedFileId: 'ran-epms-1',
        runMode: 'general-item',
        selectedProject: 'Project Thanos'
      });
    assert.strictEqual(duplicateRanResult.job.jobId, ranCreateResult.job.jobId, 'duplicate RAN submissions should replay the existing job');
    assert.strictEqual(createdJobs.length, 1, 'duplicate RAN submissions should not create a second job');

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
        workerId: 'ran-pr',
        bomPrevalidatedFileId: 'ran-bom-1',
        epmsPrevalidatedFileId: 'ran-epms-1',
        runMode: 'unsupported-mode'
      }),
      (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR',
      'invalid ran run modes should be rejected'
    );

    const mockJobs = [
      {
        jobId: 'RAN-JOB-001',
        workerId: 'ran-pr',
        workerType: 'pr-worker',
        status: 'completed',
        browserTabSessionId: 'ran-pr-tab-1234',
        idempotencyKey: 'ran-idem-1234',
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
        browserTabSessionId: 'mw-pr-tab-1234',
        idempotencyKey: 'mw-idem-1234',
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
            lean: async () => mockJobs.filter((job) => (
              (!filter.workerId || job.workerId === filter.workerId)
              && (!filter.browserTabSessionId || job.browserTabSessionId === filter.browserTabSessionId)
            ))
          })
        })
      })
    });
    Job.countDocuments = async (filter) => mockJobs.filter((job) => (
      (!filter.workerId || job.workerId === filter.workerId)
      && (!filter.browserTabSessionId || job.browserTabSessionId === filter.browserTabSessionId)
    )).length;

    const listResult = await jobService.listJobs({ workerId: 'ran-pr', browserTabSessionId: 'ran-pr-tab-1234' });
    assert.strictEqual(listResult.items.length, 1);
    assert.strictEqual(listResult.items[0].workerId, 'ran-pr');
    assert.strictEqual(listResult.items[0].workerDisplayName, 'RAN PR Worker');
    assert.strictEqual(listResult.items[0].runMode, 'general-item');
    assert.strictEqual(listResult.items[0].selectedProject, 'Project Thanos');
    assert.strictEqual(listResult.items[0].browserTabSessionId, 'ran-pr-tab-1234');
    assert.strictEqual(listResult.items[0].idempotencyKey, 'ran-idem-1234');

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

    const queuedCancellationJob = {
      jobId: 'MW-CANCEL-QUEUED',
      workerId: 'mw-pr',
      workerType: 'pr-worker',
      status: 'queued',
      createdAt: '2026-06-26T00:00:00.000Z',
      requestedSiteCount: 0,
      matchedSiteCount: 0,
      unmatchedSiteCount: 0,
      outputFileCount: 0,
      reviewRequiredCount: 0,
      warningCount: 0,
      finalWorkerSummary: '',
      save: async function save() { return this; }
    };
    Job.findOne = async ({ jobId }) => (jobId === queuedCancellationJob.jobId ? queuedCancellationJob : null);
    jobQueue.cancelQueuedJob = async () => ({ cancelled: true, running: false, alreadyRequested: false });

    const queuedCancellationResult = await jobService.cancelJob(queuedCancellationJob.jobId, {
      reasonCode: 'wrong_inputs',
      reasonText: 'BOM and EPMS were swapped'
    }, {
      requestedBy: 'qa-user'
    });
    assert.strictEqual(queuedCancellationResult.job.status, 'cancelled');
    assert.strictEqual(queuedCancellationJob.cancellation.requestedBy, 'qa-user');
    assert.strictEqual(queuedCancellationJob.cancellation.reasonCode, 'wrong_inputs');
    assert.strictEqual(queuedCancellationJob.cancellation.finalStatus, 'cancelled');
    assert.strictEqual(queuedCancellationJob.statusEvents.length, 2, 'queued cancellation should record requested and completed events once');

    const runningCancellationJob = {
      jobId: 'RAN-CANCEL-RUNNING',
      workerId: 'ran-pr',
      workerType: 'pr-worker',
      status: 'generating',
      createdAt: '2026-06-26T00:00:00.000Z',
      requestedSiteCount: 0,
      matchedSiteCount: 0,
      unmatchedSiteCount: 0,
      outputFileCount: 0,
      reviewRequiredCount: 0,
      warningCount: 0,
      finalWorkerSummary: '',
      save: async function save() { return this; }
    };
    Job.findOne = async ({ jobId }) => (jobId === runningCancellationJob.jobId ? runningCancellationJob : null);
    jobQueue.cancelQueuedJob = async () => ({ cancelled: false, running: true, alreadyRequested: false });

    const runningCancellationResult = await jobService.cancelJob(runningCancellationJob.jobId, {
      reasonCode: 'long_running'
    }, {
      requestedBy: 'qa-user'
    });
    assert.strictEqual(runningCancellationResult.job.status, 'cancelling');
    assert.strictEqual(runningCancellationJob.status, 'cancelling');
    assert.strictEqual(runningCancellationJob.statusEvents.length, 1, 'running cancellation should not duplicate completion events before terminal state');

    const repeatedCancellationResult = await jobService.cancelJob(runningCancellationJob.jobId, {
      reasonCode: 'long_running'
    }, {
      requestedBy: 'qa-user'
    });
    assert.strictEqual(repeatedCancellationResult.job.status, 'cancelling');
    assert.strictEqual(runningCancellationJob.statusEvents.length, 1, 'repeated cancellation requests should be idempotent');

    const orphanedRunningJob = {
      jobId: 'MW-CANCEL-ORPHAN',
      workerId: 'mw-pr',
      workerType: 'pr-worker',
      status: 'generating',
      outputFileCount: 0,
      createdAt: '2026-06-26T00:00:00.000Z',
      requestedSiteCount: 0,
      matchedSiteCount: 0,
      unmatchedSiteCount: 0,
      reviewRequiredCount: 0,
      warningCount: 0,
      finalWorkerSummary: '',
      save: async function save() { return this; }
    };
    workerStateService.createState(orphanedRunningJob.jobId, 'GENERATION_STARTED');
    Job.findOne = async ({ jobId }) => (jobId === orphanedRunningJob.jobId ? orphanedRunningJob : null);
    jobQueue.cancelQueuedJob = async () => ({ cancelled: false, running: false, alreadyRequested: false });

    const orphanedCancellationResult = await jobService.cancelJob(orphanedRunningJob.jobId, {
      reasonCode: 'long_running'
    }, {
      requestedBy: 'qa-user'
    });
    assert.strictEqual(orphanedCancellationResult.job.status, 'cancelled', 'stale workerState must not keep an orphaned runtime job in cancelling');
    assert.strictEqual(orphanedRunningJob.status, 'cancelled', 'orphaned runtime jobs should resolve to a terminal status immediately');
    assert.strictEqual(orphanedRunningJob.cancellation.finalStatus, 'cancelled', 'orphaned runtime cancellation should persist the terminal final status');
    assert.strictEqual(orphanedRunningJob.statusEvents.length, 2, 'orphaned runtime cancellation should record requested and completed events');

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
