const fs = require('fs');
const path = require('path');
const { Job, JobFile } = require('../../models');
const {
  buildCommand,
  getExplicitPythonExecutable,
  runCommand,
  runPythonStage
} = require('../../services/childProcessRunner');
const config = require('../../config/env');
const storageService = require('../../services/storageService');
const prAuditorManifest = require('../manifests/prAuditorManifest');
const { ingestPrAuditorOutputs } = require('../prAuditorOutputIngestionService');
const { preparePrAuditorWorkspace } = require('../prAuditorWorkspaceService');
const { WORKER_IDS } = require('../workerTypes');
const { assertPathInsideRoot } = require('../../utils/pathUtils');

const PR_AUDITOR_INPUT_FILE_TYPES = {
  FINAL_PO: 'pr_auditor_final_po_upload',
  EPMS: 'pr_auditor_epms_upload'
};

const PR_AUDITOR_PROGRESS_STAGES = [
  'Validating files',
  'Generating TSS entitlement',
  'Generating TI entitlement',
  'Loading generated ECC entitlement',
  'Auditing PO records',
  'Resolving duplicates',
  'Generating audit report'
];

const ENTITLEMENT_SCOPES = ['TSS', 'TI'];

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

const getFinalPoLayoutOverrides = () => {
  const sheet = String(process.env.PR_AUDITOR_FINAL_PO_SHEET || '').trim();
  const headerRow = String(process.env.PR_AUDITOR_FINAL_PO_HEADER_ROW || '').trim();

  return {
    sheet: sheet || null,
    headerRow: headerRow || null
  };
};

const buildAuditCommandSpec = ({
  workspaceRoot,
  runtimePaths,
  pythonExecutable,
  finalPoLayout = getFinalPoLayoutOverrides(),
  auditPeriod = null
}) => {
  const scriptArgs = [
    '--final-po', runtimePaths.finalPoPath,
    '--expected-ecc', runtimePaths.expectedEccRoot,
    '--output', runtimePaths.outputPath,
    '--summary-json', runtimePaths.summaryJsonPath
  ];

  if (finalPoLayout.sheet) {
    scriptArgs.push('--final-po-sheet', finalPoLayout.sheet);
  }
  if (finalPoLayout.headerRow) {
    scriptArgs.push('--final-po-header-row', finalPoLayout.headerRow);
  }
  if (auditPeriod && auditPeriod.year && auditPeriod.month) {
    scriptArgs.push('--filter-year', String(auditPeriod.year), '--filter-month', String(auditPeriod.month));
  }

  return {
    pythonExecutable,
    cwd: workspaceRoot,
    scriptPath: runtimePaths.scriptPath,
    scriptArgs
  };
};

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

const runEntitlementGeneration = async ({
  runtimePaths,
  timeoutMs,
  isCancellationRequested,
  onStageStarted
}) => {
  const stageResults = [];

  for (let index = 0; index < ENTITLEMENT_SCOPES.length; index += 1) {
    const scope = ENTITLEMENT_SCOPES[index];
    if (onStageStarted) {
      await onStageStarted({
        stage: `create-pr-cd-${scope.toLowerCase()}`,
        stageLabel: `Generating ${scope} entitlement`,
        index: index + 1,
        total: PR_AUDITOR_PROGRESS_STAGES.length
      });
    }

    const commandSpec = buildCommand({
      siteDataPath: runtimePaths.epmsPath,
      outputPath: runtimePaths.expectedEccRoot,
      generationScope: 'all_sites',
      siteCodes: [],
      scope
    });
    const result = await runCommand({
      ...commandSpec,
      timeoutMs: normalizeStageTimeoutMs(timeoutMs),
      isCancellationRequested
    });
    const stageResult = {
      stage: `create-pr-cd-${scope.toLowerCase()}`,
      command: commandSpec.command,
      args: commandSpec.args,
      cwd: commandSpec.cwd,
      ...result
    };
    stageResults.push(stageResult);

    if (result.cancelled) {
      return { cancelled: true, stageResults };
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw buildPrAuditorExecutionError({
        type: result.timedOut ? 'timeout' : 'process_failed',
        exitCode: result.exitCode,
        stderr: result.stderr
      });
    }
  }

  return { cancelled: false, stageResults };
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
  const job = await assertJobExists(jobId);

  if (options.onWorkspacePreparing) {
    await options.onWorkspacePreparing('Preparing PR Auditor job workspace.');
  }

  const [finalPoFile, epmsFile] = await Promise.all([
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.FINAL_PO),
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.EPMS)
  ]);

  const workspace = await preparePrAuditorWorkspace({
    jobId,
    finalPoSourcePath: finalPoFile.absolutePath,
    epmsSourcePath: epmsFile.absolutePath
  });

  if (options.onWorkspacePrepared) {
    await options.onWorkspacePrepared('PR Auditor job workspace ready.');
  }

  await persistJobMetadata(jobId);

  const pythonExecutable = getExplicitPythonExecutable();
  const commandSpec = buildAuditCommandSpec({
    workspaceRoot: workspace.workspaceRoot,
    runtimePaths: workspace.runtimePaths,
    pythonExecutable,
    auditPeriod: { year: job.auditYear, month: job.auditMonth }
  });

  assertEnginePinApproved();

  const entitlementResult = await runEntitlementGeneration({
    runtimePaths: workspace.runtimePaths,
    timeoutMs: options.timeoutMs,
    isCancellationRequested: options.isCancellationRequested,
    onStageStarted: options.onStageStarted
  });
  if (entitlementResult.cancelled) {
    return {
      workerId: WORKER_IDS.PR_AUDITOR,
      workspaceRoot: workspace.workspaceRoot,
      outputRoot: workspace.outputRoot,
      manifest: prAuditorManifest,
      runtime: {
        progressStages: PR_AUDITOR_PROGRESS_STAGES
      },
      pipelineResult: entitlementResult,
      outputCollection: await ingestPrAuditorOutputs({
        jobId,
        workspaceOutputRoot: workspace.outputRoot
      })
    };
  }

  const auditResult = await runAuditCommand({
    commandSpec,
    timeoutMs: options.timeoutMs,
    isCancellationRequested: options.isCancellationRequested,
    onStageStarted: options.onStageStarted
  });
  const pipelineResult = {
    cancelled: auditResult.cancelled,
    stageResults: entitlementResult.stageResults.concat(auditResult.stageResults)
  };

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
  getFinalPoLayoutOverrides,
  getTrackedInputFile,
  normalizeStageTimeoutMs,
  persistJobMetadata,
  run,
  runAuditCommand,
  runEntitlementGeneration
};
