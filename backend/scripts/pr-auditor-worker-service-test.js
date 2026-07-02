const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running PR Auditor Worker Service Tests ---');

  const metadataUpdates = [];
  const publishedEvents = [];
  const savedSummaries = [];
  const currentJobState = {
    jobId: 'PR-AUDIT-001',
    workerId: 'pr-auditor',
    workerType: 'pr-worker',
    status: 'queued',
    outputFileCount: 0,
    reviewRequiredCount: 0,
    warningCount: 0,
    auditSummary: null,
    finalWorkerSummary: '',
    save: async function save() { return this; }
  };

  setCachedModule(path.join(repoRoot, 'src/models/index.js'), {
    Job: {
      findOne: async ({ jobId }) => (jobId === currentJobState.jobId ? currentJobState : null),
      updateOne: async (_filter, update) => {
        metadataUpdates.push(update.$set);
        Object.assign(currentJobState, update.$set);
        return { ok: 1, nModified: 1 };
      }
    }
  });

  const workerStateService = require('../src/services/workerStateService');
  const originalStateMethods = {
    createState: workerStateService.createState,
    getOrCreateState: workerStateService.getOrCreateState,
    setPhase: workerStateService.setPhase,
    setProgress: workerStateService.setProgress,
    setCancelled: workerStateService.setCancelled,
    setComplete: workerStateService.setComplete,
    setError: workerStateService.setError,
    isCancellationRequested: workerStateService.isCancellationRequested
  };

  try {
    setCachedModule(path.join(repoRoot, 'src/websocket/eventPublisher.js'), {
      JOB_EVENTS: {
        ASSET_LOADING_STARTED: 'ASSET_LOADING_STARTED',
        ASSET_LOADING_COMPLETED: 'ASSET_LOADING_COMPLETED',
        GENERATION_STARTED: 'GENERATION_STARTED',
        OUTPUT_COLLECTION_STARTED: 'OUTPUT_COLLECTION_STARTED',
        OUTPUT_COLLECTION_COMPLETED: 'OUTPUT_COLLECTION_COMPLETED',
        JOB_COMPLETED: 'JOB_COMPLETED',
        JOB_CANCELLED: 'JOB_CANCELLED',
        JOB_FAILED: 'JOB_FAILED'
      },
      publishJobEvent: async (jobId, event, payload) => {
        publishedEvents.push({ jobId, event, payload });
        return { jobId, event, payload };
      }
    });

    setCachedModule(path.join(repoRoot, 'src/services/finalSummaryService.js'), {
      saveFinalSummary: async ({ jobId, summary, statusOverride }) => {
        savedSummaries.push({ jobId, summary, statusOverride });
        return `PR Auditor completed with ${summary.outputFileCount} audit report(s).`;
      }
    });

    setCachedModule(path.join(repoRoot, 'src/workers/adapters/prAuditorAdapter.js'), {
      run: async (_jobId, options = {}) => {
        if (options.onWorkspacePreparing) {
          await options.onWorkspacePreparing('Preparing isolated PR Auditor workspace.');
        }
        if (options.onWorkspacePrepared) {
          await options.onWorkspacePrepared('PR Auditor workspace ready.');
        }
        if (options.onStageStarted) {
          await options.onStageStarted({ stageLabel: 'Validating files', index: 0, total: 6 });
          await options.onStageStarted({ stageLabel: 'Generating audit report', index: 5, total: 6 });
        }
        if (options.onOutputsCollecting) {
          await options.onOutputsCollecting('Collecting approved PR Auditor outputs.');
        }
        if (options.onOutputsCollected) {
          await options.onOutputsCollected('Approved PR Auditor outputs collected.');
        }

        return {
          workerId: 'pr-auditor',
          pipelineResult: {
            cancelled: false,
            stageResults: [
              { stage: 'Validating files' },
              { stage: 'Generating audit report' }
            ]
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
      }
    });

    const prAuditorWorkerService = require('../src/services/prAuditorWorkerService');

    workerStateService.createState(currentJobState.jobId);
    const successSummary = await prAuditorWorkerService.runPrAuditorWorkerJob(currentJobState.jobId);

    assert.strictEqual(successSummary.status, 'completed');
    assert.strictEqual(currentJobState.status, 'completed');
    assert.strictEqual(currentJobState.outputFileCount, 1);
    assert.strictEqual(currentJobState.reviewRequiredCount, 5);
    assert.strictEqual(currentJobState.warningCount, 2);
    assert.deepStrictEqual(currentJobState.auditSummary, {
      normalCount: 4,
      invalidPoCount: 1,
      wrongPoCount: 2,
      duplicatePoCount: 3,
      reviewRequiredCount: 5,
      warnings: ['warning-a', 'warning-b']
    });
    assert.strictEqual(currentJobState.finalWorkerSummary, 'PR Auditor completed with 1 audit report(s).');
    assert.strictEqual(savedSummaries.length, 1);
    assert(metadataUpdates.some((update) => update.status === 'loading_assets'));
    assert(metadataUpdates.some((update) => update.status === 'generating'));
    assert(metadataUpdates.some((update) => update.status === 'exporting'));
    assert(metadataUpdates.some((update) => update.status === 'completed'));
    assert(publishedEvents.some((entry) => entry.event === 'JOB_COMPLETED'));

    metadataUpdates.length = 0;
    publishedEvents.length = 0;
    savedSummaries.length = 0;
    currentJobState.status = 'queued';
    currentJobState.outputFileCount = 0;
    currentJobState.reviewRequiredCount = 0;
    currentJobState.warningCount = 0;
    currentJobState.auditSummary = null;
    currentJobState.finalWorkerSummary = '';

    setCachedModule(path.join(repoRoot, 'src/workers/adapters/prAuditorAdapter.js'), {
      run: async (_jobId, options = {}) => {
        if (options.onWorkspacePreparing) {
          await options.onWorkspacePreparing('Preparing isolated PR Auditor workspace.');
        }

        return {
          workerId: 'pr-auditor',
          pipelineResult: {
            cancelled: true,
            stageResults: [{ stage: 'Validating files', cancelled: true }]
          },
          outputCollection: {
            outputFileCount: 1,
            auditSummary: {
              normalCount: 4,
              invalidPoCount: 1,
              wrongPoCount: 2,
              duplicatePoCount: 3,
              reviewRequiredCount: 5,
              warnings: ['warning-a']
            },
            failure: null
          }
        };
      }
    });

    delete require.cache[require.resolve('../src/services/prAuditorWorkerService')];
    const cancellationService = require('../src/services/prAuditorWorkerService');
    workerStateService.createState(currentJobState.jobId);

    const cancelledSummary = await cancellationService.runPrAuditorWorkerJob(currentJobState.jobId);
    assert.strictEqual(cancelledSummary.status, 'cancelled_with_partial_result');
    assert.strictEqual(currentJobState.status, 'cancelled_with_partial_result');
    assert.strictEqual(savedSummaries.length, 1);
    assert(publishedEvents.some((entry) => entry.event === 'JOB_CANCELLED'));
    assert.strictEqual(workerStateService.getState(currentJobState.jobId).phase, 'CANCELLED');

    metadataUpdates.length = 0;
    publishedEvents.length = 0;
    savedSummaries.length = 0;
    currentJobState.status = 'queued';
    currentJobState.outputFileCount = 0;
    currentJobState.reviewRequiredCount = 0;
    currentJobState.warningCount = 0;
    currentJobState.auditSummary = null;
    currentJobState.finalWorkerSummary = '';
    currentJobState.error = null;

    setCachedModule(path.join(repoRoot, 'src/workers/adapters/prAuditorAdapter.js'), {
      run: async (_jobId, options = {}) => {
        if (options.onWorkspacePreparing) {
          await options.onWorkspacePreparing('Preparing isolated PR Auditor workspace.');
        }
        if (options.onOutputsCollecting) {
          await options.onOutputsCollecting('Collecting approved PR Auditor outputs.');
        }

        return {
          workerId: 'pr-auditor',
          pipelineResult: {
            cancelled: false,
            stageResults: [{ stage: 'Generating audit report' }]
          },
          outputCollection: {
            outputFileCount: 0,
            auditSummary: null,
            failure: {
              code: 'PR_AUDITOR_OUTPUT_MISSING',
              message: 'PR Auditor did not produce the required audit report output.'
            }
          }
        };
      }
    });

    delete require.cache[require.resolve('../src/services/prAuditorWorkerService')];
    const failureService = require('../src/services/prAuditorWorkerService');
    workerStateService.createState(currentJobState.jobId);

    const failedSummary = await failureService.runPrAuditorWorkerJob(currentJobState.jobId);
    assert.strictEqual(failedSummary.status, 'failed');
    assert.strictEqual(currentJobState.status, 'failed');
    assert.strictEqual(currentJobState.error.code, 'PR_AUDITOR_OUTPUT_MISSING');
    assert(publishedEvents.some((entry) => entry.event === 'JOB_FAILED'));
    assert.strictEqual(workerStateService.getState(currentJobState.jobId).phase, 'FAILED');

    console.log('--- PR Auditor Worker Service Tests Passed! ---');
  } finally {
    workerStateService.createState = originalStateMethods.createState;
    workerStateService.getOrCreateState = originalStateMethods.getOrCreateState;
    workerStateService.setPhase = originalStateMethods.setPhase;
    workerStateService.setProgress = originalStateMethods.setProgress;
    workerStateService.setCancelled = originalStateMethods.setCancelled;
    workerStateService.setComplete = originalStateMethods.setComplete;
    workerStateService.setError = originalStateMethods.setError;
    workerStateService.isCancellationRequested = originalStateMethods.isCancellationRequested;
  }
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
