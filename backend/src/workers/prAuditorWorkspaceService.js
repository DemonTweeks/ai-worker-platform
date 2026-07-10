const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const storageService = require('../services/storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const REQUIRED_WORKSPACE_DIRECTORIES = ['input', 'expected-ecc', 'output', 'temp'];
const ENGINE_ENTRY_SCRIPT = path.join('scripts', 'audit_final_po.py');
const DEFAULT_INPUT_FILES = {
  finalPo: 'Final PO.xlsx',
  epms: 'EPMS.xlsx'
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

const resolveEngineScriptPath = () => {
  const engineRoot = assertEngineRootExists();
  const scriptPath = assertPathInsideRoot(engineRoot, path.join(engineRoot, ENGINE_ENTRY_SCRIPT));

  if (!fs.existsSync(scriptPath)) {
    const error = new Error(`PR Auditor engine script was not found: ${ENGINE_ENTRY_SCRIPT}`);
    error.code = 'PR_AUDITOR_ENGINE_SCRIPT_MISSING';
    error.details = { scriptPath };
    throw error;
  }

  return scriptPath;
};

const stageInputFiles = async ({ workspaceRoot, finalPoSourcePath, epmsSourcePath }) => {
  const inputRoot = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input'));
  const finalPoPath = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.finalPo));
  const epmsPath = assertPathInsideRoot(inputRoot, path.join(inputRoot, DEFAULT_INPUT_FILES.epms));

  await fs.promises.copyFile(finalPoSourcePath, finalPoPath);
  await fs.promises.copyFile(epmsSourcePath, epmsPath);

  return {
    finalPoPath,
    epmsPath
  };
};

const buildRuntimePaths = (workspaceRoot) => {
  const outputRoot = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'output'));
  const expectedEccRoot = assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'expected-ecc'));

  return {
    finalPoPath: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input', DEFAULT_INPUT_FILES.finalPo)),
    epmsPath: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'input', DEFAULT_INPUT_FILES.epms)),
    expectedEccRoot,
    outputPath: assertPathInsideRoot(outputRoot, path.join(outputRoot, DEFAULT_OUTPUT_FILES.auditResult)),
    summaryJsonPath: assertPathInsideRoot(outputRoot, path.join(outputRoot, DEFAULT_OUTPUT_FILES.summaryJson)),
    scriptPath: resolveEngineScriptPath()
  };
};

const preparePrAuditorWorkspace = async ({ jobId, finalPoSourcePath, epmsSourcePath }) => {
  const workspace = await storageService.createJobFolders(jobId);
  const workspaceRoot = workspace.root;

  for (const directory of REQUIRED_WORKSPACE_DIRECTORIES) {
    await fs.promises.mkdir(path.join(workspaceRoot, directory), { recursive: true });
  }

  const stagedInputs = await stageInputFiles({
    workspaceRoot,
    finalPoSourcePath,
    epmsSourcePath
  });
  const runtimePaths = buildRuntimePaths(workspaceRoot);

  return {
    jobId,
    workspaceRoot,
    relativeWorkspaceRoot: workspace.relativeRoot,
    engineRoot: config.prAuditorRoot,
    stagedInputs,
    runtimePaths,
    expectedEccRoot: runtimePaths.expectedEccRoot,
    outputRoot: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'output')),
    tempRoot: assertPathInsideRoot(workspaceRoot, path.join(workspaceRoot, 'temp'))
  };
};

module.exports = {
  DEFAULT_INPUT_FILES,
  DEFAULT_OUTPUT_FILES,
  ENGINE_ENTRY_SCRIPT,
  REQUIRED_WORKSPACE_DIRECTORIES,
  buildRuntimePaths,
  preparePrAuditorWorkspace
};
