const fs = require('fs');
const path = require('path');
const { Job, JobFile } = require('../../models');
const { getExplicitPythonExecutable, runPythonStage } = require('../../services/childProcessRunner');
const storageService = require('../../services/storageService');
const { buildRanExecutionError } = require('../ranFailureService');
const ranPrManifest = require('../manifests/ranPrManifest');
const { ingestRanOutputs } = require('../ranOutputIngestionService');
const { validateRanRunConfiguration } = require('../ranProjectCatalogService');
const { prepareRanWorkspace } = require('../ranWorkspaceService');
const { WORKER_IDS } = require('../workerTypes');
const { assertPathInsideRoot } = require('../../utils/pathUtils');

const RAN_PIPELINE_STAGES = [
  'src/simple_normalize.py',
  'src/simple_calculation.py',
  'src/simple_pr_generator.py',
  'src/simple_ecc_export.py'
];

const RAN_INPUT_FILE_TYPES = {
  BOM: 'ran_bom_upload',
  EPMS: 'ran_epms_upload'
};

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
    const error = new Error(`Required RAN input file is missing: ${fileType}.`);
    error.code = 'RAN_INPUT_FILE_MISSING';
    error.details = { fileType };
    throw error;
  }

  const absolutePath = assertPathInsideRoot(
    storageService.getStorageRoot(),
    path.join(storageService.getStorageRoot(), file.filePath)
  );

  if (!fs.existsSync(absolutePath)) {
    const error = new Error(`Tracked RAN input file is unavailable: ${fileType}.`);
    error.code = 'RAN_INPUT_FILE_UNAVAILABLE';
    error.details = { fileType };
    throw error;
  }

  return {
    ...file,
    absolutePath
  };
};

const buildPipelineEnv = ({ runMode, selectedProject }) => {
  const env = {
    BOM_FILE_PATH: 'input/BOM.xlsx',
    EPMS_FILE_PATH: 'input/EPMS.xlsx',
    RAN_RUN_MODE: runMode
  };

  if (selectedProject) {
    env.SELECTED_PROJECT = selectedProject;
    env.GENERAL_ITEM_PROJECT = selectedProject;
  }

  return env;
};

const persistJobMetadata = async (jobId, { runMode, selectedProject }) => {
  await Job.updateOne(
    { jobId },
    {
      $set: {
        workerId: WORKER_IDS.RAN_PR,
        workerType: 'pr-worker',
        engineVersion: ranPrManifest.engineVersion,
        engineCommit: ranPrManifest.engineCommit,
        runMode,
        selectedProject
      }
    }
  );
};

const runPipelineStages = async ({
  workspaceRoot,
  runMode,
  selectedProject,
  timeoutMs,
  isCancellationRequested
}) => {
  const pythonExecutable = getExplicitPythonExecutable();
  const stageResults = [];
  const env = buildPipelineEnv({ runMode, selectedProject });

  for (const relativeScriptPath of RAN_PIPELINE_STAGES) {
    if (isCancellationRequested && isCancellationRequested()) {
      return {
        cancelled: true,
        stageResults
      };
    }

    const result = await runPythonStage({
      pythonExecutable,
      scriptPath: relativeScriptPath,
      cwd: workspaceRoot,
      env,
      timeoutMs,
      scriptArgs: selectedProject && relativeScriptPath.endsWith('simple_pr_generator.py')
        ? ['--selected-project', selectedProject]
        : [],
      isCancellationRequested
    });

    stageResults.push({
      stage: relativeScriptPath,
      command: pythonExecutable,
      args: [relativeScriptPath].concat(
        selectedProject && relativeScriptPath.endsWith('simple_pr_generator.py')
          ? ['--selected-project', selectedProject]
          : []
      ),
      cwd: workspaceRoot,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      cancelled: result.cancelled,
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (result.cancelled) {
      return {
        cancelled: true,
        stageResults
      };
    }

    if (result.timedOut) {
      throw buildRanExecutionError({
        type: 'timeout',
        stage: relativeScriptPath,
        exitCode: result.exitCode,
        stderr: result.stderr
      });
    }

    if (result.exitCode !== 0) {
      throw buildRanExecutionError({
        type: 'process_failed',
        stage: relativeScriptPath,
        exitCode: result.exitCode,
        stderr: result.stderr
      });
    }
  }

  return {
    cancelled: false,
    stageResults
  };
};

const run = async (jobId, options = {}) => {
  const job = await assertJobExists(jobId);
  const { runMode, selectedProject } = validateRanRunConfiguration({
    runMode: options.runMode || job.runMode,
    selectedProject: options.selectedProject || job.selectedProject
  });
  const [bomFile, epmsFile] = await Promise.all([
    getTrackedInputFile(jobId, RAN_INPUT_FILE_TYPES.BOM),
    getTrackedInputFile(jobId, RAN_INPUT_FILE_TYPES.EPMS)
  ]);
  const workspace = await prepareRanWorkspace({
    jobId,
    bomSourcePath: bomFile.absolutePath,
    epmsSourcePath: epmsFile.absolutePath
  });

  await persistJobMetadata(jobId, { runMode, selectedProject });

  const pipelineResult = await runPipelineStages({
    workspaceRoot: workspace.workspaceRoot,
    runMode,
    selectedProject,
    timeoutMs: options.timeoutMs,
    isCancellationRequested: options.isCancellationRequested
  });
  const outputCollection = await ingestRanOutputs({
    jobId,
    workspaceOutputRoot: workspace.outputRoot
  });

  return {
    workerId: WORKER_IDS.RAN_PR,
    runMode,
    selectedProject,
    workspaceRoot: workspace.workspaceRoot,
    outputRoot: workspace.outputRoot,
    manifest: ranPrManifest,
    pipelineResult,
    outputCollection
  };
};

module.exports = {
  RAN_INPUT_FILE_TYPES,
  RAN_PIPELINE_STAGES,
  buildPipelineEnv,
  persistJobMetadata,
  run,
  runPipelineStages
};
