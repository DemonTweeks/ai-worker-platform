const path = require('path');
const { Job, JobFile } = require('../models');
const storageService = require('./storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');
const workerStateService = require('./workerStateService');
const { parseIepmsWorkbook } = require('./iepmsParser');
const { filterSites } = require('./siteFilteringService');
const { loadActiveAssets } = require('./activeAssetService');
const { runCreatePrCd } = require('./childProcessRunner');
const { collectOutputs } = require('./outputCollector');
const { buildAndSaveSummary } = require('./summaryBuilder');
const { saveFinalSummary } = require('./finalSummaryService');
const { JOB_EVENTS, publishJobEvent } = require('../websocket/eventPublisher');

const statusByPhase = {
  VALIDATION_STARTED: 'validating',
  FILTERING_STARTED: 'filtering_sites',
  ASSET_LOADING_STARTED: 'loading_assets',
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

  await setJobStatus(jobId, 'failed', {
    completedAt: new Date(),
    error: safeError
  });
  workerStateService.setError(jobId, safeError);
  await publishJobEvent(jobId, JOB_EVENTS.JOB_FAILED, {
    phase: 'FAILED',
    status: 'failed',
    message: safeError.message,
    summary: {
      outputFileCount: 0,
      warningCount: 0,
      reviewRequiredCount: 0
    }
  });
  await saveFinalSummary({ jobId, summary: {
    requestedSiteCount: 0,
    matchedSiteCount: 0,
    unmatchedSiteCount: 0,
    outputFileCount: 0,
    reviewRequiredCount: 0,
    warningCount: 0
  } }).catch(() => {});
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

    await setPhaseAndStatus(jobId, 'ASSET_LOADING_STARTED', 'Loading active PR Worker assets.');
    const assets = await loadActiveAssets();
    await Job.updateOne({ jobId }, { $set: { assetVersions: assets.assetVersions } });
    workerStateService.setPhase(jobId, 'ASSET_LOADING_COMPLETED', 'Active assets loaded.');
    await publishJobEvent(jobId, JOB_EVENTS.ASSET_LOADING_COMPLETED, {
      phase: 'ASSET_LOADING_COMPLETED',
      status: 'loading_assets',
      message: 'Active assets loaded.'
    });

    await setPhaseAndStatus(jobId, 'GENERATION_STARTED', 'Running create-pr-cd child process.');
    const runnerResult = await runCreatePrCd({
      jobId,
      filteredInputPath: filteringResult.filteredMetadata.absolutePath,
      assets,
      generationScope: request.generationScope,
      siteCodes: request.siteCodes,
      isCancellationRequested: () => workerStateService.isCancellationRequested(jobId)
    });

    if (runnerResult.cancelled) {
      const partialCollection = await collectOutputs(jobId);
      const partialSummary = await buildAndSaveSummary({ jobId, filteringResult, outputCollection: partialCollection });
      await setJobStatus(jobId, partialCollection.outputFileCount > 0 ? 'cancelled_with_partial_result' : 'cancelled', {
        cancelledAt: new Date()
      });
      workerStateService.setCancelled(jobId);
      await saveFinalSummary({ jobId, summary: partialSummary });
      await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, {
        phase: 'CANCELLED',
        status: partialCollection.outputFileCount > 0 ? 'cancelled_with_partial_result' : 'cancelled',
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
    workerStateService.setPhase(jobId, 'OUTPUT_COLLECTION_COMPLETED', 'Output collection completed.');
    await publishJobEvent(jobId, JOB_EVENTS.OUTPUT_COLLECTION_COMPLETED, {
      phase: 'OUTPUT_COLLECTION_COMPLETED',
      status: 'exporting',
      message: 'Output collection completed.'
    });

    const summary = await buildAndSaveSummary({ jobId, filteringResult, outputCollection });
    const finalWorkerSummary = await saveFinalSummary({ jobId, summary });

    await setJobStatus(jobId, summary.warningCount > 0 ? 'completed_with_warning' : 'completed', {
      completedAt: new Date(),
      finalWorkerSummary,
      error: undefined
    });
    workerStateService.setComplete(jobId);
    await publishJobEvent(jobId, JOB_EVENTS.JOB_COMPLETED, {
      phase: 'COMPLETED',
      status: summary.warningCount > 0 ? 'completed_with_warning' : 'completed',
      message: 'Job completed.',
      summary
    });
  } catch (error) {
    await failJob(jobId, error);
  }
};

module.exports = {
  runPrWorkerJob
};
