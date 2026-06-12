const path = require('path');
const { Job, JobFile } = require('../models');
const storageService = require('./storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');
const workerStateService = require('./workerStateService');
const { parseIepmsWorkbook } = require('./iepmsParser');
const { filterSites } = require('./siteFilteringService');
const { runCreatePrCd } = require('./childProcessRunner');
const { collectOutputs, generateReportsAndPackage } = require('./outputCollector');
const { ingestTiResultFiles } = require('./tiResultIngestionService');
const { determineFinalStatus, getNoEccExplanation } = require('./zeroOutputPolicyService');
const { buildAndSaveSummary } = require('./summaryBuilder');
const { saveFinalSummary } = require('./finalSummaryService');
const { JOB_EVENTS, publishJobEvent } = require('../websocket/eventPublisher');

const statusByPhase = {
  VALIDATION_STARTED: 'validating',
  FILTERING_STARTED: 'filtering_sites',
  GENERATION_STARTED: 'generating',
  OUTPUT_COLLECTION_STARTED: 'exporting'
};

const setJobStatus = async (jobId, status, extra = {}) => {
  await Job.updateOne({ jobId }, { $set: { status, ...extra } });
};

const failJob = async (jobId, error) => {
  const safeError = {
    code: error.code || 'WORKER_ERROR',
    message: error.message || 'PR Worker execution failed.',
    details: error.details || {}
  };

  // Classify worker failures distinctly so metrics are not mistaken for valid zero results
  if (safeError.code === 'WORKER_PROCESS_FAILED' || safeError.code === 'WORKER_TIMEOUT') {
    safeError.failureType = 'worker_execution_failed';
    if (safeError.details && typeof safeError.details.exitCode !== 'undefined') {
      safeError.exitCode = safeError.details.exitCode;
    }
  } else if (safeError.code === 'ZERO_OUTPUT_WITHOUT_EXPLANATION') {
    safeError.failureType = 'summary_missing';
  } else if (safeError.code === 'SUMMARY_PARSE_FAILED') {
    safeError.failureType = 'summary_parse_failed';
  } else if (safeError.code === 'OUTPUT_GENERATION_FAILED') {
    safeError.failureType = 'output_generation_failed';
  } else {
    // Default fallback to worker_execution_failed for generic worker errors
    safeError.failureType = 'worker_execution_failed';
  }

  const failedJob = await Job.findOne({ jobId }).lean().catch(() => null);

  const isFailure = [
    'worker_execution_failed',
    'summary_missing',
    'summary_parse_failed',
    'output_generation_failed'
  ].includes(safeError.failureType);

  // For execution failures, do not default unknown metrics to zero — use null to indicate unknown
  const summaryForFinal = {
    requestedSiteCount: failedJob ? (typeof failedJob.requestedSiteCount === 'number' ? failedJob.requestedSiteCount : null) : null,
    matchedSiteCount: isFailure ? null : (failedJob ? failedJob.matchedSiteCount || 0 : 0),
    unmatchedSiteCount: isFailure ? null : (failedJob ? failedJob.unmatchedSiteCount || 0 : 0),
    outputFileCount: isFailure ? null : (failedJob ? failedJob.outputFileCount || 0 : 0),
    reviewRequiredCount: failedJob ? failedJob.reviewRequiredCount || 0 : 0,
    warningCount: failedJob ? failedJob.warningCount || 0 : 0
  };

  await setJobStatus(jobId, 'failed', {
    completedAt: new Date(),
    ...(safeError.code === 'WORKER_TIMEOUT' ? {
      timedOutAt: new Date(),
      timeoutReason: safeError.message
    } : {}),
    error: safeError,
    matchedSiteCount: summaryForFinal.matchedSiteCount,
    unmatchedSiteCount: summaryForFinal.unmatchedSiteCount,
    outputFileCount: summaryForFinal.outputFileCount,
    reviewRequiredCount: summaryForFinal.reviewRequiredCount,
    warningCount: summaryForFinal.warningCount
  });
  workerStateService.setError(jobId, safeError);
  await publishJobEvent(jobId, JOB_EVENTS.JOB_FAILED, {
    phase: 'FAILED',
    status: 'failed',
    message: safeError.message,
    summary: {
      outputFileCount: summaryForFinal.outputFileCount,
      warningCount: summaryForFinal.warningCount,
      reviewRequiredCount: summaryForFinal.reviewRequiredCount,
      matchedSiteCount: summaryForFinal.matchedSiteCount,
      unmatchedSiteCount: summaryForFinal.unmatchedSiteCount
    }
  });

  await saveFinalSummary({ jobId, summary: summaryForFinal }).catch(() => {});
  await generateReportsAndPackage(jobId).catch(() => {});
};

const readJobRequest = async (jobId) => {
  const requestPath = storageService.resolveJobTempPath(jobId, 'job-request.json');
  const raw = await require('fs').promises.readFile(requestPath, 'utf8');
  return JSON.parse(raw);
};

const getUploadedInput = async (jobId) => {
  const inputFile = await JobFile.findOne({ jobId, fileType: 'uploaded_export' }).sort({ createdAt: 1 }).lean();

  if (!inputFile) {
    throw Object.assign(new Error('Uploaded input file is not tracked for this job.'), { code: 'INPUT_FILE_MISSING' });
  }

  return {
    ...inputFile,
    absolutePath: assertPathInsideRoot(
      storageService.getStorageRoot(),
      path.join(storageService.getStorageRoot(), inputFile.filePath)
    )
  };
};

const setPhaseAndStatus = async (jobId, phase, message) => {
  workerStateService.setPhase(jobId, phase, message);
  const status = statusByPhase[phase];
  if (status) {
    await setJobStatus(jobId, status);
  }
  await publishJobEvent(jobId, phase, {
    phase,
    status,
    message
  });
};

const runPrWorkerJob = async (jobId) => {
  workerStateService.getOrCreateState(jobId);

  try {
    await setJobStatus(jobId, 'validating', { startedAt: new Date() });
    await setPhaseAndStatus(jobId, 'VALIDATION_STARTED', 'Validating uploaded iEPMS export.');

    const [job, request, inputFile] = await Promise.all([
      Job.findOne({ jobId }),
      readJobRequest(jobId),
      getUploadedInput(jobId)
    ]);

    if (!job) {
      throw Object.assign(new Error('Job record was not found.'), { code: 'JOB_NOT_FOUND' });
    }

    const parsedWorkbook = parseIepmsWorkbook(inputFile.absolutePath);
    workerStateService.setProgress(jobId, {
      totalRows: parsedWorkbook.rowCount,
      processedRows: 0,
      message: `Validated ${parsedWorkbook.rowCount} input rows.`
    });
    workerStateService.setPhase(jobId, 'VALIDATION_COMPLETED', 'Input validation completed.');
    await publishJobEvent(jobId, JOB_EVENTS.VALIDATION_COMPLETED, {
      phase: 'VALIDATION_COMPLETED',
      status: 'validating',
      message: 'Input validation completed.'
    });

    await setPhaseAndStatus(jobId, 'FILTERING_STARTED', 'Filtering requested site rows.');
    const filteringResult = await filterSites({
      jobId,
      parsedWorkbook,
      generationScope: request.generationScope,
      siteCodes: request.siteCodes
    });
    await JobFile.create({
      jobId,
      fileType: 'filtered_input',
      fileName: filteringResult.filteredMetadata.fileName,
      filePath: filteringResult.filteredMetadata.filePath,
      fileSize: filteringResult.filteredMetadata.fileSize,
      retentionUntil: filteringResult.filteredMetadata.retentionUntil
    });
    workerStateService.setProgress(jobId, {
      processedRows: filteringResult.filteredRows.length,
      totalRows: parsedWorkbook.rowCount,
      message: `Filtered ${filteringResult.filteredRows.length} matched rows.`
    });
    workerStateService.setPhase(jobId, 'FILTERING_COMPLETED', 'Site filtering completed.');
    await publishJobEvent(jobId, JOB_EVENTS.FILTERING_COMPLETED, {
      phase: 'FILTERING_COMPLETED',
      status: 'filtering_sites',
      message: 'Site filtering completed.'
    });

    if (workerStateService.isCancellationRequested(jobId)) {
      await setJobStatus(jobId, 'cancelled', { cancelledAt: new Date() });
      workerStateService.setCancelled(jobId);
      await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
        phase: 'CANCELLED',
        status: 'cancelled',
        message: 'Job cancelled.'
      });
      return;
    }

    await setPhaseAndStatus(jobId, 'GENERATION_STARTED', 'Running create-pr-cd child process.');
    const runnerResult = await runCreatePrCd({
      jobId,
      filteredInputPath: filteringResult.filteredMetadata.absolutePath,
      generationScope: request.generationScope,
      siteCodes: request.siteCodes,
      prScope: request.prScope || job.prScope || 'TSS',
      isCancellationRequested: () => workerStateService.isCancellationRequested(jobId)
    });

    if (runnerResult.cancelled) {
      const partialCollection = await collectOutputs(jobId);
      await ingestTiResultFiles(jobId);
      const partialSummary = await buildAndSaveSummary({ jobId, filteringResult, outputCollection: partialCollection });
      const partialStatus = partialCollection.outputFileCount > 0 ? 'cancelled_with_partial_result' : 'cancelled';
      await setJobStatus(jobId, partialStatus, {
        cancelledAt: new Date()
      });
      workerStateService.setCancelled(jobId);
      await saveFinalSummary({ jobId, summary: partialSummary });
      await generateReportsAndPackage(jobId);
      await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
        phase: 'CANCELLED',
        status: partialStatus,
        message: 'Job cancelled.',
        summary: partialSummary
      });
      return;
    }

    workerStateService.setPhase(jobId, 'GENERATION_COMPLETED', 'create-pr-cd generation completed.');
    await publishJobEvent(jobId, JOB_EVENTS.GENERATION_COMPLETED, {
      phase: 'GENERATION_COMPLETED',
      status: 'generating',
      message: 'create-pr-cd generation completed.'
    });

    await setPhaseAndStatus(jobId, 'OUTPUT_COLLECTION_STARTED', 'Collecting generated output files.');
    await publishJobEvent(jobId, JOB_EVENTS.EXPORT_STARTED, {
      phase: 'OUTPUT_COLLECTION_STARTED',
      status: 'exporting',
      message: 'Export collection started.'
    });
    const outputCollection = await collectOutputs(jobId);
    let tiIngestion;
    try {
      tiIngestion = await ingestTiResultFiles(jobId);
    } catch (err) {
      const wrapErr = new Error(`Failed to parse TI result CSV files: ${err.message}`);
      wrapErr.code = 'SUMMARY_PARSE_FAILED';
      wrapErr.details = { originalError: err.message };
      throw wrapErr;
    }

    if (tiIngestion.parsedReviewRequiredCount > 0 || tiIngestion.parsedWarningCount > 0) {
      await publishJobEvent(jobId, 'TI_RESULT_EVIDENCE_INGESTED', {
        phase: 'OUTPUT_COLLECTION_STARTED',
        status: 'exporting',
        message: `Parsed TI source result files: ${tiIngestion.parsedReviewRequiredCount} review-required row(s), ${tiIngestion.parsedWarningCount} duplicate warning row(s).`
      });
    }
    workerStateService.setPhase(jobId, 'OUTPUT_COLLECTION_COMPLETED', 'Output collection completed.');
    await publishJobEvent(jobId, JOB_EVENTS.OUTPUT_COLLECTION_COMPLETED, {
      phase: 'OUTPUT_COLLECTION_COMPLETED',
      status: 'exporting',
      message: 'Output collection completed.'
    });

    const summary = await buildAndSaveSummary({ jobId, filteringResult, outputCollection });
    const noEccExplanation = getNoEccExplanation(summary);
    const finalStatus = determineFinalStatus(summary);

    let finalWorkerSummary;
    try {
      finalWorkerSummary = await saveFinalSummary({ jobId, summary, statusOverride: finalStatus });
      await generateReportsAndPackage(jobId);
    } catch (err) {
      const wrapErr = new Error(`Failed to generate reports or package outputs: ${err.message}`);
      wrapErr.code = 'OUTPUT_GENERATION_FAILED';
      wrapErr.details = { originalError: err.message };
      throw wrapErr;
    }

    await setJobStatus(jobId, finalStatus, {
      completedAt: new Date(),
      finalWorkerSummary,
      error: undefined
    });
    workerStateService.setComplete(jobId);
    await publishJobEvent(jobId, JOB_EVENTS.JOB_COMPLETED, {
      phase: 'COMPLETED',
      status: finalStatus,
      message: noEccExplanation || 'Job completed.',
      summary
    });
  } catch (error) {
    await failJob(jobId, error);
  }
};

module.exports = {
  runPrWorkerJob
};
