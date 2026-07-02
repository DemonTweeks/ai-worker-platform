const { Job } = require('../models');
const workerStateService = require('./workerStateService');
const { saveFinalSummary } = require('./finalSummaryService');
const prAuditorAdapter = require('../workers/adapters/prAuditorAdapter');
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

const buildPrAuditorSummary = ({ outputFileCount = 0, auditSummary = null } = {}) => ({
  requestedSiteCount: 0,
  matchedSiteCount: 0,
  unmatchedSiteCount: 0,
  outputFileCount,
  reviewRequiredCount: auditSummary ? auditSummary.reviewRequiredCount : 0,
  warningCount: auditSummary ? auditSummary.warnings.length : 0,
  auditSummary
});

const finalizeFailedOutputValidation = async (jobId, safeError, summary) => {
  await setJobStatus(jobId, 'failed', {
    completedAt: new Date(),
    error: safeError,
    outputFileCount: summary.outputFileCount,
    reviewRequiredCount: summary.reviewRequiredCount,
    warningCount: summary.warningCount,
    auditSummary: summary.auditSummary
  });

  const finalWorkerSummary = await saveFinalSummary({ jobId, summary });
  await setJobStatus(jobId, 'failed', { finalWorkerSummary });
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

const finalizeCancelledJob = async (jobId, summary, { message }) => {
  const finalStatus = summary.outputFileCount > 0 ? 'cancelled_with_partial_result' : 'cancelled';
  const cancelledAt = new Date();
  const existingJob = await Job.findOne({ jobId });

  await setJobStatus(jobId, finalStatus, {
    cancelledAt,
    completedAt: cancelledAt,
    cancellation: {
      ...(existingJob ? existingJob.cancellation : {}),
      completedAt: cancelledAt.toISOString(),
      finalStatus
    },
    statusEvents: appendStatusEvent(existingJob, 'cancellation_completed', {
      createdAt: cancelledAt.toISOString(),
      finalStatus
    }),
    outputFileCount: summary.outputFileCount,
    reviewRequiredCount: summary.reviewRequiredCount,
    warningCount: summary.warningCount,
    auditSummary: summary.auditSummary
  });
  const finalWorkerSummary = await saveFinalSummary({ jobId, summary, statusOverride: finalStatus });
  await setJobStatus(jobId, finalStatus, { finalWorkerSummary });
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
    message: error.message || 'PR Auditor execution failed.',
    details: error.details || {}
  };

  await setJobStatus(jobId, 'failed', {
    completedAt: new Date(),
    error: safeError,
    outputFileCount: null
  });
  workerStateService.setError(jobId, safeError);
  await publishJobEvent(jobId, JOB_EVENTS.JOB_FAILED, {
    phase: 'FAILED',
    status: 'failed',
    message: safeError.message,
    summary: {
      outputFileCount: null,
      reviewRequiredCount: 0,
      warningCount: 0,
      auditSummary: null
    }
  });
};

const runPrAuditorWorkerJob = async (jobId) => {
  workerStateService.getOrCreateState(jobId);

  try {
    await setPhaseAndStatus(jobId, 'VALIDATION_STARTED', 'Validating tracked PR Auditor job inputs.', {
      startedAt: new Date()
    });

    const result = await prAuditorAdapter.run(jobId, {
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

    const summary = buildPrAuditorSummary({
      outputFileCount: result.outputCollection.outputFileCount,
      auditSummary: result.outputCollection.auditSummary
    });

    if (result.pipelineResult && (result.pipelineResult.cancelled || workerStateService.isCancellationRequested(jobId))) {
      const finalStatus = await finalizeCancelledJob(jobId, summary, {
        message: 'PR Auditor job cancelled.'
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

    await setJobStatus(jobId, 'completed', {
      completedAt: new Date(),
      error: undefined,
      outputFileCount: summary.outputFileCount,
      reviewRequiredCount: summary.reviewRequiredCount,
      warningCount: summary.warningCount,
      auditSummary: summary.auditSummary
    });
    const finalWorkerSummary = await saveFinalSummary({ jobId, summary });
    await setJobStatus(jobId, 'completed', { finalWorkerSummary });
    workerStateService.setComplete(jobId, 'PR Auditor job completed.');
    await publishJobEvent(jobId, JOB_EVENTS.JOB_COMPLETED, {
      phase: 'COMPLETED',
      status: 'completed',
      message: 'PR Auditor job completed.',
      summary
    });

    return {
      status: 'completed',
      summary,
      result
    };
  } catch (error) {
    if (workerStateService.isCancellationRequested(jobId)) {
      const summary = buildPrAuditorSummary();
      const finalStatus = await finalizeCancelledJob(jobId, summary, {
        message: 'PR Auditor job cancelled.'
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
  buildPrAuditorSummary,
  runPrAuditorWorkerJob
};
