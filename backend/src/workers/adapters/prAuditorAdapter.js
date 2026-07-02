const fs = require('fs');
const path = require('path');
const { Job, JobFile } = require('../../models');
const { getExplicitPythonExecutable } = require('../../services/childProcessRunner');
const storageService = require('../../services/storageService');
const prAuditorManifest = require('../manifests/prAuditorManifest');
const { preparePrAuditorWorkspace } = require('../prAuditorWorkspaceService');
const { WORKER_IDS } = require('../workerTypes');
const { assertPathInsideRoot } = require('../../utils/pathUtils');

const PR_AUDITOR_INPUT_FILE_TYPES = {
  FINAL_PO: 'pr_auditor_final_po_upload',
  EPMS: 'pr_auditor_epms_upload',
  PR_MODEL: 'pr_auditor_pr_model_upload'
};

const PR_AUDITOR_PROGRESS_STAGES = [
  'Validating files',
  'Matching EPMS',
  'Resolving expected entitlement',
  'Auditing PO records',
  'Resolving duplicates',
  'Generating audit report'
];

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
    '--epms', runtimePaths.epmsPath,
    '--pr-model', runtimePaths.prModelPath,
    '--output', runtimePaths.outputPath,
    '--summary-json', runtimePaths.summaryJsonPath
  ]
});

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

const run = async (jobId, options = {}) => {
  await assertJobExists(jobId);

  if (options.onWorkspacePreparing) {
    await options.onWorkspacePreparing('Preparing isolated PR Auditor workspace.');
  }

  const [finalPoFile, epmsFile, prModelFile] = await Promise.all([
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.FINAL_PO),
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.EPMS),
    getTrackedInputFile(jobId, PR_AUDITOR_INPUT_FILE_TYPES.PR_MODEL)
  ]);

  const workspace = await preparePrAuditorWorkspace({
    jobId,
    finalPoSourcePath: finalPoFile.absolutePath,
    epmsSourcePath: epmsFile.absolutePath,
    prModelSourcePath: prModelFile.absolutePath
  });

  if (options.onWorkspacePrepared) {
    await options.onWorkspacePrepared('PR Auditor workspace ready.');
  }

  await persistJobMetadata(jobId);

  const pythonExecutable = getExplicitPythonExecutable();
  const commandSpec = buildAuditCommandSpec({
    workspaceRoot: workspace.workspaceRoot,
    runtimePaths: workspace.runtimePaths,
    pythonExecutable
  });

  assertEnginePinApproved();

  return {
    workerId: WORKER_IDS.PR_AUDITOR,
    workspaceRoot: workspace.workspaceRoot,
    outputRoot: workspace.outputRoot,
    manifest: prAuditorManifest,
    runtime: {
      progressStages: PR_AUDITOR_PROGRESS_STAGES,
      commandSpec
    }
  };
};

module.exports = {
  PR_AUDITOR_INPUT_FILE_TYPES,
  PR_AUDITOR_PROGRESS_STAGES,
  buildAuditCommandSpec,
  getTrackedInputFile,
  persistJobMetadata,
  run
};
