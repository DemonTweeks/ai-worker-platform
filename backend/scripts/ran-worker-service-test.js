const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running RAN Worker Service Tests ---');

  const metadataUpdates = [];
  const publishedEvents = [];
  const reportCalls = [];
  const savedSummaries = [];
  const currentJobState = {
    jobId: 'RAN-JOB-001',
    workerId: 'ran-pr',
    workerType: 'pr-worker',
    status: 'queued',
    runMode: 'standard-pr',
    selectedProject: null,
    requestedSiteCount: 0,
    matchedSiteCount: 0,
    unmatchedSiteCount: 0,
    outputFileCount: 0,
    reviewRequiredCount: 0,
    warningCount: 0,
    finalWorkerSummary: ''
  };

  setCachedModule(path.join(repoRoot, 'src/models/index.js'), {
    Job: {
      findOne: async ({ jobId }) => (jobId === currentJobState.jobId ? { ...currentJobState } : null),
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
        GENERATION_COMPLETED: 'GENERATION_COMPLETED',
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

    setCachedModule(path.join(repoRoot, 'src/services/outputCollector.js'), {
      generateReportsAndPackage: async (jobId) => {
        reportCalls.push(jobId);
        return { zipFile: { jobId } };
      }
    });

    setCachedModule(path.join(repoRoot, 'src/services/finalSummaryService.js'), {
      saveFinalSummary: async ({ jobId, summary, statusOverride }) => {
        savedSummaries.push({ jobId, summary, statusOverride });
        return `RAN worker completed with ${summary.outputFileCount} output file(s).`;
      }
    });

    setCachedModule(path.join(repoRoot, 'src/services/summaryBuilder.js'), {
      buildAndSaveSummary: async ({ jobId, filteringResult, outputCollection }) => ({
        jobId,
        requestedSiteCount: filteringResult.requestedSiteCount,
        matchedSiteCount: filteringResult.matchedSiteCount,
        unmatchedSiteCount: filteringResult.unmatchedSiteCount,
        outputFileCount: outputCollection.outputFileCount,
        reviewRequiredCount: 0,
        warningCount: 0
      })
    });

    setCachedModule(path.join(repoRoot, 'src/services/zeroOutputPolicyService.js'), {
      determineFinalStatus: (summary) => (summary.outputFileCount > 0 ? 'completed' : 'completed_with_warning'),
      getNoEccExplanation: () => ''
    });

    setCachedModule(path.join(repoRoot, 'src/workers/adapters/ranPrAdapter.js'), {
      run: async (jobId, options = {}) => {
        if (options.onWorkspacePreparing) {
          await options.onWorkspacePreparing('Preparing isolated RAN workspace.');
        }
        if (options.onWorkspacePrepared) {
          await options.onWorkspacePrepared('RAN workspace ready.');
        }
        if (options.onStageStarted) {
          await options.onStageStarted({ stage: 'src/simple_normalize.py', index: 0, total: 4 });
          await options.onStageStarted({ stage: 'src/simple_calculation.py', index: 1, total: 4 });
          await options.onStageStarted({ stage: 'src/simple_pr_generator.py', index: 2, total: 4 });
          await options.onStageStarted({ stage: 'src/simple_ecc_export.py', index: 3, total: 4 });
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
            stageResults: [
              { stage: 'src/simple_normalize.py' },
              { stage: 'src/simple_calculation.py' },
              { stage: 'src/simple_pr_generator.py' },
              { stage: 'src/simple_ecc_export.py' }
            ]
          },
          outputCollection: {
            outputFileCount: 2
          }
        };
      }
    });

    const ranWorkerService = require('../src/services/ranWorkerService');

    workerStateService.createState(currentJobState.jobId);
    const successSummary = await ranWorkerService.runRanWorkerJob(currentJobState.jobId);

    assert.strictEqual(successSummary.status, 'completed');
    assert.strictEqual(currentJobState.status, 'completed');
    assert.strictEqual(currentJobState.outputFileCount, 2);
    assert.strictEqual(currentJobState.finalWorkerSummary, 'RAN worker completed with 2 output file(s).');
    assert.strictEqual(reportCalls.length, 1, 'successful runs should generate reports and packages');
    assert.strictEqual(savedSummaries.length, 1, 'successful runs should persist a final summary');
    assert(metadataUpdates.some((update) => update.status === 'loading_assets'), 'job should enter loading_assets status');
    assert(metadataUpdates.some((update) => update.status === 'generating'), 'job should enter generating status');
    assert(metadataUpdates.some((update) => update.status === 'exporting'), 'job should enter exporting status');
    assert(metadataUpdates.some((update) => update.status === 'completed'), 'job should enter completed status');
    assert.deepStrictEqual(
      publishedEvents.map((entry) => entry.event),
      [
        'VALIDATION_STARTED',
        'ASSET_LOADING_STARTED',
        'ASSET_LOADING_COMPLETED',
        'GENERATION_STARTED',
        'GENERATION_STARTED',
        'GENERATION_STARTED',
        'GENERATION_STARTED',
        'OUTPUT_COLLECTION_STARTED',
        'OUTPUT_COLLECTION_COMPLETED',
        'JOB_COMPLETED'
      ]
    );

    const completedState = workerStateService.getState(currentJobState.jobId);
    assert.strictEqual(completedState.phase, 'COMPLETED');
    assert.strictEqual(completedState.processedRows, 4, 'stage progress should reach the full stage count');
    assert.strictEqual(completedState.totalRows, 4, 'stage progress should track the number of RAN stages');

    metadataUpdates.length = 0;
    publishedEvents.length = 0;
    reportCalls.length = 0;
    savedSummaries.length = 0;
    currentJobState.status = 'queued';
    currentJobState.outputFileCount = 0;
    currentJobState.finalWorkerSummary = '';

    setCachedModule(path.join(repoRoot, 'src/workers/adapters/ranPrAdapter.js'), {
      run: async (_jobId, options = {}) => {
        if (options.onWorkspacePreparing) {
          await options.onWorkspacePreparing('Preparing isolated RAN workspace.');
        }
        if (options.onStageStarted) {
          await options.onStageStarted({ stage: 'src/simple_normalize.py', index: 0, total: 4 });
        }
        return {
          workerId: 'ran-pr',
          runMode: 'standard-pr',
          selectedProject: null,
          pipelineResult: {
            cancelled: true,
            stageResults: [{ stage: 'src/simple_normalize.py', cancelled: true }]
          },
          outputCollection: {
            outputFileCount: 1
          }
        };
      }
    });

    delete require.cache[require.resolve('../src/services/ranWorkerService')];
    const cancellationService = require('../src/services/ranWorkerService');
    workerStateService.createState(currentJobState.jobId);

    const cancelledSummary = await cancellationService.runRanWorkerJob(currentJobState.jobId);
    assert.strictEqual(cancelledSummary.status, 'cancelled_with_partial_result');
    assert.strictEqual(currentJobState.status, 'cancelled_with_partial_result');
    assert.strictEqual(reportCalls.length, 1, 'cancelled runs with partial results should still package outputs');
    assert.strictEqual(savedSummaries.length, 1, 'cancelled runs should still persist a final summary');
    assert(publishedEvents.some((entry) => entry.event === 'JOB_CANCELLED'), 'cancelled runs should publish JOB_CANCELLED');
    assert.strictEqual(workerStateService.getState(currentJobState.jobId).phase, 'CANCELLED');

    console.log('--- RAN Worker Service Tests Passed! ---');
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
