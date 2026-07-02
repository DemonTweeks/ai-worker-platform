const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const storageService = require('../services/storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const APPROVED_ENGINE_DIRECTORIES = ['scripts'];
const REQUIRED_WORKSPACE_DIRECTORIES = ['input', 'output', 'temp'];
const DEFAULT_INPUT_FILES = {
  finalPo: 'Final PO.xlsx',
  epms: 'EPMS.xlsx',
  prModel: 'pr_model.xlsx'
};
const DEFAULT_OUTPUT_FILES = {
  auditResult: 'PR_Audit_Result.xlsx',
  summaryJson: 'pr_audit_summary.json'
};

const assertEngineRootExists = () => {
  if (!fs.existsSync(config.prAuditorRoot)) {
    const error = new Error(`PR Auditor engine root was not found: ${config.prAuditorRoot}`);
    error.code = 'PR_AUDITOR_ENGINE_ROOT_MISSING';
    throw error;
  }

  return config.prAuditorRoot;
};

const ensurePrAuditorWorkspaceRoot = async () => {
  await fs.promises.mkdir(config.prAuditorWorkspaceRoot, { recursive: true });
  return storageService.getPrAuditorWorkspaceRoot();
};

const copyApprovedEngineAssets = async (workspaceRoot) => {
  const engineRoot = assertEngineRootExists();

  for (const directory of APPROVED_ENGINE_DIRECTORIES) {
    const source = assertPathInsideRoot(engineRoot, path.join(engineRoot, directory));
    const destination = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, directory));

    if (!fs.existsSync(source)) {
      const error = new Error(`PR Auditor engine directory is missing: ${directory}`);
      error.code = 'PR_AUDITOR_ENGINE_DIRECTORY_MISSING';
      error.details = { directory };
      throw error;
    }

    await fs.promises.cp(source, destination, { recursive: true, force: true });
  }
};

const stageInputFiles = async ({ workspaceRoot, finalPoSourcePath, epmsSourcePath, prModelSourcePath }) => {
  const inputRoot = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input'));
  const finalPoPath = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.finalPo));
  const epmsPath = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.epms));
  const prModelPath = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.prModel));

  await fs.promises.copyFile(finalPoSourcePath, finalPoPath);
  await fs.promises.copyFile(epmsSourcePath, epmsPath);
  await fs.promises.copyFile(prModelSourcePath, prModelPath);

  return {
    finalPoPath,
    epmsPath,
    prModelPath
  };
};

const buildRuntimePaths = (workspaceRoot) => {
  const outputRoot = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'output'));

  return {
    finalPoPath: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input', DEFAULT_INPUT_FILES.finalPo)),
    epmsPath: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input', DEFAULT_INPUT_FILES.epms)),
    prModelPath: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input', DEFAULT_INPUT_FILES.prModel)),
    outputPath: assertPathInsideRoot(outputRoot, path.join(outputRoot, DEFAULT_OUTPUT_FILES.auditResult)),
    summaryJsonPath: assertPathInsideRoot(outputRoot, path.join(outputRoot, DEFAULT_OUTPUT_FILES.summaryJson)),
    scriptPath: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'scripts', 'audit_final_po.py'))
  };
};

const preparePrAuditorWorkspace = async ({ jobId, finalPoSourcePath, epmsSourcePath, prModelSourcePath }) => {
  const workspace = await storageService.createPrAuditorWorkspace(jobId);
  const workspaceRoot = workspace.root;

  await ensurePrAuditorWorkspaceRoot();
  await copyApprovedEngineAssets(workspaceRoot);

  for (const directory of REQUIRED_WORKSPACE_DIRECTORIES) {
    await fs.promises.mkdir(path.join(workspaceRoot, directory), { recursive: true });
  }

  const stagedInputs = await stageInputFiles({
    workspaceRoot,
    finalPoSourcePath,
    epmsSourcePath,
    prModelSourcePath
  });
  const runtimePaths = buildRuntimePaths(workspaceRoot);

  return {
    jobId,
    workspaceRoot,
    relativeWorkspaceRoot: workspace.relativeRoot,
    engineRoot: config.prAuditorRoot,
    stagedInputs,
    runtimePaths,
    outputRoot: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'output')),
    tempRoot: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'temp'))
  };
};

const cleanupPrAuditorWorkspace = async (jobId) => storageService.deletePrAuditorWorkspace(jobId);

module.exports = {
  APPROVED_ENGINE_DIRECTORIES,
  DEFAULT_INPUT_FILES,
  DEFAULT_OUTPUT_FILES,
  REQUIRED_WORKSPACE_DIRECTORIES,
  buildRuntimePaths,
  cleanupPrAuditorWorkspace,
  copyApprovedEngineAssets,
  ensurePrAuditorWorkspaceRoot,
  preparePrAuditorWorkspace
};
