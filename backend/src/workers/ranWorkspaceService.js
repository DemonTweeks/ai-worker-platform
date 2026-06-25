const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const storageService = require('../services/storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const APPROVED_ENGINE_DIRECTORIES = ['src', 'config'];
const REQUIRED_WORKSPACE_DIRECTORIES = ['input', 'output', 'temp'];
const DEFAULT_INPUT_FILES = {
  bom: 'BOM.xlsx',
  epms: 'EPMS.xlsx'
};

const assertEngineRootExists = () => {
  if (!fs.existsSync(config.ranCreatePrCdRoot)) {
    const error = new Error(`RAN engine root was not found: ${config.ranCreatePrCdRoot}`);
    error.code = 'RAN_ENGINE_ROOT_MISSING';
    throw error;
  }

  return config.ranCreatePrCdRoot;
};

const ensureRanWorkspaceRoot = async () => {
  await fs.promises.mkdir(config.ranWorkspaceRoot, { recursive: true });
  return storageService.getRanWorkspaceRoot();
};

const copyApprovedEngineAssets = async (workspaceRoot) => {
  const engineRoot = assertEngineRootExists();

  for (const directory of APPROVED_ENGINE_DIRECTORIES) {
    const source = assertPathInsideRoot(engineRoot, path.join(engineRoot, directory));
    const destination = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, directory));
    await fs.promises.cp(source, destination, { recursive: true, force: true });
  }
};

const stageInputFiles = async ({ workspaceRoot, bomSourcePath, epmsSourcePath }) => {
  const inputRoot = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input'));
  const bomDestination = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.bom));
  const epmsDestination = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.epms));

  await fs.promises.copyFile(bomSourcePath, bomDestination);
  await fs.promises.copyFile(epmsSourcePath, epmsDestination);

  return {
    bomPath: bomDestination,
    epmsPath: epmsDestination
  };
};

const prepareRanWorkspace = async ({ jobId, bomSourcePath, epmsSourcePath }) => {
  const workspace = await storageService.createRanWorkspace(jobId);
  const workspaceRoot = workspace.root;

  await ensureRanWorkspaceRoot();
  await copyApprovedEngineAssets(workspaceRoot);

  for (const directory of REQUIRED_WORKSPACE_DIRECTORIES) {
    await fs.promises.mkdir(path.join(workspaceRoot, directory), { recursive: true });
  }

  const stagedInputs = await stageInputFiles({ workspaceRoot, bomSourcePath, epmsSourcePath });

  return {
    jobId,
    workspaceRoot,
    relativeWorkspaceRoot: workspace.relativeRoot,
    engineRoot: config.ranCreatePrCdRoot,
    stagedInputs,
    outputRoot: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'output')),
    tempRoot: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'temp'))
  };
};

const cleanupRanWorkspace = async (jobId) => storageService.deleteRanWorkspace(jobId);

module.exports = {
  APPROVED_ENGINE_DIRECTORIES,
  DEFAULT_INPUT_FILES,
  REQUIRED_WORKSPACE_DIRECTORIES,
  cleanupRanWorkspace,
  copyApprovedEngineAssets,
  ensureRanWorkspaceRoot,
  prepareRanWorkspace
};
