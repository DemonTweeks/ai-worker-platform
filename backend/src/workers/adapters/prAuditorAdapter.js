const fs = require('fs');
const path = require('path');
const { Job, JobFile } = require('../../models');
const { getExplicitPythonExecutable, runPythonStage } = require('../../services/childProcessRunner');
const config = require('../../config/env');
const storageService = require('../../services/storageService');
const prAuditorManifest = require('../manifests/prAuditorManifest');
const { ingestPrAuditorOutputs } = require('../prAuditorOutputIngestionService');
const { preparePrAuditorWorkspace } = require('../prAuditorWorkspaceService');
const { WORKER_IDS } = require('../workerTypes');
const { assertPathInsideRoot } = require('../../utils/pathUtils');

const PR_AUDITOR_INPUT_FILE_TYPES = {
  FINAL_PO: 'pr_auditor_final_po_upload',
  EXPECTED_ECC: 'pr_auditor_expected_ecc_upload'
};

const PR_AUDITOR_PROGRESS_STAGES = [
  'Validating files',
  'Loading generated ECC entitlement',
  'Auditing PO records',
  'Resolving duplicates',
  'Generating audit report'
];

const DEFAULT_FINAL_PO_SHEET = process.env.PR_AUDITOR_FINAL_PO_SHEET || 'Sheet1';
const DEFAULT_FINAL_PO_HEADER_ROW = process.env.PR_AUDITOR_FINAL_PO_HEADER_ROW || '2';

const getDefaultStageTimeoutMs = () => config.limits.jobTimeoutMinutes * 60 * 1000;

const normalizeStageTimeoutMs = (timeoutMs) => (
  Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : getDefaultStageTimeoutMs()
);

const assertJobExists = async (jobId) => {
  const job = await Job.findOne({ jobId });

  if (!job) {
    const error = new Error('Job record was not found.');
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }

  return job;
};

const getTrackedInputFile = async (jobId, fileType) => {
  const file = await JobFile.findOne({ jobId, fileType }).sort({ createdAt: 1 }).lean();

  if (!file) {
    const error = new Error(`Required PR Auditor input file is missing: ${fileType}.`);
    error.code = 'PR_AUDITOR_INPUT_FILE_MISSING';
    error.details = { fileType };
    throw error;
  }

  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), file.filePath)
  );

  if (!fs.existsSync(absolutePath)) {
    const error = new Error(`Tracked PR Auditor input file is unavailable: ${fileType}.`);
    error.code = 'PR_AUDITOR_INPUT_FILE_UNAVAILABLE';
    error.details = { fileType };
    throw error;
  }

  return {
    ...file,
    absolutePath
  };
};

const buildAuditCommandSpec = ({ workspaceRoot, runtimePaths, pythonExecutable }) => ({
  pythonExecutable,
  cwd: workspaceRoot,
  scriptPath: runtimePaths.scriptPath,
  scriptArgs: [
    '--final-po', runtimePaths.finalPoPath,
    '--final-po-sheet', DEFAULT_FINAL_PO_SHEET,
    '--final-po-header-row', DEFAULT_FINAL_PO_HEADER_ROW,
    '--expected-ecc', runtimePaths.expectedEccPath,
    '--output', runtimePaths.outputPath,
    '--summary-json', runtimePaths.summaryJsonPath
  ]
});

const buildPrAuditorExecutionError = ({ type, exitCode, stderr }) => {
  const isTimeout = type === 'timeout';
  const error = new Error(
    isTimeout
      ? 'PR Auditor timed out while running tx-pr-auditor.'
      : 'PR Auditor failed while running tx-pr-auditor.'
  );

  error.code = isTimeout ? 'WORKER_TIMEOUT' : 'WORKER_PROCESS_FAILED';
  error.details = {
    ...(typeof exitCode !== 'undefined' ? { exitCode } : {}),
    ...(typeof stderr === 'string' ? { stderr: stderr.slice(-2000) } : {})
  };

  return error;
};

const persistJobMetadata = async (jobId) => {
  await Job.updateOne(
    { jobId },
    {
      $set: {
        workerId: WORKER_IDS.PR_AUDITOR,
        workerType: 'pr-worker',
        engineVersion: prAuditorManifest.engineVersion,
        engineCommit: prAuditorManifest.engineCommit,
        runMode: null,
        selectedProject: null
      }
    }
  );
};

const assertEnginePinApproved = () => {
  if (prAuditorManifest.engineCommit === 'unapproved' || prAuditorManifest.compatibilityStatus !== 'verified') {
    const error = new Error('PR Auditor runtime is blocked until a safe engine pin is approved and recorded.');
    error.code = 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED';
    throw error;
  }
};

const runAuditCommand = async ({
  commandSpec,
  timeoutMs,
  isCancellationRequested,
  onStageStarted
}) => {
  if (onStageStarted) {
    await onStageStarted({
      stage: 'tx-pr-auditor',
      stageLabel: 'Generating audit report',
      index: PR_AUDITOR_PROGRESS_STAGES.length - 1,
      total: PR_AUDITOR_PROGRESS_STAGES.length
    });
  }

  const result = await runPythonStage({
    pythonExecutable: commandSpec.pythonExecutable,
    scriptPath: commandSpec.scriptPath,
    scriptArgs: commandSpec.scriptArgs,
    cwd: commandSpec.cwd,
    timeoutMs: normalizeStageTimeoutMs(timeoutMs),
    isCancellationRequested
  });

  const stageResult = {
    stage: 'tx-pr-auditor',
    command: commandSpec.pythonExecutable,
    args: [commandSpec.scriptPath].concat(commandSpec.scriptArgs),
    cwd: commandSpec.cwd,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    cancelled: result.cancelled,
    stdout: result.stdout,
    stderr: result.stderr
  };

  if (result.cancelled) {
    return {
      cancelled: true,
      stageResults: [stageResult]
    };
  }

  if (result.timedOut) {
    throw buildPrAuditorExecutionError({
      type: 'timeout',
      exitCode: result.exitCode,
      stderr: result.stderr
    });
  }

  if (result.exitCode !== 0) {
    throw buildPrAuditorExecutionError({
      type: 'process_failed',
      exitCode: result.exitCode,
      stderr: result.stderr
    });
  }

  return {
    cancelled: false,
    stageResults: [stageResult]
  };
};

const run = async (jobId, options = {}) => {
  await assertJobExists(jobId);

  if (options.onWorkspacePreparing) {
    await options.onWorkspacePreparing('Preparing PR Auditor job workspace.');
  }

  const [finalPoFile, expectedEccFile] = await Promise.all([
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.FINAL_PO),
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.EXPECTED_ECC)
  ]);

  const workspace = await preparePrAuditorWorkspace({
    jobId,
    finalPoSourcePath: finalPoFile.absolutePath,
    expectedEccSourcePath: expectedEccFile.absolutePath
  });

  if (options.onWorkspacePrepared) {
    await options.onWorkspacePrepared('PR Auditor job workspace ready.');
  }

  await persistJobMetadata(jobId);

  const pythonExecutable = getExplicitPythonExecutable();
  const commandSpec = buildAuditCommandSpec({
    workspaceRoot: workspace.workspaceRoot,
    runtimePaths: workspace.runtimePaths,
    pythonExecutable
  });

  assertEnginePinApproved();

  const pipelineResult = await runAuditCommand({
    commandSpec,
    timeoutMs: options.timeoutMs,
    isCancellationRequested: options.isCancellationRequested,
    onStageStarted: options.onStageStarted
  });

  if (options.onOutputsCollecting) {
    await options.onOutputsCollecting('Collecting approved PR Auditor outputs.');
  }
  const outputCollection = await ingestPrAuditorOutputs({
    jobId,
    workspaceOutputRoot: workspace.outputRoot
  });
  if (options.onOutputsCollected) {
    await options.onOutputsCollected('Approved PR Auditor outputs collected.');
  }

  return {
    workerId: WORKER_IDS.PR_AUDITOR,
    workspaceRoot: workspace.workspaceRoot,
    outputRoot: workspace.outputRoot,
    manifest: prAuditorManifest,
    runtime: {
      progressStages: PR_AUDITOR_PROGRESS_STAGES,
      commandSpec
    },
    pipelineResult,
    outputCollection
  };
};

module.exports = {
  PR_AUDITOR_INPUT_FILE_TYPES,
  PR_AUDITOR_PROGRESS_STAGES,
  buildAuditCommandSpec,
  buildPrAuditorExecutionError,
  getTrackedInputFile,
  normalizeStageTimeoutMs,
  persistJobMetadata,
  run,
  runAuditCommand
};
