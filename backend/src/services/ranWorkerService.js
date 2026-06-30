const { Job } = require('../models');
const workerStateService = require('./workerStateService');
const { generateReportsAndPackage } = require('./outputCollector');
const { saveFinalSummary } = require('./finalSummaryService');
const { determineFinalStatus } = require('./zeroOutputPolicyService');
const ranPrAdapter = require('../workers/adapters/ranPrAdapter');
const { JOB_EVENTS, publishJobEvent } = require('../websocket/eventPublisher');
const { RUNNING_JOB_STATUSES, appendStatusEvent } = require('./jobControlService');

const statusByPhase = {
  VALIDATION_STARTED: 'validating',
  ASSET_LOADING_STARTED: 'loading_assets',
  GENERATION_STARTED: 'generating',
  OUTPUT_COLLECTION_STARTED: 'exporting'
};

const setJobStatus = async (jobId, status, extra = {}) => {
  const currentJob = await Job.findOne({ jobId });

  if (!currentJob) {
    return null;
  }

  let resolvedStatus = status;
  if (['cancelled', 'cancelled_with_partial_result'].includes(currentJob.status)) {
    resolvedStatus = currentJob.status;
  } else if (currentJob.status === 'cancelling' && RUNNING_JOB_STATUSES.includes(status)) {
    resolvedStatus = 'cancelling';
  }

  await Job.updateOne({ jobId }, { $set: { status: resolvedStatus, ...extra } });
  return resolvedStatus;
};

const setPhaseAndStatus = async (jobId, phase, message, extra = {}) => {
  workerStateService.setPhase(jobId, phase, message);
  const status = statusByPhase[phase];

  if (status) {
    await setJobStatus(jobId, status, extra);
  }

  await publishJobEvent(jobId, phase, {
    phase,
    status,
    message
  });
};

const buildRanSummary = ({ outputFileCount = 0, reviewRequiredCount = 0, warningCount = 0 } = {}) => ({
  requestedSiteCount: 0,
  matchedSiteCount: 0,
  unmatchedSiteCount: 0,
  outputFileCount,
  reviewRequiredCount,
  warningCount
});

const finalizeFailedOutputValidation = async (jobId, safeError, summary) => {
  await setJobStatus(jobId, 'failed', {
    completedAt: new Date(),
    error: safeError,
    ...summary
  });

  const finalWorkerSummary = await saveFinalSummary({ jobId, summary });
  await setJobStatus(jobId, 'failed', { finalWorkerSummary });
  await generateReportsAndPackage(jobId, { includeZip: false });
  workerStateService.setError(jobId, safeError);
  await publishJobEvent(jobId, JOB_EVENTS.JOB_FAILED, {
    phase: 'FAILED',
    status: 'failed',
    message: safeError.message,
    summary
  });

  return {
    status: 'failed',
    summary,
    error: safeError,
    finalWorkerSummary
  };
};

const finalizeCancelledJob = async (jobId, summary, { includeZip, message }) => {
  const finalStatus = summary.outputFileCount > 0 ? 'cancelled_with_partial_result' : 'cancelled';
  const cancelledAt = new Date();

  await setJobStatus(jobId, finalStatus, {
    cancelledAt,
    completedAt: cancelledAt,
    cancellation: {
      ...(await Job.findOne({ jobId })).cancellation,
      completedAt: cancelledAt.toISOString(),
      finalStatus
    },
    statusEvents: appendStatusEvent(await Job.findOne({ jobId }), 'cancellation_completed', {
      createdAt: cancelledAt.toISOString(),
      finalStatus
    }),
    ...summary
  });
  const finalWorkerSummary = await saveFinalSummary({ jobId, summary, statusOverride: finalStatus });
  await setJobStatus(jobId, finalStatus, { finalWorkerSummary });
  await generateReportsAndPackage(jobId, { includeZip });
  workerStateService.setCancelled(jobId, message);
  await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
    phase: 'CANCELLED',
    status: finalStatus,
    message,
    summary
  });

  return finalStatus;
};

const failJob = async (jobId, error) => {
  const safeError = {
    code: error.code || 'WORKER_ERROR',
    message: error.message || 'RAN PR Worker execution failed.',
    details: error.details || {}
  };

  await setJobStatus(jobId, 'failed', {
    completedAt: new Date(),
    error: safeError,
    matchedSiteCount: null,
    unmatchedSiteCount: null,
    outputFileCount: null
  });
  workerStateService.setError(jobId, safeError);
  await publishJobEvent(jobId, JOB_EVENTS.JOB_FAILED, {
    phase: 'FAILED',
    status: 'failed',
    message: safeError.message,
    summary: {
      matchedSiteCount: null,
      unmatchedSiteCount: null,
      outputFileCount: null,
      reviewRequiredCount: 0,
      warningCount: 0
    }
  });
};

const runRanWorkerJob = async (jobId) => {
  workerStateService.getOrCreateState(jobId);

  try {
    await setPhaseAndStatus(jobId, 'VALIDATION_STARTED', 'Validating tracked RAN job inputs.', {
      startedAt: new Date()
    });

    const result = await ranPrAdapter.run(jobId, {
      isCancellationRequested: () => workerStateService.isCancellationRequested(jobId),
      onWorkspacePreparing: async (message) => {
        await setPhaseAndStatus(jobId, 'ASSET_LOADING_STARTED', message);
      },
      onWorkspacePrepared: async (message) => {
        workerStateService.setPhase(jobId, 'ASSET_LOADING_COMPLETED', message);
        await publishJobEvent(jobId, JOB_EVENTS.ASSET_LOADING_COMPLETED, {
          phase: 'ASSET_LOADING_COMPLETED',
          status: 'loading_assets',
          message
        });
      },
      onStageStarted: async ({ stageLabel, index, total }) => {
        workerStateService.setPhase(jobId, 'GENERATION_STARTED', `Running ${stageLabel}.`);
        workerStateService.setProgress(jobId, {
          processedRows: index + 1,
          totalRows: total,
          message: `Running ${stageLabel}.`
        });
        await setJobStatus(jobId, 'generating');
        await publishJobEvent(jobId, JOB_EVENTS.GENERATION_STARTED, {
          phase: 'GENERATION_STARTED',
          status: 'generating',
          message: `Running ${stageLabel}.`,
          progress: {
            processedRows: index + 1,
            totalRows: total
          }
        });
      },
      onOutputsCollecting: async (message) => {
        await setPhaseAndStatus(jobId, 'OUTPUT_COLLECTION_STARTED', message);
      },
      onOutputsCollected: async (message) => {
        workerStateService.setPhase(jobId, 'OUTPUT_COLLECTION_COMPLETED', message);
        await publishJobEvent(jobId, JOB_EVENTS.OUTPUT_COLLECTION_COMPLETED, {
          phase: 'OUTPUT_COLLECTION_COMPLETED',
          status: 'exporting',
          message
        });
      }
    });

    const summary = buildRanSummary({
      outputFileCount: result.outputCollection.outputFileCount
    });

    if (result.pipelineResult.cancelled || workerStateService.isCancellationRequested(jobId)) {
      const finalStatus = await finalizeCancelledJob(jobId, summary, {
        includeZip: summary.outputFileCount > 0,
        message: 'RAN PR worker job cancelled.'
      });
      return {
        status: finalStatus,
        summary,
        result
      };
    }

    if (result.outputCollection.failure) {
      return finalizeFailedOutputValidation(jobId, result.outputCollection.failure, summary);
    }

    const finalStatus = determineFinalStatus(summary);
    await setJobStatus(jobId, finalStatus, {
      completedAt: new Date(),
      error: undefined,
      ...summary
    });
    const finalWorkerSummary = await saveFinalSummary({ jobId, summary });
    await setJobStatus(jobId, finalStatus, { finalWorkerSummary });
    await generateReportsAndPackage(jobId, { includeZip: true });
    workerStateService.setComplete(jobId, 'RAN PR worker job completed.');
    await publishJobEvent(jobId, JOB_EVENTS.JOB_COMPLETED, {
      phase: 'COMPLETED',
      status: finalStatus,
      message: 'RAN PR worker job completed.',
      summary
    });

    return {
      status: finalStatus,
      summary,
      result
    };
  } catch (error) {
    if (workerStateService.isCancellationRequested(jobId)) {
      const summary = buildRanSummary();
      const finalStatus = await finalizeCancelledJob(jobId, summary, {
        includeZip: false,
        message: 'RAN PR worker job cancelled.'
      });
      return {
        status: finalStatus,
        summary
      };
    }
    await failJob(jobId, error);
    return {
      status: 'failed',
      error
    };
  }
};

module.exports = {
  buildRanSummary,
  runRanWorkerJob
};
